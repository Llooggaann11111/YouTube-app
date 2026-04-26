#!/usr/bin/env python3

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SOCIAL_UPLOADER_PATH = Path("/Users/logan/Downloads/50 Best Free Vocal Samples/social_uploader.py")


def load_social_uploader():
    spec = importlib.util.spec_from_file_location("social_uploader_external", SOCIAL_UPLOADER_PATH)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Unable to load social uploader from {SOCIAL_UPLOADER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_accounts(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        accounts = payload.get("accounts", [])
        defaults = payload.get("defaults", {})
        if not isinstance(accounts, list):
            return []
        normalized = []
        for account in accounts:
            if not isinstance(account, dict):
                continue
            merged = dict(defaults if isinstance(defaults, dict) else {})
            merged.update(account)
            normalized.append(merged)
        return normalized
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def choose_account(module, accounts_file: Path, requested_name: str) -> tuple[str, dict[str, Any]]:
    payload = module.load_json(accounts_file, {})
    accounts = load_accounts(payload)
    youtube_accounts = [
        account
        for account in accounts
        if str(account.get("platform", "")).strip().lower() == "youtube"
        and bool(account.get("enabled", True))
    ]
    if not youtube_accounts:
        raise SystemExit(f"No enabled YouTube accounts were found in {accounts_file}")

    if requested_name:
        for account in youtube_accounts:
            if str(account.get("name", "")).strip() == requested_name:
                return requested_name, account
        raise SystemExit(f"Requested YouTube account was not found or not enabled: {requested_name}")

    default_account = youtube_accounts[0]
    return str(default_account.get("name", "")).strip(), default_account


def apply_account_env(module, account_payload: dict[str, Any]) -> None:
    overrides = module.build_account_env(account_payload, "youtube")
    for key, value in overrides.items():
        os.environ[key] = value


def upload_state_path(path: Path) -> Path:
    return path.expanduser()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_direct_state(path: Path, entry: dict[str, Any]) -> None:
    current = []
    if path.exists():
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            current = []
    if not isinstance(current, list):
        current = []
    current.append(entry)
    path.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a rendered app video directly to YouTube.")
    parser.add_argument("--video", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--account", default="")
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--accounts-file", required=True)
    parser.add_argument("--state-file", required=True)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    module = load_social_uploader()

    env_file = Path(args.env_file).expanduser()
    accounts_file = Path(args.accounts_file).expanduser()
    direct_state_file = Path(args.state_file).expanduser()
    video_path = Path(args.video).expanduser()
    if not video_path.exists():
        raise SystemExit(f"Rendered video file not found: {video_path}")

    module.load_env_file(env_file)
    account_name, account_payload = choose_account(module, accounts_file, args.account)
    apply_account_env(module, account_payload)

    hashtags = os.environ.get("YOUTUBE_HASHTAGS", module.DEFAULT_YOUTUBE_HASHTAGS).strip()
    description = args.description.strip()
    if hashtags and hashtags not in description:
        description = f"{description}\n\n{hashtags}".strip()
    description = description[:4900]

    if args.dry_run:
        payload = {
            "ok": True,
            "dry_run": True,
            "account": account_name,
            "video": str(video_path),
            "title": args.title[:100],
            "description_preview": description[:600],
            "hashtags": hashtags,
        }
        print(json.dumps(payload, indent=2))
        return 0

    service, privacy_status, category_id = module.build_youtube_service()
    from googleapiclient.http import MediaFileUpload

    request = service.videos().insert(
        part="snippet,status",
        body={
            "snippet": {
                "title": args.title[:100],
                "description": description,
                "tags": module.tag_list(hashtags)[:30],
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        },
        media_body=MediaFileUpload(str(video_path), chunksize=-1, resumable=True),
    )

    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response["id"]
    result = {
        "ok": True,
        "dry_run": False,
        "account": account_name,
        "video": str(video_path),
        "video_id": video_id,
        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
        "uploaded_at": now_iso(),
        "title": args.title[:100],
    }
    save_direct_state(upload_state_path(direct_state_file), result)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
