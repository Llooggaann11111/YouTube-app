#!/usr/bin/env python3
"""Upload a rendered FactPulse video to YouTube.

This script keeps secrets local. Do not commit client secret JSON files or token JSON files.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def load_credentials(client_secrets: Path, token_file: Path) -> Credentials:
    creds: Credentials | None = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        if not client_secrets.exists():
            raise SystemExit(f"Client secrets file not found: {client_secrets}")
        flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
        creds = flow.run_local_server(port=0)

    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(creds.to_json(), encoding="utf-8")
    return creds


def upload_video(
    *,
    video_path: Path,
    title: str,
    description: str,
    tags: list[str],
    privacy: str,
    category_id: str,
    client_secrets: Path,
    token_file: Path,
) -> dict[str, Any]:
    creds = load_credentials(client_secrets, token_file)
    youtube = build("youtube", "v3", credentials=creds)

    request = youtube.videos().insert(
        part="snippet,status",
        body={
            "snippet": {
                "title": title[:100],
                "description": description[:4900],
                "tags": tags[:30],
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy,
                "selfDeclaredMadeForKids": False,
            },
        },
        media_body=MediaFileUpload(str(video_path), chunksize=-1, resumable=True),
    )

    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response["id"]
    return {
        "ok": True,
        "video_id": video_id,
        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
        "title": title[:100],
        "privacy": privacy,
    }


def parse_tags(value: str) -> list[str]:
    parts = []
    for item in value.replace("#", " #").replace(",", " ").split():
        item = item.strip()
        if not item:
            continue
        parts.append(item.lstrip("#"))
    return parts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload a rendered video to YouTube.")
    parser.add_argument("--video", required=True, help="Path to the rendered video file.")
    parser.add_argument("--title", required=True, help="YouTube title.")
    parser.add_argument("--description", default="", help="YouTube description.")
    parser.add_argument("--tags", default="shorts,didyouknow,facts", help="Comma or space separated tags.")
    parser.add_argument("--privacy", default=os.getenv("YOUTUBE_PRIVACY_STATUS", "private"), choices=["private", "unlisted", "public"])
    parser.add_argument("--category-id", default=os.getenv("YOUTUBE_CATEGORY_ID", "27"))
    parser.add_argument("--client-secrets", default=os.getenv("YOUTUBE_CLIENT_SECRETS", "integrations/uploader_runtime/youtube_client_secret.json"))
    parser.add_argument("--token-file", default=os.getenv("YOUTUBE_TOKEN_FILE", "integrations/uploader_runtime/.youtube_token.json"))
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    video_path = Path(args.video).expanduser()
    if not video_path.exists():
        raise SystemExit(f"Video file not found: {video_path}")

    payload = {
        "video": str(video_path),
        "title": args.title[:100],
        "description_preview": args.description[:400],
        "tags": parse_tags(args.tags),
        "privacy": args.privacy,
        "category_id": args.category_id,
        "client_secrets": args.client_secrets,
        "token_file": args.token_file,
    }

    if args.dry_run:
        payload["ok"] = True
        payload["dry_run"] = True
        print(json.dumps(payload, indent=2))
        return 0

    result = upload_video(
        video_path=video_path,
        title=args.title,
        description=args.description,
        tags=parse_tags(args.tags),
        privacy=args.privacy,
        category_id=args.category_id,
        client_secrets=Path(args.client_secrets).expanduser(),
        token_file=Path(args.token_file).expanduser(),
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
