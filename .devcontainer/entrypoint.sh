#!/bin/bash
# Container entrypoint - runs initialization scripts before main command

# Copy Claude credentials from host (read-only mount) to container-local storage
# This prevents credential corruption from race conditions between host and container
if [ -f /tmp/host-credentials.json ] && [ -s /tmp/host-credentials.json ]; then
    mkdir -p /home/dev/.claude
    cp /tmp/host-credentials.json /home/dev/.claude/.credentials.json
    chown dev:dev /home/dev/.claude/.credentials.json
    chmod 600 /home/dev/.claude/.credentials.json
fi

if [ -f /tmp/host-claude.json ] && [ -s /tmp/host-claude.json ]; then
    cp /tmp/host-claude.json /home/dev/.claude.json
    chown dev:dev /home/dev/.claude.json
    chmod 600 /home/dev/.claude.json
fi

# Initialize Claude plugins (runs as root, script handles permissions)
/usr/local/bin/init-claude-plugins.sh

# Execute the original command (sshd)
exec "$@"
