FROM oven/bun:1-debian

# Install system dependencies for Claude Code and SSH
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates openssh-server sudo nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Configure SSH
RUN mkdir -p /var/run/sshd && \
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config && \
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

# Create non-root user
RUN useradd -m -s /bin/bash -G sudo dev && \
    echo 'dev ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/dev

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# Workspace setup
RUN mkdir -p /workspace && chown dev:dev /workspace
RUN mkdir -p /home/dev/.claude && chown dev:dev /home/dev/.claude

WORKDIR /workspace
EXPOSE 22 5173

CMD ["/usr/sbin/sshd", "-D"]
