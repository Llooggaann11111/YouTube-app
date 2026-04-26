from __future__ import annotations

import os
from typing import Any, Dict

from flask import jsonify, request

import clip_ai_bot
import media_intelligence

app = clip_ai_bot.app


def clean(value: Any) -> str:
    return clip_ai_bot.clean(value)


def choose_segment(clip: Dict[str, Any], subject: str = "", scene: str = "") -> Dict[str, Any]:
    clip = dict(clip)
    result = media_intelligence.analyze_best_segment(
        clean(clip.get("videoUrl")),
        subject=subject,
        scene=scene,
        target_seconds=media_intelligence.TARGET_SEGMENT_SECONDS,
    )
    if result.get("ok"):
        clip["startTime"] = result["startTime"]
        clip["endTime"] = result["endTime"]
        clip["clipDuration"] = result["clipDuration"]
        clip["trimToSeconds"] = result["clipDuration"]
        clip["needsTrim"] = bool(result.get("duration", 0) > media_intelligence.MAX_SEGMENT_SECONDS)
        clip["segmentReason"] = "computer vision and audio picked this segment"
        clip["analysis"] = result
        return clip
    clip = clip_ai_bot.choose_iconic_segment(clip, subject, scene)
    clip["analysis"] = result
    return clip


@app.post("/api/analyze-segment")
def api_analyze_segment():
    data = request.get_json(force=True) or {}
    clip = data.get("clip") or data
    subject = clean(data.get("subject"))
    scene = clean(data.get("scene"))
    return jsonify(choose_segment(clip, subject, scene))


@app.post("/api/search-clips-smart")
def api_search_clips_smart():
    data = request.get_json(force=True) or {}
    subject = clean(data.get("subject"))
    fact = clean(data.get("fact"))
    scene = clean(data.get("scene")) or clip_ai_bot.scene_from_text(f"{subject} {fact}")
    pixabay_key = clean(data.get("pixabayKey") or os.getenv("PIXABAY_API_KEY"))
    pexels_key = clean(data.get("pexelsKey") or os.getenv("PEXELS_API_KEY"))
    many = bool(data.get("many"))
    analyze_top = int(data.get("analyzeTop") or 3)
    result = clip_ai_bot.strict_search(subject, fact, scene, pixabay_key, pexels_key, many)
    clips = result.get("clips", [])
    result["clips"] = [choose_segment(c, subject, scene) if i < analyze_top else c for i, c in enumerate(clips)]
    result["smartAnalysis"] = {
        "enabled": True,
        "analyzedTop": min(analyze_top, len(clips)),
        "method": "computer vision plus audio scoring",
        "targetSeconds": media_intelligence.TARGET_SEGMENT_SECONDS,
    }
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
