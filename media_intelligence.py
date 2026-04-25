from __future__ import annotations

import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

TARGET_SEGMENT_SECONDS = 25
MIN_SEGMENT_SECONDS = 20
MAX_SEGMENT_SECONDS = 30


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def ffprobe_duration(path_or_url: str) -> float:
    if not shutil.which("ffprobe"):
        return 0.0
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path_or_url],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            return 0.0
        data = json.loads(result.stdout or "{}")
        return safe_float(data.get("format", {}).get("duration"), 0.0)
    except Exception:
        return 0.0


def download_video(video_url: str, max_bytes: int = 350_000_000) -> Optional[Path]:
    if not video_url:
        return None
    local = Path(video_url).expanduser()
    if local.exists():
        return local
    if not video_url.startswith(("http://", "https://")):
        return None

    suffix = ".mp4"
    if ".webm" in video_url.lower():
        suffix = ".webm"
    target = Path(tempfile.gettempdir()) / f"factpulse-analysis-{abs(hash(video_url))}{suffix}"
    if target.exists() and target.stat().st_size > 1024:
        return target

    try:
        with requests.get(video_url, stream=True, timeout=20) as response:
            response.raise_for_status()
            total = 0
            with target.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > max_bytes:
                        break
                    handle.write(chunk)
        if target.exists() and target.stat().st_size > 1024:
            return target
    except Exception:
        try:
            target.unlink(missing_ok=True)
        except Exception:
            pass
    return None


def normalize_scores(values: List[float]) -> List[float]:
    if not values:
        return []
    low = min(values)
    high = max(values)
    if math.isclose(low, high):
        return [0.5 for _ in values]
    return [(v - low) / (high - low) for v in values]


def audio_energy_scores(video_path: Path, duration: float, sample_rate: int = 8000) -> List[float]:
    if not shutil.which("ffmpeg") or duration <= 0:
        return []
    try:
        command = ["ffmpeg", "-v", "error", "-i", str(video_path), "-vn", "-ac", "1", "-ar", str(sample_rate), "-f", "s16le", "-"]
        proc = subprocess.run(command, capture_output=True, timeout=min(240, max(30, int(duration) + 10)))
        if proc.returncode != 0 or not proc.stdout:
            return []

        import numpy as np

        audio = np.frombuffer(proc.stdout, dtype=np.int16).astype("float32")
        if audio.size == 0:
            return []
        seconds = max(1, int(math.ceil(audio.size / sample_rate)))
        scores: List[float] = []
        for second in range(seconds):
            start = second * sample_rate
            end = min(audio.size, start + sample_rate)
            chunk = audio[start:end]
            if chunk.size == 0:
                scores.append(0.0)
            else:
                rms = float(np.sqrt(np.mean(np.square(chunk))))
                scores.append(rms)
        return normalize_scores(scores)
    except Exception:
        return []


def visual_scores(video_path: Path, duration: float, max_seconds: int = 600) -> List[float]:
    try:
        import cv2
        import numpy as np
    except Exception:
        return []

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []

    seconds = int(math.ceil(duration or cap.get(cv2.CAP_PROP_FRAME_COUNT) / max(cap.get(cv2.CAP_PROP_FPS), 1) or 0))
    seconds = max(1, min(seconds, max_seconds))

    face_cascade = None
    try:
        cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        if cascade_path.exists():
            face_cascade = cv2.CascadeClassifier(str(cascade_path))
    except Exception:
        face_cascade = None

    raw_scores: List[float] = []
    prev_small = None
    for sec in range(seconds):
        cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
        ok, frame = cap.read()
        if not ok or frame is None:
            raw_scores.append(0.0)
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (160, 90))
        brightness = float(np.mean(small)) / 255.0
        contrast = float(np.std(small)) / 64.0
        sharpness = float(cv2.Laplacian(small, cv2.CV_64F).var()) / 800.0
        motion = 0.0
        if prev_small is not None:
            motion = float(np.mean(cv2.absdiff(small, prev_small))) / 32.0
        prev_small = small

        face_score = 0.0
        if face_cascade is not None:
            try:
                faces = face_cascade.detectMultiScale(small, scaleFactor=1.1, minNeighbors=4, minSize=(16, 16))
                face_score = min(len(faces), 3) / 3.0
            except Exception:
                face_score = 0.0

        exposure_penalty = 0.0
        if brightness < 0.12 or brightness > 0.92:
            exposure_penalty = 0.35

        score = (
            0.35 * clamp(motion, 0.0, 1.0)
            + 0.25 * clamp(sharpness, 0.0, 1.0)
            + 0.15 * clamp(contrast, 0.0, 1.0)
            + 0.15 * face_score
            + 0.10 * (1.0 - abs(brightness - 0.52))
            - exposure_penalty
        )
        raw_scores.append(max(0.0, score))

    cap.release()
    return normalize_scores(raw_scores)


