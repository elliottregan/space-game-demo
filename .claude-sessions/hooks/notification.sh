#!/bin/bash
set -euo pipefail

REGISTRY_FILE="/workspace/.claude-sessions/registry.json"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
STATUS="waiting"

TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
LAST_MESSAGE=""
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    LAST_MESSAGE=$(tail -1 "$TRANSCRIPT_PATH" | jq -r '.message.content[0].text // empty' 2>/dev/null | head -c 100 || echo "")
fi

if [ -f "$REGISTRY_FILE" ]; then
    jq --arg id "$SESSION_ID" \
       --arg status "$STATUS" \
       --arg activity "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg message "$LAST_MESSAGE" \
       '.sessions[$id].status = $status |
        .sessions[$id].last_activity = $activity |
        .sessions[$id].last_message = $message' \
       "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp" && mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
fi
