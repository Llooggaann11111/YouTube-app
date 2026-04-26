#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
FORGE_BOT = Path("/Users/logan/Documents/AI/python-bot/forge_bot.py")
FORGE_CONFIG_FILE = ROOT / ".forge-bot.toml"
FORGE_DAEMON_STATUS_FILE = ROOT / ".forge-bot" / "daemon_status.json"
FORGE_WATCH_REPORT_FILE = ROOT / ".forge-bot" / "watch_report.txt"
FORGE_ONLINE_REPORT_FILE = ROOT / ".forge-bot" / "online_report.txt"
FORGE_INSTALL_SCRIPT = ROOT / "install_forge_bot_launch_agent.sh"
FORGE_LAUNCH_STATUS_SCRIPT = ROOT / "launch_agent_status.sh"
UPLOADER_SCRIPT = Path("/Users/logan/Downloads/50 Best Free Vocal Samples/social_uploader.py")
UPLOADER_PYTHON = Path("/Users/logan/Downloads/50 Best Free Vocal Samples/.social-venv/bin/python")
GENERATED_VIDEOS_DIR = Path("/Users/logan/Downloads/50 Best Free Vocal Samples/generated_videos")
MANIFEST_PATH = Path("/Users/logan/Downloads/50 Best Free Vocal Samples/story_manifest.json")
UPLOADER_ROOT = ROOT / "integrations" / "uploader_runtime"
ENV_FILE = UPLOADER_ROOT / "social_uploader.env"
STATE_FILE = UPLOADER_ROOT / "social_upload_state.json"
ACCOUNTS_FILE = UPLOADER_ROOT / "social_accounts.json"
DIRECT_UPLOAD_SCRIPT = ROOT / "upload_rendered_video.py"
RENDERED_UPLOAD_DIR = ROOT / "rendered_uploads"
DIRECT_RENDER_STATE_FILE = UPLOADER_ROOT / "direct_render_upload_state.json"


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def json_response(handler: SimpleHTTPRequestHandler, payload: dict[str, Any], status: int = 200) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def build_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def run_command(command: list[str], timeout: int) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=build_env(),
        )
    except subprocess.TimeoutExpired as exc:
        return {
            "ok": False,
            "command": command,
            "returncode": None,
            "stdout": exc.stdout or "",
            "stderr": (exc.stderr or "") + f"\nCommand timed out after {timeout} seconds.",
        }
    except OSError as exc:
        return {
            "ok": False,
            "command": command,
            "returncode": None,
            "stdout": "",
            "stderr": str(exc),
        }

    return {
        "ok": completed.returncode == 0,
        "command": command,
        "returncode": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def parse_json_output(text: str) -> Any:
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def pid_is_running(value: Any) -> bool:
    try:
        pid = int(value)
    except (TypeError, ValueError):
        return False
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def forge_daemon_status() -> dict[str, Any]:
    payload = load_json(FORGE_DAEMON_STATUS_FILE, {})
    if not isinstance(payload, dict):
        return {
            "exists": False,
            "running": False,
            "status_file": str(FORGE_DAEMON_STATUS_FILE),
        }

    daemon_pid = payload.get("daemon_pid")
    watch_pid = payload.get("watch_pid")
    daemon_running = pid_is_running(daemon_pid)
    watch_running = pid_is_running(watch_pid)
    status = dict(payload)
    status.update(
        {
            "exists": True,
            "status_file": str(FORGE_DAEMON_STATUS_FILE),
            "daemon_pid_running": daemon_running,
            "watch_pid_running": watch_running,
            "running": payload.get("state") == "running" and daemon_running,
        }
    )
    return status


def uploader_status() -> dict[str, Any]:
    accounts_payload = load_json(ACCOUNTS_FILE, {})
    if isinstance(accounts_payload, dict):
        account_items = accounts_payload.get("accounts", [])
    elif isinstance(accounts_payload, list):
        account_items = accounts_payload
    else:
        account_items = []

    youtube_accounts = [
        {
            "name": str(account.get("name", "")).strip(),
            "enabled": bool(account.get("enabled", False)),
            "topic_preferences": account.get("topic_preferences", []),
        }
        for account in account_items
        if isinstance(account, dict) and str(account.get("platform", "")).strip().lower() == "youtube"
    ]

    state = load_json(STATE_FILE, {})
    youtube_state = state.get("youtube", {}) if isinstance(state, dict) else {}
    multi_account = state.get("multi_account", {}) if isinstance(state, dict) else {}
    raw_account_state = multi_account.get("accounts", {}) if isinstance(multi_account, dict) else {}
    account_state: dict[str, Any] = {}
    if isinstance(raw_account_state, dict):
        for name, payload in raw_account_state.items():
            if not isinstance(payload, dict):
                continue
            uploads = payload.get("uploads", {})
            upload_count = len(uploads) if isinstance(uploads, dict) else 0
            account_state[name] = {
                "platform": payload.get("platform", ""),
                "upload_count": upload_count,
                "last_attempt_at": payload.get("last_attempt_at", ""),
                "last_success_at": payload.get("last_success_at", ""),
                "blocked_until": payload.get("blocked_until", ""),
                "blocked_reason": payload.get("blocked_reason", ""),
            }

    direct_uploads = load_json(DIRECT_RENDER_STATE_FILE, [])
    direct_upload_count = len(direct_uploads) if isinstance(direct_uploads, list) else 0
    last_direct_upload = direct_uploads[-1] if direct_upload_count else None
    daemon_status = forge_daemon_status()

    return {
        "forge_bot_exists": FORGE_BOT.exists(),
        "forge_config_file": str(FORGE_CONFIG_FILE),
        "forge_config_exists": FORGE_CONFIG_FILE.exists(),
        "forge_launch_agent_script_exists": FORGE_INSTALL_SCRIPT.exists(),
        "forge_launch_agent_status_script_exists": FORGE_LAUNCH_STATUS_SCRIPT.exists(),
        "forge_watch_report_exists": FORGE_WATCH_REPORT_FILE.exists(),
        "forge_online_report_exists": FORGE_ONLINE_REPORT_FILE.exists(),
        "forge_daemon": daemon_status,
        "uploader_script_exists": UPLOADER_SCRIPT.exists(),
        "uploader_python_exists": UPLOADER_PYTHON.exists(),
        "generated_videos_dir": str(GENERATED_VIDEOS_DIR),
        "generated_videos_dir_exists": GENERATED_VIDEOS_DIR.exists(),
        "manifest_path": str(MANIFEST_PATH),
        "manifest_exists": MANIFEST_PATH.exists(),
        "env_file": str(ENV_FILE),
        "env_exists": ENV_FILE.exists(),
        "state_file": str(STATE_FILE),
        "state_exists": STATE_FILE.exists(),
        "accounts_file": str(ACCOUNTS_FILE),
        "accounts_exists": ACCOUNTS_FILE.exists(),
        "direct_upload_state_file": str(DIRECT_RENDER_STATE_FILE),
        "direct_upload_count": direct_upload_count,
        "last_direct_upload": last_direct_upload if isinstance(last_direct_upload, dict) else None,
        "youtube_accounts": youtube_accounts,
        "youtube_upload_count": len(youtube_state) if isinstance(youtube_state, dict) else 0,
        "account_runtime_state": account_state if isinstance(account_state, dict) else {},
    }


def forge_result(command_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    prompt = str(payload.get("prompt") or f"{command_name} youtube app workspace").strip()
    command = [
        sys.executable,
        str(FORGE_BOT),
        command_name,
        prompt,
        "--root",
        str(ROOT),
        "--json",
        "--no-ai",
    ]
    if command_name == "fix":
        if payload.get("apply", False):
            command.append("--apply")
        if payload.get("diff", True):
            command.append("--diff")

    result = run_command(command, timeout=180)
    result["parsed"] = parse_json_output(result["stdout"])
    result["status"] = uploader_status()
    return result


def forge_daemon_result(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = str(payload.get("prompt") or "").strip()
    command = ["./install_forge_bot_launch_agent.sh"]
    if prompt:
        command.append(prompt)
    result = run_command(command, timeout=90)
    result["status"] = uploader_status()
    return result


def parse_uploader_summary(stdout: str) -> dict[str, Any]:
    return {
        "uploaded": len(re.findall(r"^\[youtube\] uploaded ", stdout, flags=re.MULTILINE)),
        "skipped": len(re.findall(r"^\[youtube\] skipping ", stdout, flags=re.MULTILINE)),
        "dry_run_items": len(re.findall(r"^\[youtube\] dry-run would upload ", stdout, flags=re.MULTILINE)),
        "refreshed": len(re.findall(r"^\[youtube\] refreshed metadata ", stdout, flags=re.MULTILINE)),
    }


def uploader_result(payload: dict[str, Any]) -> dict[str, Any]:
    python_exec = str(UPLOADER_PYTHON if UPLOADER_PYTHON.exists() else Path(sys.executable))
    account = str(payload.get("account", "")).strip()
    limit = int(payload.get("limit", 1) or 0)
    max_new = int(payload.get("max_new", 0) or 0)
    dry_run = bool(payload.get("dry_run", False))
    force = bool(payload.get("force", False))
    refresh_metadata = bool(payload.get("refresh_youtube_metadata", False))
    replace_existing = bool(payload.get("replace_youtube_existing", False))

    command = [
        python_exec,
        str(UPLOADER_SCRIPT),
        "--platform",
        "youtube",
        "--videos-dir",
        str(GENERATED_VIDEOS_DIR),
        "--manifest",
        str(MANIFEST_PATH),
        "--env-file",
        str(ENV_FILE),
        "--state-file",
        str(STATE_FILE),
        "--accounts-file",
        str(ACCOUNTS_FILE),
    ]

    if account:
        command.extend(["--account", account])
    if limit > 0:
        command.extend(["--limit", str(limit)])
    if max_new > 0:
        command.extend(["--max-new", str(max_new)])
    if dry_run:
        command.append("--dry-run")
    if force:
        command.append("--force")
    if refresh_metadata:
        command.append("--refresh-youtube-metadata")
    if replace_existing:
        command.append("--replace-youtube-existing")

    result = run_command(command, timeout=1800 if not dry_run else 300)
    result["summary"] = parse_uploader_summary(result["stdout"])
    result["status"] = uploader_status()
    return result


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "rendered-video"


def direct_render_upload(
    *,
    raw_body: bytes,
    content_type: str,
    title: str,
    description: str,
    filename: str,
    account: str,
    dry_run: bool,
) -> dict[str, Any]:
    RENDERED_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(filename).suffix or (".webm" if "webm" in content_type.lower() else ".mp4")
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S-%f")
    target = RENDERED_UPLOAD_DIR / f"{safe_slug(title)}-{stamp}{suffix}"
    target.write_bytes(raw_body)

    command = [
        str(UPLOADER_PYTHON if UPLOADER_PYTHON.exists() else Path(sys.executable)),
        str(DIRECT_UPLOAD_SCRIPT),
        "--video",
        str(target),
        "--title",
        title,
        "--description",
        description,
        "--env-file",
        str(ENV_FILE),
        "--accounts-file",
        str(ACCOUNTS_FILE),
        "--state-file",
        str(DIRECT_RENDER_STATE_FILE),
    ]
    if account:
        command.extend(["--account", account])
    if dry_run:
        command.append("--dry-run")

    result = run_command(command, timeout=1800 if not dry_run else 300)
    result["saved_file"] = str(target)
    result["saved_file_size"] = len(raw_body)
    result["parsed"] = parse_json_output(result["stdout"])
    result["status"] = uploader_status()
    return result


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Upload-Filename, X-Upload-Title, X-Upload-Description, X-Upload-Account, X-Dry-Run",
        )
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/status":
            json_response(self, uploader_status())
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b"{}"

        if parsed.path == "/api/render/upload-youtube":
            title = clean_header(self.headers.get("X-Upload-Title")) or "Rendered FactPulse Video"
            description = clean_header(self.headers.get("X-Upload-Description"))
            filename = clean_header(self.headers.get("X-Upload-Filename")) or f"{safe_slug(title)}.webm"
            account = clean_header(self.headers.get("X-Upload-Account"))
            dry_run = clean_header(self.headers.get("X-Dry-Run")).lower() in {"1", "true", "yes", "on"}
            result = direct_render_upload(
                raw_body=raw,
                content_type=self.headers.get("Content-Type", "application/octet-stream"),
                title=title,
                description=description,
                filename=filename,
                account=account,
                dry_run=dry_run,
            )
            json_response(self, result)
            return

        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            json_response(self, {"ok": False, "error": "Invalid JSON body."}, status=400)
            return

        if parsed.path == "/api/forge/inspect":
            json_response(self, forge_result("inspect", payload))
            return
        if parsed.path == "/api/forge/fix":
            json_response(self, forge_result("fix", payload))
            return
        if parsed.path == "/api/forge/daemon/install":
            json_response(self, forge_daemon_result(payload))
            return
        if parsed.path == "/api/youtube/dry-run":
            payload["dry_run"] = True
            json_response(self, uploader_result(payload))
            return
        if parsed.path == "/api/youtube/upload-next":
            payload.setdefault("max_new", 1)
            json_response(self, uploader_result(payload))
            return

        json_response(self, {"ok": False, "error": f"Unknown endpoint: {parsed.path}"}, status=404)


def clean_header(value: str | None) -> str:
    return (value or "").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the FactPulse app with local bot and uploader APIs.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"Serving app bridge on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 130
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
