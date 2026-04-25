import os
import re
import urllib.parse
from typing import Any, Dict, List

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

TARGET_SEGMENT_SECONDS = 25
MIN_SEGMENT_SECONDS = 20
MAX_SEGMENT_SECONDS = 30

STOP_WORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "about", "after",
    "before", "when", "what", "why", "how", "was", "were", "are", "his", "her",
    "their", "who", "has", "had", "have", "did", "does", "junior", "jr", "mrs", "mr",
    "person", "people", "became", "because", "through", "during", "against", "between",
}

ICONIC_KEYWORDS = {
    "speech", "podium", "march", "protest", "court", "trial", "hearing", "eruption",
    "explosion", "launch", "goal", "ceremony", "interview", "debate", "performance",
    "experiment", "demonstration", "rescue", "historic", "famous", "iconic",
}

SCENE_RULES = [
    ("court", "courtroom judge lawyer courthouse hearing legal documents"),
    ("trial", "courtroom judge lawyer courthouse hearing legal documents"),
    ("lawsuit", "courtroom lawyer legal documents courthouse"),
    ("speech", "speech podium microphone crowd audience"),
    ("civil rights", "civil rights march protest crowd speech podium"),
    ("inventor", "inventor laboratory electricity machine experiment"),
    ("science", "science lab microscope experiment researcher"),
    ("money", "money cash bank finance coins wallet"),
    ("space", "space rocket planet astronaut galaxy"),
    ("ocean", "ocean waves underwater sea marine"),
    ("animal", "wild animals wildlife nature close up"),
    ("history", "historic building crowd speech old city street"),
    ("war", "military soldiers battlefield memorial"),
    ("school", "students classroom books studying"),
    ("health", "hospital doctor patient medical"),
    ("food", "food cooking kitchen close up"),
    ("technology", "computer phone circuit technology"),
    ("weather", "storm rain lightning clouds"),
    ("sports", "stadium athlete sports training"),
    ("music", "microphone concert crowd stage"),
    ("car", "cars road traffic city driving"),
    ("ship", "ship ocean water waves"),
    ("titanic", "ship ocean water iceberg historical"),
    ("volcano", "volcano lava eruption smoke mountain"),
    ("earth", "nature forest mountains landscape"),
]


def clean(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def tokens(text: str, limit: int = 24) -> List[str]:
    raw = re.split(r"[^a-zA-Z0-9]+", clean(text).lower())
    return [w for w in raw if len(w) > 2 and w not in STOP_WORDS][:limit]


def scene_from_text(text: str) -> str:
    low = clean(text).lower()
    for key, scene in SCENE_RULES:
        if key in low:
            return scene
    return " ".join(tokens(text, 8))


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value or default)
    except (TypeError, ValueError):
        return default


def clip_text(clip: Dict[str, Any]) -> str:
    fields = ["title", "tags", "creator", "credit", "source", "pageUrl"]
    return clean(" ".join(str(clip.get(k, "")) for k in fields)).lower()


