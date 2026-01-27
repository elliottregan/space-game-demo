#!/bin/bash
# Container entrypoint - runs initialization scripts before main command

# Initialize Claude plugins (runs as root, script handles permissions)
/usr/local/bin/init-claude-plugins.sh

# Execute the original command (sshd)
exec "$@"
