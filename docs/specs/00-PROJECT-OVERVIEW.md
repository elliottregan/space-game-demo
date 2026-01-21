# Mars Colony Roguelike - Project Overview

## Game Concept

A turn-based roguelike strategy game set on Mars, focusing on colony management, technology progression, and political dynamics. The game spans generations and uses time/distance as core gameplay mechanics.

## Demo Scope

The initial demo focuses on the **Mars Colony Phase**:
- Establish a self-sufficient colony on Mars
- Manage resources (food, oxygen, power, materials, water)
- Research technologies to unlock new capabilities
- Navigate political factions with competing interests
- Train colonists in specialized roles
- Respond to random events and crises
- Win condition: Research Generation Ship technology OR reach 100 population
- Loss condition: Colony collapse (population < 5, critical resources depleted)

## Technology Stack

### Core Stack
- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Linting/Formatting**: Biome
- **Client Framework**: Vue 3 (Composition API with `<script setup>`)

### Architecture Principles

1. **Separation of Concerns**
   - Core game logic in pure TypeScript (no Vue dependencies)
   - Vue components handle ONLY rendering and user interaction
   - Game state is read-only in Vue (mutations happen through service layer)

2. **Project Structure**
   ```
   /
   ├── src/
   │   ├── core/              # Pure TypeScript game logic
   │   │   ├── models/        # Data structures and types
   │   │   ├── systems/       # Game systems (ResourceManager, etc.)
   │   │   ├── events/        # Event bus and event types
   │   │   ├── data/          # Static game data (buildings, techs, events)
   │   │   ├── balance/       # Balance constants and calculators
   │   │   └── GameState.ts   # Main game state container
   │   │
   │   ├── renderer/          # Vue application
   │   │   ├── components/    # Vue components
   │   │   ├── services/      # Adapters between core and UI
   │   │   ├── composables/   # Vue composables
   │   │   └── App.vue        # Root component
   │   │
   │   └── main.ts            # Entry point
   │
   ├── tests/                 # Test files
   ├── biome.json            # Biome configuration
   ├── tsconfig.json         # TypeScript configuration
   └── package.json
   ```

3. **Data Flow**
   ```
   User Action → Vue Component → GameService → Core Systems → GameState
                                                              ↓
   User sees result ← Vue Component ← Reactive State ← EventBus
   ```

## Core Game Loop

**Phase-Based Turn System:**

1. **Planning Phase** - Player makes decisions
   - Build buildings
   - Research technologies
   - Train colonists
   - Make political decisions
   - Respond to events

2. **Simulation Phase** - Time advances
   - Tick N sols (configurable, default 10)
   - Systems process (resources, construction, research, etc.)
   - Collect significant events

3. **Events Phase** - Handle random events
   - Present event to player
   - Wait for player choice
   - Apply event outcomes

4. **Review Phase** - Show turn summary
   - Display what changed
   - Return to Planning Phase

## Key Systems

See individual system specifications for detailed implementation:

- **01-GAME-STATE.md** - Central game state management
- **02-RESOURCE-MANAGER.md** - Resource production/consumption
- **03-POLITICS-ENGINE.md** - Faction relationships and decisions
- **04-TECHNOLOGY-TREE.md** - Research system
- **05-BUILDING-MANAGER.md** - Construction and building effects
- **06-WORKFORCE-MANAGER.md** - Colonist training and role system
- **07-COLONY-MANAGER.md** - Population and colonist management
- **08-EVENT-MANAGER.md** - Random events system
- **09-TURN-MANAGER.md** - Turn/phase control
- **10-VICTORY-CONDITIONS.md** - Win/loss detection
- **11-BALANCE-CONSTANTS.md** - All tunable values
- **12-DEBUG-VIEWS.md** - Development tools and visualizations

## Development Guidelines

### TypeScript
- Use strict mode
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for readonly data
- Avoid `any` - use `unknown` if type is truly unknown

### Vue
- Use Composition API with `<script setup>`
- Use `readonly()` when exposing reactive state from services
- Keep components focused - one responsibility per component
- Use computed properties for derived state

### Testing
- Write tests for core systems (Jest/Vitest)
- Test game logic independent of UI
- Use simulation testing for balance validation

### Biome Configuration
```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExtraBooleanCast": "error",
        "noMultipleSpacesInRegularExpressionLiterals": "error",
        "noUselessCatch": "error",
        "noUselessTypeConstraint": "error"
      },
      "correctness": {
        "noConstAssign": "error",
        "noConstantCondition": "error",
        "noEmptyCharacterClassInRegex": "error",
        "noEmptyPattern": "error",
        "noGlobalObjectCalls": "error",
        "noInvalidConstructorSuper": "error",
        "noInvalidNewBuiltin": "error",
        "noNonoctalDecimalEscape": "error",
        "noPrecisionLoss": "error",
        "noSelfAssign": "error",
        "noSetterReturn": "error",
        "noSwitchDeclarations": "error",
        "noUndeclaredVariables": "error",
        "noUnreachable": "error",
        "noUnreachableSuper": "error",
        "noUnsafeFinally": "error",
        "noUnsafeOptionalChaining": "error",
        "noUnusedLabels": "error",
        "noUnusedVariables": "error",
        "useIsNan": "error",
        "useValidForDirection": "error",
        "useYield": "error"
      }
    }
  }
}
```

## Initial Setup Commands

```bash
# Initialize project
bun init

# Install dependencies
bun add vue
bun add -d @types/bun typescript @biomejs/biome vite @vitejs/plugin-vue

# Initialize Biome
bunx @biomejs/biome init

# Run dev server
bun run dev

# Format code
bunx @biomejs/biome format --write ./src

# Lint code
bunx @biomejs/biome lint ./src
```

## Next Steps

1. Set up project structure
2. Implement core systems (start with GameState, ResourceManager)
3. Create basic Vue UI for one system to test integration
4. Iterate on remaining systems
5. Add balance tuning and debug views
6. Polish and playtest