def choose_iconic_segment(clip: Dict[str, Any], subject: str, scene: str) -> Dict[str, Any]:
    """Pick a 20 to 30 second segment instead of using an entire long source video.

    This is a safe heuristic. It cannot truly watch the video without computer vision,
    but it chooses a strong short window and marks the clip for trimming.
    """
    duration = safe_float(clip.get("duration"), 0.0)
    text = clip_text(clip)
    scene_tokens = set(tokens(scene, 12))
    iconic_hits = len((scene_tokens | ICONIC_KEYWORDS).intersection(set(tokens(text, 40))))

    segment_length = TARGET_SEGMENT_SECONDS
    if duration and duration < TARGET_SEGMENT_SECONDS:
        segment_length = max(1, min(duration, MAX_SEGMENT_SECONDS))
    elif duration and duration <= MAX_SEGMENT_SECONDS:
        segment_length = duration

    if not duration or duration <= MAX_SEGMENT_SECONDS:
        start = 0.0
        reason = "source already short" if duration else "duration unknown, use first 25 seconds"
    else:
        latest_start = max(0.0, duration - segment_length)
        if clip.get("match") == "exact" and iconic_hits:
            start = min(max(8.0, duration * 0.18), latest_start)
            reason = "exact topic, starts near likely action point"
        elif iconic_hits:
            start = min(max(5.0, duration * 0.12), latest_start)
            reason = "scene keywords found, starts near likely visual action"
        else:
            start = min(10.0, latest_start)
            reason = "long source, avoid using the full video"

    end = start + segment_length
    clip["startTime"] = round(start, 2)
    clip["endTime"] = round(end, 2)
    clip["clipDuration"] = round(segment_length, 2)
    clip["trimToSeconds"] = round(segment_length, 2)
    clip["segmentReason"] = reason
    clip["needsTrim"] = bool(duration and duration > MAX_SEGMENT_SECONDS)
    clip["iconicScore"] = iconic_hits
    return clip


def wiki_summary(subject: str) -> Dict[str, str]:
    subject = clean(subject)
    if not subject:
        return {"subject": "", "fact": "", "scene": "", "details": ""}
    try:
        search = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={"action": "query", "list": "search", "srsearch": subject, "format": "json", "utf8": 1},
            timeout=8,
        ).json()
        hit = (search.get("query", {}).get("search") or [{}])[0]
        page_title = clean(hit.get("title") or subject)
        summary = requests.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(page_title)}",
            timeout=8,
        ).json()
        extract = clean(summary.get("extract") or hit.get("snippet") or subject)
        extract = re.sub(r"<[^>]+>", "", extract)
        sentences = re.split(r"(?<=[.!?])\s+", extract)
        fact = " ".join([s for s in sentences if s][:2]) or f"{page_title} is a topic where the setting, timeline, and context help explain the story."
        desc = clean(summary.get("description") or "")
        scene = scene_from_text(f"{page_title} {desc} {fact}")
        details = ", ".join(tokens(f"{page_title} {desc} {fact}", 6))
        return {"subject": page_title, "fact": fact, "scene": scene, "details": details}
    except Exception:
        return {
            "subject": subject,
            "fact": f"{subject} is a topic where the setting, timeline, and context help explain the story.",
            "scene": scene_from_text(subject),
            "details": ", ".join(tokens(subject, 6)),
        }


def build_queries(subject: str, fact: str, scene: str) -> Dict[str, List[str]]:
    subject = clean(subject)
    fact = clean(fact)
    scene = clean(scene) or scene_from_text(f"{subject} {fact}")
    exact = [subject] if subject else []
    related = []
    for query in [f"{subject} {scene}", scene, " ".join(tokens(fact, 6)), f"{scene} b roll", f"{scene} stock video"]:
        query = clean(query)
        if query and query not in related:
            related.append(query)
    return {"exact": exact, "related": related[:5]}


def subject_match(clip: Dict[str, Any], subject: str) -> bool:
    subject_tokens = tokens(subject, 8)
    if not subject_tokens:
        return False
    text = clip_text(clip)
    hits = sum(1 for token in subject_tokens if token in text)
    return hits >= (1 if len(subject_tokens) == 1 else min(2, len(subject_tokens)))


def scene_match(clip: Dict[str, Any], scene: str) -> bool:
    scene_tokens = tokens(scene, 10)
    if not scene_tokens:
        return False
    text = clip_text(clip)
    hits = sum(1 for token in scene_tokens if token in text)
    return hits >= min(2, len(scene_tokens))


