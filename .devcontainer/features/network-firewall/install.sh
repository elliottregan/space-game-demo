#!/bin/sh
set -e

echo "Installing network-firewall feature dependencies..."

# Install required packages for Alpine Linux
apk add --no-cache \
    iptables \
    ipset \
    curl \
    jq \
    bind-tools \
    iproute2

# Copy the firewall init script to a standard location
cp "$(dirname "$0")/init-firewall.sh" /usr/local/bin/init-firewall.sh
chmod +x /usr/local/bin/init-firewall.sh

echo "Network firewall feature installed successfully"
