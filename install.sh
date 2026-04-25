#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# travel-video skill installer
# Installs the /travel-video slash command into Claude Code's commands dir.
#
# Usage: bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMANDS_DIR="$HOME/.claude/commands"

mkdir -p "$COMMANDS_DIR"

# Copy slash command, embedding the absolute path to this skill's template
sed "s|SKILL_TEMPLATE_PATH|$SKILL_DIR/template|g" \
    "$SKILL_DIR/command/travel-video.md" \
    > "$COMMANDS_DIR/travel-video.md"

echo "✅ Installed /travel-video command to $COMMANDS_DIR/travel-video.md"
echo ""
echo "Usage in Claude Code:"
echo "  /travel-video"
echo ""
echo "Template files at: $SKILL_DIR/template/"
