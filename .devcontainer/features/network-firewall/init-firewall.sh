#!/bin/sh
set -e

# Network Firewall Initialization Script
# Configures iptables to whitelist only approved domains for:
# - Claude CLI (api.anthropic.com, statsig.anthropic.com)
# - GitHub CLI (GitHub IP ranges via /meta API)
# - Context7 MCP (mcp.context7.com, context7.com)
# - Package Registry (registry.npmjs.org)

echo "Initializing network firewall..."

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F 2>/dev/null || true
iptables -t nat -X 2>/dev/null || true
iptables -t mangle -F 2>/dev/null || true
iptables -t mangle -X 2>/dev/null || true
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q | while read -r cidr; do
    # Validate CIDR format
    case "$cidr" in
        [0-9]*.[0-9]*.[0-9]*.[0-9]*/[0-9]*)
            echo "Adding GitHub range $cidr"
            ipset add allowed-domains "$cidr"
            ;;
        *)
            echo "WARNING: Skipping invalid CIDR from GitHub meta: $cidr"
            ;;
    esac
done

# Resolve and add allowed domains
# Claude CLI domains
ALLOWED_DOMAINS="
api.anthropic.com
statsig.anthropic.com
"

# Context7 MCP domains
ALLOWED_DOMAINS="$ALLOWED_DOMAINS
mcp.context7.com
context7.com
"

# Package registry
ALLOWED_DOMAINS="$ALLOWED_DOMAINS
registry.npmjs.org
"

for domain in $ALLOWED_DOMAINS; do
    [ -z "$domain" ] && continue
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "WARNING: Failed to resolve $domain - skipping"
        continue
    fi

    echo "$ips" | while read -r ip; do
        # Validate IP format
        case "$ip" in
            [0-9]*.[0-9]*.[0-9]*.[0-9]*)
                echo "Adding $ip for $domain"
                ipset add allowed-domains "$ip" 2>/dev/null || true
                ;;
            *)
                echo "WARNING: Invalid IP from DNS for $domain: $ip"
                ;;
        esac
    done
done

# Handle additional hosts if provided via environment variable
if [ -n "${ADDITIONAL_FIREWALL_HOSTS:-}" ]; then
    echo "Processing additional hosts: $ADDITIONAL_FIREWALL_HOSTS"
    echo "$ADDITIONAL_FIREWALL_HOSTS" | tr ',' '\n' | while read -r domain; do
        [ -z "$domain" ] && continue
        domain=$(echo "$domain" | xargs)  # trim whitespace
        echo "Resolving additional domain $domain..."
        ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
        if [ -n "$ips" ]; then
            echo "$ips" | while read -r ip; do
                case "$ip" in
                    [0-9]*.[0-9]*.[0-9]*.[0-9]*)
                        echo "Adding $ip for $domain"
                        ipset add allowed-domains "$ip" 2>/dev/null || true
                        ;;
                esac
            done
        fi
    done
fi

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "WARNING: Failed to detect host IP - continuing anyway"
else
    HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
    echo "Host network detected as: $HOST_NETWORK"

    # Allow traffic to/from host network (for SSH, dev server, etc.)
    iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
    iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT
fi

# Set default policies to DROP
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow only specific outbound traffic to allowed domains
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Firewall configuration complete"
echo ""
echo "Verifying firewall rules..."

# Verify that blocked domain is blocked
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "  [PASS] Blocked: example.com (as expected)"
fi

# Verify Anthropic API access
if ! curl --connect-timeout 5 https://api.anthropic.com >/dev/null 2>&1; then
    echo "  [WARN] Unable to reach api.anthropic.com - may need authentication"
else
    echo "  [PASS] Allowed: api.anthropic.com"
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "  [PASS] Allowed: api.github.com"
fi

echo ""
echo "Firewall initialization complete!"
