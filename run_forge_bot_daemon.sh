#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ $# -ge 1 && -d "$1" ]]; then
  ROOT_DIR="$1"
  shift
fi

BOT_DIR="/Users/logan/Documents/AI/python-bot"
BOT_PY="$BOT_DIR/forge_bot.py"
PROMPT="${1:-keep this YouTube app healthy, tighten clip relevance, apply safe fixes, and run conservative online checks}"
STATUS_FILE="$ROOT_DIR/.forge-bot/daemon_status.json"
STATE_FILE="$ROOT_DIR/.forge-bot/watch_state.json"

PYTHON_BIN=""
for candidate in \
  /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 \
  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 \
  /opt/homebrew/bin/python3 \
  /usr/local/bin/python3 \
  /usr/bin/python3
do
  if [[ -x "$candidate" ]]; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "python3 was not found for the Forge bot daemon." >&2
  exit 127
fi

if [[ ! -f "$BOT_PY" ]]; then
  echo "Forge Bot was not found at $BOT_PY" >&2
  exit 1
fi

export PATH="$(dirname "$PYTHON_BIN"):/Users/logan/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
exec "$PYTHON_BIN" "$BOT_PY" daemon "$PROMPT" \
  --root "$ROOT_DIR" \
  --config "$ROOT_DIR/.forge-bot.toml" \
  --interval 10 \
  --restart-delay 10 \
  --status-file "$STATUS_FILE" \
  --state-file "$STATE_FILE" \
  --no-ai
