#!/bin/bash
set -euo pipefail

REGISTRY_FILE="/workspace/.claude-sessions/registry.json"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

if [ -f "$REGISTRY_FILE" ]; then
    jq --arg id "$SESSION_ID" 'del(.sessions[$id])' \
       "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp" && mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
fi