def merge_scores(audio: List[float], visual: List[float], duration: float) -> List[float]:
    n = int(math.ceil(duration)) if duration else max(len(audio), len(visual), TARGET_SEGMENT_SECONDS)
    n = max(1, n)
    merged: List[float] = []
    for i in range(n):
        a = audio[i] if i < len(audio) else 0.0
        v = visual[i] if i < len(visual) else 0.0
        if audio and visual:
            score = 0.45 * a + 0.55 * v
        elif visual:
            score = v
        elif audio:
            score = a
        else:
            score = 0.0
        merged.append(score)
    return merged


def choose_best_window(scores: List[float], duration: float, target_seconds: int = TARGET_SEGMENT_SECONDS) -> Dict[str, Any]:
    duration = safe_float(duration, len(scores) or target_seconds)
    if duration <= 0:
        duration = len(scores) or target_seconds

    target = int(clamp(target_seconds, MIN_SEGMENT_SECONDS, MAX_SEGMENT_SECONDS))
    if duration < target:
        target = int(max(1, min(duration, MAX_SEGMENT_SECONDS)))

    n = max(len(scores), int(math.ceil(duration)))
    if not scores:
        return {"startTime": 0.0, "endTime": float(target), "clipDuration": float(target), "confidence": 0.0, "analysisMethod": "fallback-no-media-scores"}

    padded = scores + [0.0] * max(0, n - len(scores))
    best_start = 0
    best_score = -1.0
    max_start = max(0, min(len(padded) - target, int(math.floor(duration - target))))
    for start in range(max_start + 1):
        window = padded[start:start + target]
        if not window:
            continue
        avg = sum(window) / len(window)
        peak = max(window)
        early_penalty = 0.08 if start == 0 and duration > target + 10 else 0.0
        score = 0.70 * avg + 0.30 * peak - early_penalty
        if score > best_score:
            best_score = score
            best_start = start

    return {"startTime": float(best_start), "endTime": float(best_start + target), "clipDuration": float(target), "confidence": round(clamp(best_score, 0.0, 1.0), 3), "analysisMethod": "computer-vision-audio-window-score"}


def analyze_best_segment(video_url: str, subject: str = "", scene: str = "", target_seconds: int = TARGET_SEGMENT_SECONDS) -> Dict[str, Any]:
    video_path = download_video(video_url)
    if not video_path:
        return {"ok": False, "error": "Could not download or open video for analysis.", "analysisMethod": "download-failed"}

    duration = ffprobe_duration(str(video_path))
    if not duration:
        try:
            import cv2
            cap = cv2.VideoCapture(str(video_path))
            fps = cap.get(cv2.CAP_PROP_FPS) or 0
            frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
            cap.release()
            if fps and frames:
                duration = frames / fps
        except Exception:
            duration = 0.0

    audio = audio_energy_scores(video_path, duration)
    visual = visual_scores(video_path, duration)
    merged = merge_scores(audio, visual, duration)
    best = choose_best_window(merged, duration, target_seconds)
    best.update({"ok": True, "duration": round(duration, 2), "audioScoresUsed": bool(audio), "visualScoresUsed": bool(visual), "scoreCount": len(merged), "subject": subject, "scene": scene})
    return best
