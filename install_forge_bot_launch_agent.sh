#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROMPT="${1:-keep this YouTube app healthy, tighten clip relevance, apply safe fixes, and run conservative online checks}"
LABEL="com.forge.bot.youtubeapp.v15"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$LABEL.plist"
RUNTIME_DIR="$HOME/Library/Application Support/ForgeBotYouTubeAppV15"
RUNTIME_SCRIPT="$RUNTIME_DIR/run_forge_bot_daemon.sh"
STDOUT_PATH="$ROOT_DIR/.forge-bot/launchd.out.log"
STDERR_PATH="$ROOT_DIR/.forge-bot/launchd.err.log"
UID_VALUE="$(id -u)"
RUNNER="$ROOT_DIR/run_forge_bot_daemon.sh"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$ROOT_DIR/.forge-bot"
mkdir -p "$RUNTIME_DIR"
cp "$RUNNER" "$RUNTIME_SCRIPT"
chmod +x "$RUNNER" "$RUNTIME_SCRIPT"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$RUNTIME_SCRIPT</string>
    <string>$ROOT_DIR</string>
    <string>$PROMPT</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$RUNTIME_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$STDOUT_PATH</string>
  <key>StandardErrorPath</key>
  <string>$STDERR_PATH</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$UID_VALUE" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_VALUE" "$PLIST_PATH"
launchctl enable "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$UID_VALUE/$LABEL"

echo "Installed LaunchAgent: $PLIST_PATH"
echo "Label: $LABEL"
echo "Target root: $ROOT_DIR"
echo "Runner: $RUNTIME_SCRIPT"
echo "Status file: $ROOT_DIR/.forge-bot/daemon_status.json"
