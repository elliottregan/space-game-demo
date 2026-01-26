[![Netlify Status](https://api.netlify.com/api/v1/badges/c082b432-c638-4e6a-8af5-8d3b001c78b2/deploy-status)](https://app.netlify.com/projects/space-game-demo/deploys)

# Space Colony Simulation

A Mars colony management game built with Vue 3 and TypeScript. Manage resources, construct buildings, research technologies, and guide your colony to prosperity.

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** Vue 3 with Composition API
- **Build:** Vite
- **Language:** TypeScript
- **Linting:** Biome
- **Visualization:** D3.js

## Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server with HMR |
| `bun run build` | Production build |
| `bun run preview` | Preview production build |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun test` | Run all tests |
| `bun run simulate` | Run game simulation |

## Architecture

The game uses a strict separation between game logic and UI:

- **`src/core/`** - Pure TypeScript game logic with no Vue dependencies
  - `GameState.ts` - Central orchestrator owning all system managers
  - `systems/` - Manager classes (Resources, Buildings, Technology, etc.)
  - `models/` - Type definitions and interfaces
  - `data/` - Static game data (buildings, technologies, events, factions)

- **`src/renderer/`** - Vue 3 frontend
  - `services/GameService.ts` - Singleton bridge between core and Vue
  - `components/` - Vue SFCs for each game panel

## License

MIT