def score_clip(clip: Dict[str, Any], subject: str, scene: str) -> float:
    text = clean(f"{clip_text(clip)} {clip.get('license', '')}").lower()
    score = 0.0
    for token in tokens(subject, 8):
        if token in text:
            score += 15
    for token in tokens(scene, 10):
        if token in text:
            score += 4
    if clip.get("match") == "exact":
        score += 60
    if clip.get("source") in {"Pixabay", "Pexels"}:
        score += 10
    if clip.get("source") == "Wikimedia Commons":
        score += 6
    license_text = clean(clip.get("license")).lower()
    if "public" in license_text or "cc0" in license_text:
        score += 4
    duration = safe_float(clip.get("duration"), 0.0)
    if MIN_SEGMENT_SECONDS <= duration <= 90:
        score += 6
    elif duration > 90:
        score -= 2
    score += min(clip.get("iconicScore", 0), 5)
    return score


def normalize_clip(clip: Dict[str, Any], subject: str = "", scene: str = "") -> Dict[str, Any]:
    creator = clean(clip.get("creator") or clip.get("credit") or "Unknown creator")
    clip["creator"] = creator
    clip["credit"] = creator
    return choose_iconic_segment(clip, subject, scene)


def search_pixabay(query: str, api_key: str, pages: int = 1) -> List[Dict[str, Any]]:
    if not api_key:
        return []
    clips = []
    for page in range(1, pages + 1):
        try:
            response = requests.get(
                "https://pixabay.com/api/videos/",
                params={
                    "key": api_key,
                    "q": query,
                    "orientation": "vertical",
                    "per_page": 200 if pages > 1 else 40,
                    "page": page,
                    "safesearch": "true",
                    "order": "popular",
                },
                timeout=10,
            )
            if not response.ok:
                continue
            for hit in response.json().get("hits", []):
                videos = hit.get("videos") or {}
                file = videos.get("medium") or videos.get("small") or videos.get("large") or videos.get("tiny")
                if not file or not file.get("url"):
                    continue
                clips.append({
                    "id": f"pixabay-{hit.get('id')}",
                    "source": "Pixabay",
                    "title": hit.get("tags") or query,
                    "tags": hit.get("tags") or query,
                    "creator": hit.get("user") or "Pixabay creator",
                    "pageUrl": hit.get("pageURL"),
                    "videoUrl": file.get("url"),
                    "previewUrl": file.get("url"),
                    "duration": hit.get("duration") or 0,
                    "license": "Pixabay Content License",
                })
        except Exception:
            continue
    return clips


def search_pexels(query: str, api_key: str, pages: int = 1) -> List[Dict[str, Any]]:
    if not api_key:
        return []
    clips = []
    for page in range(1, pages + 1):
        try:
            response = requests.get(
                "https://api.pexels.com/videos/search",
                params={"query": query, "orientation": "portrait", "size": "medium", "per_page": 80 if pages > 1 else 40, "page": page},
                headers={"Authorization": api_key},
                timeout=10,
            )
            if not response.ok:
                continue
            for video in response.json().get("videos", []):
                files = video.get("video_files") or []
                vertical = [f for f in files if f.get("link") and (f.get("height") or 0) >= (f.get("width") or 0)]
                file = (vertical or files or [{}])[0]
                if not file.get("link"):
                    continue
                clips.append({
                    "id": f"pexels-{video.get('id')}",
                    "source": "Pexels",
                    "title": query,
                    "tags": query,
                    "creator": (video.get("user") or {}).get("name") or "Pexels creator",
                    "pageUrl": video.get("url"),
                    "videoUrl": file.get("link"),
                    "previewUrl": file.get("link"),
                    "duration": video.get("duration") or 0,
                    "license": "Pexels License",
                })
        except Exception:
            continue
    return clips


