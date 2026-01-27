FROM oven/bun:alpine

# Install system dependencies for Claude Code, SSH, and GitHub CLI
RUN apk add --no-cache \
    git git-init-template curl ca-certificates openssh sudo github-cli bash \
    # Claude Code dependencies for native install
    libgcc libstdc++ ripgrep \
    # Context7 dependencies for install
    nodejs \
    # Firewall dependencies
    iptables ipset bind-tools jq iproute2

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
# Use HTTPS for GitHub (container doesn't have SSH agent access)
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
USER root

# Workspace setup
RUN mkdir -p /workspace && chown dev:dev /workspace
RUN mkdir -p /home/dev/.claude && chown dev:dev /home/dev/.claude

# Copy Claude authentication files from host
# Note: These must exist - host must have authenticated Claude Code first
# COPY .claude.json /tmp/.claude.json

# Copy firewall initialization script
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
RUN chmod +x /usr/local/bin/init-firewall.sh

# Copy Claude plugins initialization script
COPY init-claude-plugins.sh /usr/local/bin/init-claude-plugins.sh
RUN chmod +x /usr/local/bin/init-claude-plugins.sh

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /workspace
EXPOSE 22 5173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/sbin/sshd", "-D"]
