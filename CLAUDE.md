# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun install` - Install dependencies
- `bun run dev` - Start Vite dev server with HMR
- `bun run build` - Production build
- `bun run preview` - Preview production build
- `bun run lint` - Lint with oxlint
- `bun run lint:fix` - Lint and auto-fix with oxlint
- `bun run format` - Format with oxfmt
- `bun run format:check` - Check formatting with oxfmt
- `bun test` - Run all tests
- `bun test tests/ResourceManager.test.ts` - Run single test file
- `bun run simulate` - Run game simulation
- `bun run simulate:analyze` - Analyze simulation results
- `bun run visualize` - Start visualization server for simulation analysis

## Architecture

### Core/Renderer Separation

The game uses a strict separation between game logic and UI:

- **`src/core/`** - Pure TypeScript game logic, no Vue dependencies
  - `GameState.ts` - Central orchestrator that owns all system managers
  - `systems/` - Manager classes (ResourceManager, BuildingManager, TechnologyTree, etc.)
  - `models/` - Type definitions and interfaces
  - `data/` - Static game data (buildings, technologies, events, factions)
  - `balance/` - Game balance constants
  - `utils/` - Core utility functions
  - `events/` - Event system

- **`src/renderer/`** - Vue 3 frontend
  - `services/GameService.ts` - Singleton bridge between core and Vue, exposes reactive `GameUIState`
  - `components/` - Vue SFCs for each game panel
  - `composables/` - Vue composables for shared logic
  - `directives/` - Custom Vue directives (e.g., `v-resource-glow`)
  - `ui/` - Reusable UI components

- **`src/facade/`** - Domain-driven API layer
  - `GameAPI.ts` - Main facade exposing domain-specific APIs
  - `domains/` - Domain facades (Buildings, Colony, Operations, etc.)

- **`src/simulation/`** - Headless game simulation for testing balance
  - `SimulationRunner.ts` - Runs automated game sessions
  - `HeuristicStrategy.ts` - AI decision-making for simulations
  - `MetricsCollector.ts` - Collects game metrics for analysis

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
- Use `// oxlint-disable-next-line no-unused-vars` for template-only functions

## Testing

Tests are in the `tests/` directory using Bun's test runner. Test files cover:
- Core systems (ResourceManager, WorkforceManager, TechnologyTree)
- Facades (GameFacade, BuildingsFacade, ColonyFacade, OperationsFacade)
- Game mechanics (building maintenance, recycling, deposits, expeditions)
- Political systems (policies, NPC influence, pressure)

## Simulation & Balance Testing

Monte Carlo simulations test game balance by running automated playthroughs with AI decision-making.

### Running Simulations

```bash
# Quick simulation (5 runs, fast)
bun run scripts/simulate.ts --runs 5 --verbose

# Full analysis with detailed output (saves to logs/simulations/)
bun run scripts/analyze-simulation.ts --runs 100 --seed 42

# Start visualization server for results
bun run visualize
```

### Analysis Output

`simulate:analyze` produces reports including:
- **Victory Time Distribution** - Min/median/mean/P90/max sols to win
- **Peak Population Analysis** - Population growth statistics
- **Technology Research Frequency** - Which techs get researched
- **Building Construction** - Average buildings built per game
- **Bottleneck Analysis** - What blocks the AI most often
- **Event Impact Analysis** - Event frequency and effect on outcomes
- **Crisis Timeline** - When resource/morale crises occur

Results saved to `logs/simulations/` as both `.txt` (human-readable) and `.json` (data).

### Key Metrics to Watch

| Metric | Healthy Range | Concern |
|--------|---------------|---------|
| Win Rate | 80-95% | Too easy if 100%, too hard if <70% |
| Median Victory | 500-1000 sols | Faster = too easy, slower = tedious |
| Bottleneck % | <50% per category | High % = balance issue |
| Crisis Frequency | Occasional | Constant crises = resource balance off |

## Documentation

- **`MANUAL.md`** - Player-facing game manual with mechanics, strategy guide, and quick reference
- **`docs/specs/`** - Technical specifications for game systems
- **`docs/plans/`** - Implementation plans for features

## Development Workflow

### Feature Work
For significant features, use git worktrees to isolate work from the main branch.

### Pull Requests
All changes should go through pull requests. Use `/commit-push-pr` or create PRs manually.

### Subagent-Driven Development
When executing implementation plans, use `superpowers:subagent-driven-development` to parallelize independent tasks.
