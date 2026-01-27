#!/bin/bash
# Initialize Claude plugins from host configuration on first run

PLUGINS_DIR="/home/dev/.claude/plugins"
HOST_PLUGINS_DIR="/tmp/host-claude-plugins"
MARKER_FILE="$PLUGINS_DIR/.initialized"

# Skip if already initialized
if [ -f "$MARKER_FILE" ]; then
    exit 0
fi

# Fix ownership of plugins directory (volume may be owned by root)
sudo chown -R dev:dev "$PLUGINS_DIR"

# Ensure plugins directory exists
mkdir -p "$PLUGINS_DIR"

# Copy and transform known_marketplaces.json if it exists
if [ -f "$HOST_PLUGINS_DIR/known_marketplaces.json" ]; then
    sed 's|/Users/[^/]*/\.claude|/home/dev/.claude|g' \
        "$HOST_PLUGINS_DIR/known_marketplaces.json" > "$PLUGINS_DIR/known_marketplaces.json"
    echo "Copied and transformed known_marketplaces.json"
fi

# Copy config.json if it exists (no path transformation needed)
if [ -f "$HOST_PLUGINS_DIR/config.json" ]; then
    cp "$HOST_PLUGINS_DIR/config.json" "$PLUGINS_DIR/config.json"
    echo "Copied config.json"
fi

# Mark as initialized
touch "$MARKER_FILE"

# Ensure dev user owns everything in plugins directory
chown -R dev:dev "$PLUGINS_DIR"

echo "Claude plugins initialized from host configuration"