def search_commons(query: str, pages: int = 1) -> List[Dict[str, Any]]:
    clips = []
    offset = 0
    for _ in range(pages):
        try:
            response = requests.get(
                "https://commons.wikimedia.org/w/api.php",
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrnamespace": 6,
                    "gsrlimit": 50,
                    "gsroffset": offset,
                    "gsrsearch": f"{query} filetype:video",
                    "prop": "imageinfo",
                    "iiprop": "url|mime|extmetadata",
                    "format": "json",
                    "origin": "*",
                },
                timeout=10,
            )
            if not response.ok:
                break
            data = response.json()
            for page in list((data.get("query", {}).get("pages") or {}).values()):
                info = ((page.get("imageinfo") or [None])[0])
                if not info or not str(info.get("mime") or "").startswith("video/"):
                    continue
                meta = info.get("extmetadata") or {}
                license_name = clean((meta.get("LicenseShortName") or {}).get("value") or (meta.get("UsageTerms") or {}).get("value") or "Unknown license")
                artist = clean((meta.get("Artist") or {}).get("value") or "Wikimedia contributor")
                artist = re.sub(r"<[^>]+>", "", artist)
                media_title = clean(page.get("title") or "").replace("File:", ""))
                clips.append({
                    "id": f"commons-{page.get('pageid')}",
                    "source": "Wikimedia Commons",
                    "title": media_title,
                    "tags": f"{media_title} {query}",
                    "creator": artist,
                    "pageUrl": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(clean(page.get("title") or "").replace(" ", "_")),
                    "videoUrl": info.get("url"),
                    "previewUrl": info.get("url"),
                    "duration": 0,
                    "license": license_name,
                })
            offset = data.get("continue", {}).get("gsroffset")
            if not offset:
                break
        except Exception:
            break
    return clips


def strict_search(subject: str, fact: str, scene: str, pixabay_key: str, pexels_key: str, many: bool = False) -> Dict[str, Any]:
    queries = build_queries(subject, fact, scene)
    pages = 5 if many else 1
    raw: List[Dict[str, Any]] = []

    for query in queries["exact"]:
        raw.extend(search_pixabay(query, pixabay_key, pages))
        raw.extend(search_pexels(query, pexels_key, pages))
        raw.extend(search_commons(query, 2 if many else 1))

    for query in queries["related"]:
        raw.extend(search_pixabay(query, pixabay_key, pages))
        raw.extend(search_pexels(query, pexels_key, pages))
        raw.extend(search_commons(query, 2 if many else 1))

    by_id: Dict[str, Dict[str, Any]] = {}
    for clip in raw:
        if not clip.get("videoUrl"):
            continue
        if subject_match(clip, subject):
            clip["match"] = "exact"
        elif scene_match(clip, scene):
            clip["match"] = "related"
        else:
            continue
        clip = normalize_clip(clip, subject, scene)
        by_id[clip["id"]] = clip

    clips = list(by_id.values())
    clips.sort(key=lambda c: score_clip(c, subject, scene), reverse=True)
    return {
        "queries": queries,
        "exactCount": len([c for c in clips if c.get("match") == "exact"]),
        "relatedCount": len([c for c in clips if c.get("match") == "related"]),
        "targetSegmentSeconds": TARGET_SEGMENT_SECONDS,
        "minSegmentSeconds": MIN_SEGMENT_SECONDS,
        "maxSegmentSeconds": MAX_SEGMENT_SECONDS,
        "clips": clips[:1500],
    }


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "Clip AI Bot"})


@app.post("/api/auto-fill")
def api_auto_fill():
    data = request.get_json(force=True) or {}
    return jsonify(wiki_summary(data.get("subject", "")))


@app.post("/api/search-clips")
def api_search_clips():
    data = request.get_json(force=True) or {}
    subject = clean(data.get("subject"))
    fact = clean(data.get("fact"))
    scene = clean(data.get("scene")) or scene_from_text(f"{subject} {fact}")
    pixabay_key = clean(data.get("pixabayKey") or os.getenv("PIXABAY_API_KEY"))
    pexels_key = clean(data.get("pexelsKey") or os.getenv("PEXELS_API_KEY"))
    many = bool(data.get("many"))
    return jsonify(strict_search(subject, fact, scene, pixabay_key, pexels_key, many))


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
