#!/bin/bash
set -euo pipefail

REGISTRY_FILE="/workspace/.claude-sessions/registry.json"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input')

if [ "$TOOL_NAME" = "TaskCreate" ]; then
    TASK_ID=$(echo "$TOOL_INPUT" | jq -r '.id // empty')
    SUBJECT=$(echo "$TOOL_INPUT" | jq -r '.subject // empty')
    STATUS="pending"
elif [ "$TOOL_NAME" = "TaskUpdate" ]; then
    TASK_ID=$(echo "$TOOL_INPUT" | jq -r '.taskId // empty')
    SUBJECT=$(echo "$TOOL_INPUT" | jq -r '.subject // empty')
    STATUS=$(echo "$TOOL_INPUT" | jq -r '.status // empty')
fi

[ -z "$TASK_ID" ] && exit 0

if [ -f "$REGISTRY_FILE" ]; then
    EXISTING=$(jq -r --arg id "$SESSION_ID" --arg tid "$TASK_ID" \
        '.sessions[$id].tasks // [] | map(select(.id == $tid)) | length' \
        "$REGISTRY_FILE")

    if [ "$EXISTING" = "0" ] && [ "$TOOL_NAME" = "TaskCreate" ]; then
        jq --arg id "$SESSION_ID" \
           --arg tid "$TASK_ID" \
           --arg subject "$SUBJECT" \
           --arg status "${STATUS:-pending}" \
           '.sessions[$id].tasks += [{"id": $tid, "subject": $subject, "status": $status}]' \
           "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp" && mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
    elif [ -n "$STATUS" ]; then
        jq --arg id "$SESSION_ID" \
           --arg tid "$TASK_ID" \
           --arg status "$STATUS" \
           '(.sessions[$id].tasks[] | select(.id == $tid)).status = $status' \
           "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp" && mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
    fi
fi
