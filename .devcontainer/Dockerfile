FROM oven/bun:alpine

# Install system dependencies for Claude Code, SSH, and GitHub CLI
RUN apk add --no-cache \
    git curl ca-certificates openssh sudo github-cli bash \
    libgcc libstdc++ ripgrep

# Configure SSH
RUN mkdir -p /var/run/sshd && \
    ssh-keygen -A && \
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config && \
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

# Create non-root user
RUN adduser -D -s /bin/bash dev && \
    adduser dev wheel && \
    echo 'dev ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers.d/dev

# Set default password for dev user
RUN echo 'dev:devpass' | chpasswd

# Install Claude Code as dev user
USER dev
ENV PATH="/home/dev/.local/bin:$PATH"
RUN curl -fsSL https://claude.ai/install.sh | bash
USER root

# Workspace setup
RUN mkdir -p /workspace && chown dev:dev /workspace
RUN mkdir -p /home/dev/.claude && chown dev:dev /home/dev/.claude

WORKDIR /workspace
EXPOSE 22 5173

CMD ["/usr/sbin/sshd", "-D"]
