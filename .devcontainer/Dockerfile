FROM oven/bun:alpine

# Install system dependencies for Claude Code, SSH, and GitHub CLI
RUN apk add --no-cache \
    git curl ca-certificates openssh sudo nodejs npm github-cli bash

# Configure SSH - key-based authentication only (no passwords)
RUN mkdir -p /var/run/sshd && \
    ssh-keygen -A && \
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config && \
    echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config && \
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

# Create non-root user (no password set - SSH key auth only)
RUN adduser -D -s /bin/bash dev && \
    adduser dev wheel && \
    echo 'dev ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/dev

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# Workspace setup
RUN mkdir -p /workspace && chown dev:dev /workspace
RUN mkdir -p /home/dev/.claude && chown dev:dev /home/dev/.claude

WORKDIR /workspace
EXPOSE 22 5173

CMD ["/usr/sbin/sshd", "-D"]
