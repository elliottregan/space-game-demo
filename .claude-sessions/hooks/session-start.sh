#!/bin/bash
set -euo pipefail

REGISTRY_FILE="/workspace/.claude-sessions/registry.json"
mkdir -p "$(dirname "$REGISTRY_FILE")"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
CWD=$(echo "$INPUT" | jq -r '.cwd')

BRANCH=""
if [[ "$CWD" == *".worktrees"* ]]; then
    BRANCH=$(basename "$CWD")
else
    BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "main")
fi

SESSION_NAME=$(echo "$BRANCH" | sed 's/^fix-//' | sed 's/^feature-//' | cut -c1-20)
CONTAINER=$(hostname)

SESSION_JSON=$(jq -n \
    --arg id "$SESSION_ID" \
    --arg name "$SESSION_NAME" \
    --arg status "working" \
    --arg worktree "$CWD" \
    --arg branch "$BRANCH" \
    --arg container "$CONTAINER" \
    --arg started "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{
        id: $id,
        name: $name,
        status: $status,
        worktree: $worktree,
        branch: $branch,
        container: $container,
        pid: 0,
        started_at: $started,
        last_activity: $started,
        context_remaining: 100,
        last_message: "",
        tasks: []
    }')

if [ -f "$REGISTRY_FILE" ]; then
    REGISTRY=$(cat "$REGISTRY_FILE")
else
    REGISTRY='{"sessions":{}}'
fi

echo "$REGISTRY" | jq --arg id "$SESSION_ID" --argjson session "$SESSION_JSON" \
    '.sessions[$id] = $session' > "$REGISTRY_FILE"
