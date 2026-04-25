import json
import subprocess
import sys
from pathlib import Path

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


def test_strict_search_keeps_only_relevant(monkeypatch):
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
                "duration": 20,
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
                "duration": 20,
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
