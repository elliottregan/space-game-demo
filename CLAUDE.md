# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun install` - Install dependencies
- `bun run dev` - Start Vite dev server with HMR
- `bun run build` - Production build
- `bun run lint` - Lint with Biome
- `bun run format` - Format with Biome
- `bun test` - Run all tests
- `bun test tests/ResourceManager.test.ts` - Run single test file

## Architecture

### Core/Renderer Separation

The game uses a strict separation between game logic and UI:

- **`src/core/`** - Pure TypeScript game logic, no Vue dependencies
  - `GameState.ts` - Central orchestrator that owns all system managers
  - `systems/` - Manager classes (ResourceManager, BuildingManager, TechnologyTree, etc.)
  - `models/` - Type definitions and interfaces
  - `data/` - Static game data (buildings, technologies, events, factions)
  - `balance/` - Game balance constants

- **`src/renderer/`** - Vue 3 frontend
  - `services/GameService.ts` - Singleton bridge between core and Vue, exposes reactive `GameUIState`
  - `components/` - Vue SFCs for each game panel
  - `directives/` - Custom Vue directives (e.g., `v-resource-glow`)

### Game Loop

`GameState.tick()` executes systems in order: Resources → Buildings → Workforce → Colony → Technology → Politics → Operations → Events → Victory. Each system returns `GameEvent[]` for the event log.

### Data Flow

1. Core `GameState` holds authoritative game state in manager classes
2. `GameService.syncState()` copies core state into Vue `reactive()` object
3. Components read from `gameService.getState()` (readonly)
4. User actions call `GameService` methods which mutate core state and re-sync

### Building Model

Buildings have three resource-related properties:
- `cost: ResourceDelta` - One-time construction cost
- `production?: ResourceDelta` - Ongoing production per sol
- `consumption?: ResourceDelta` - Ongoing consumption per sol

## Vue Patterns

- When updating `reactive()` object properties, modify in-place (delete then assign) rather than replacing the entire nested object for reliable reactivity
- Semantic CSS variables defined in `App.vue` `:root`: `--color-positive`, `--color-negative`, `--color-danger`, `--color-warning`, `--color-info`, `--color-muted`
- Use `// biome-ignore lint/correctness/noUnusedVariables: used in template` for template-only functions
