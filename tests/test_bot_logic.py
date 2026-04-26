import json
import subprocess
import sys

import clip_ai_bot


def test_scene_from_text_court():
    scene = clip_ai_bot.scene_from_text("A famous person in court after a trial")
    assert "courtroom" in scene
    assert "judge" in scene


def test_build_queries_contains_exact_subject():
    queries = clip_ai_bot.build_queries(
        "Nikola Tesla",
        "Nikola Tesla helped develop alternating current.",
        "inventor laboratory electricity machine experiment",
    )
    assert queries["exact"] == ["Nikola Tesla"]
    assert any("electricity" in q for q in queries["related"])


def test_subject_match_filters_random_clip():
    random_clip = {
        "title": "Old black and white city street",
        "tags": "archive crowd street",
        "creator": "Archive",
        "source": "Internet Archive",
        "pageUrl": "https://example.com/old-street",
    }
    good_clip = {
        "title": "Nikola Tesla laboratory electricity experiment",
        "tags": "Nikola Tesla electricity lab machine",
        "creator": "Example",
        "source": "Wikimedia Commons",
        "pageUrl": "https://example.com/tesla",
    }
    assert not clip_ai_bot.subject_match(random_clip, "Nikola Tesla")
    assert clip_ai_bot.subject_match(good_clip, "Nikola Tesla")


def test_iconic_segment_clips_long_video_to_20_30_seconds():
    clip = {
        "id": "long-speech",
        "source": "Wikimedia Commons",
        "title": "Famous speech podium crowd",
        "tags": "speech podium crowd civil rights",
        "creator": "Creator",
        "pageUrl": "https://example.com/speech",
        "videoUrl": "https://example.com/speech.mp4",
        "previewUrl": "https://example.com/speech.mp4",
        "duration": 3600,
        "license": "CC BY",
        "match": "exact",
    }
    clipped = clip_ai_bot.choose_iconic_segment(clip, "Famous speech", "speech podium crowd audience")
    assert 20 <= clipped["clipDuration"] <= 30
    assert clipped["endTime"] - clipped["startTime"] <= 30
    assert clipped["needsTrim"] is True
    assert clipped["startTime"] > 0


def test_short_video_is_not_forced_past_real_duration():
    clip = {
        "id": "short-clip",
        "source": "Pixabay",
        "title": "Volcano eruption lava",
        "tags": "volcano eruption lava smoke",
        "creator": "Creator",
        "pageUrl": "https://example.com/volcano",
        "videoUrl": "https://example.com/volcano.mp4",
        "previewUrl": "https://example.com/volcano.mp4",
        "duration": 12,
        "license": "Pixabay Content License",
        "match": "related",
    }
    clipped = clip_ai_bot.choose_iconic_segment(clip, "Volcano", "volcano lava eruption smoke mountain")
    assert clipped["clipDuration"] == 12
    assert clipped["startTime"] == 0
    assert clipped["endTime"] == 12


def test_strict_search_keeps_only_relevant_and_adds_segment(monkeypatch):
    def fake_pixabay(query, api_key, pages=1):
        return [
            {
                "id": "random-old-film",
                "source": "Pixabay",
                "title": "Random black and white city street",
                "tags": "old city street archive",
                "creator": "Random",
                "pageUrl": "https://example.com/random",
                "videoUrl": "https://example.com/random.mp4",
                "previewUrl": "https://example.com/random.mp4",
                "duration": 3600,
                "license": "Pixabay Content License",
            },
            {
                "id": "tesla-lab",
                "source": "Pixabay",
                "title": "Nikola Tesla laboratory electricity machine",
                "tags": "Nikola Tesla electricity lab machine",
                "creator": "Creator",
                "pageUrl": "https://example.com/tesla",
                "videoUrl": "https://example.com/tesla.mp4",
                "previewUrl": "https://example.com/tesla.mp4",
                "duration": 3600,
                "license": "Pixabay Content License",
            },
        ]

    monkeypatch.setattr(clip_ai_bot, "search_pixabay", fake_pixabay)
    monkeypatch.setattr(clip_ai_bot, "search_pexels", lambda *args, **kwargs: [])
    monkeypatch.setattr(clip_ai_bot, "search_commons", lambda *args, **kwargs: [])

    result = clip_ai_bot.strict_search(
        subject="Nikola Tesla",
        fact="Nikola Tesla helped develop alternating current.",
        scene="inventor laboratory electricity machine experiment",
        pixabay_key="fake-key",
        pexels_key="",
        many=False,
    )
    ids = [clip["id"] for clip in result["clips"]]
    assert "tesla-lab" in ids
    assert "random-old-film" not in ids
    assert result["exactCount"] >= 1
    tesla = next(clip for clip in result["clips"] if clip["id"] == "tesla-lab")
    assert 20 <= tesla["clipDuration"] <= 30
    assert tesla["needsTrim"] is True


def test_youtube_uploader_dry_run(tmp_path):
    video = tmp_path / "test.webm"
    video.write_bytes(b"fake video")
    command = [
        sys.executable,
        "youtube_upload_bot.py",
        "--video",
        str(video),
        "--title",
        "Test Short",
        "--description",
        "Dry run test",
        "--dry-run",
    ]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    assert payload["ok"] is True
    assert payload["dry_run"] is True
    assert payload["title"] == "Test Short"
