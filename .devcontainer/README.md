# Devcontainer

Docker-based development environment with Claude Code, SSH access, and Vite dev server.

## Quick Start

```bash
cd .devcontainer

# Start the container
just up

# SSH into the container
just ssh
# Password: devpass

# Run Claude Code
just claude
```

## Justfile Commands

| Command | Description |
|---------|-------------|
| `just up` | Start the container |
| `just down` | Stop the container |
| `just ssh` | SSH into the container |
| `just claude` | Run Claude Code in the container |
| `just rebuild` | Rebuild container from scratch |
| `just extract-credentials` | Extract OAuth credentials from macOS Keychain |
| `just refresh-auth` | Extract credentials and restart container |

## Ports

| Port | Service |
|------|---------|
| 2222 | SSH |
| 5173 | Vite dev server |

## Claude Code Authentication

Claude Code in the container uses credentials from your host machine. Three files are mounted:

1. **`~/.claude.json`** - Settings and project trust configuration
2. **`~/.claude.json` → `/home/dev/.claude.json`** - Mounted read-write so Claude can update settings
3. **`.credentials.json` → `/home/dev/.claude/.credentials.json`** - OAuth tokens (read-only)

### Setting Up Authentication

1. **Authenticate Claude Code on your host first:**
   ```bash
   claude
   ```

2. **Extract OAuth credentials and start container:**
   ```bash
   cd .devcontainer
   just refresh-auth
   ```

### Refreshing Expired Tokens

OAuth tokens expire. If you get authentication errors:

```bash
just refresh-auth
```

This extracts fresh credentials from your macOS Keychain and restarts the container.

## GitHub CLI Authentication

GitHub CLI (`gh`) config is stored in a named Docker volume, so authentication persists across container restarts.

### First-Time Setup

SSH into the container and authenticate:

```bash
just ssh
gh auth login
```

Choose:
- **GitHub.com**
- **SSH** (recommended, since `~/.ssh` is mounted from host)
- Use existing SSH key or authenticate via browser

### Using SSH Keys from Host

Your `~/.ssh` directory is mounted read-only into the container. If you have SSH keys configured for GitHub on your host, `gh` can use them:

```bash
gh auth login -p ssh
```

### Verifying Authentication

```bash
gh auth status
```

### Re-authenticating

If auth expires or you need to switch accounts:

```bash
gh auth logout
gh auth login
```

The named volume `devcontainer-gh-config` persists your auth between container rebuilds. To fully reset, remove the volume:

```bash
docker volume rm devcontainer_devcontainer-gh-config
```

## Volumes

| Host | Container | Purpose |
|------|-----------|---------|
| `..` (project root) | `/workspace` | Project files |
| `~/.ssh` | `/home/dev/.ssh` | SSH keys (read-only) |
| `~/.claude.json` | `/home/dev/.claude.json` | Claude settings |
| `.credentials.json` | `/home/dev/.claude/.credentials.json` | OAuth tokens |
| Named volume | `/home/dev/.claude` | Claude cache/state |
| Named volume | `/home/dev/.config/gh` | GitHub CLI config |

## Environment Variables

- `ANTHROPIC_API_KEY` - Optional API key (alternative to OAuth)
- `VITE_HOST=0.0.0.0` - Allows Vite to accept external connections
