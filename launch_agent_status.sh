#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.forge.bot.youtubeapp.v15"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
STATUS_FILE="$ROOT_DIR/.forge-bot/daemon_status.json"
UID_VALUE="$(id -u)"

echo "LaunchAgent plist: $PLIST_PATH"
if [[ -f "$PLIST_PATH" ]]; then
  echo "Plist exists: yes"
else
  echo "Plist exists: no"
fi

echo
echo "launchctl:"
launchctl print "gui/$UID_VALUE/$LABEL" 2>/dev/null || echo "not loaded"

echo
echo "daemon status:"
if [[ -f "$STATUS_FILE" ]]; then
  cat "$STATUS_FILE"
else
  echo "status file missing"
fi
