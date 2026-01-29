# Phase-Based Tick Architecture Design

## Overview

Refactor the game tick system from scattered manager.tick() calls into a centralized, phase-based architecture with explicit data dependencies. This provides:

- **Visibility**: One place to see all phases and their execution order
- **Extensibility**: Adding new phases is trivial
- **Debuggability**: Execution order is inspectable at runtime
- **Foundation for optimization**: Dependency graph enables future dirty-tracking/caching

## Goals

1. **Explicit, organized phases** - Easy to see what calculations happen when
2. **Change propagation** - Formal dependency tracking via reads/writes declarations
3. **Extensibility** - Easy to add new phases in the future

## Core Concepts

### TickPhase

A named unit of computation with declared inputs and outputs:

```typescript
interface TickPhase {
  id: string;                    // e.g., "buildings:processConstruction"
  name: string;                  // e.g., "Process Construction"

  // Explicit data dependencies
  reads: string[];               // e.g., ["buildings", "resources"]
  writes: string[];              // e.g., ["buildings", "resourceFlow"]

  // Execution
  execute(ctx: TickContext): GameEvent[];
}
```

### TickContext

A typed container holding all game state slices that phases can read from or write to:

```typescript
interface TickContext {
  // Core state (references to managers)
  currentSol: number;
  resources: ResourceManager;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  technology: TechnologyTree;
  operations: OperationsManager;
  npcInfluence: NPCInfluenceManager;
  events: EventManager;
  victory: VictoryManager;

  // Derived values (computed by early phases, read by later phases)
  derived: {
    socialCohesion: SocialCohesionData | null;
    policyEffects: PolicyEffects | null;
    laborPoolBonus: number;
    oxygenContribution: number;
  };

  // Settings
  settings: {
    autoAssignNewColonists: boolean;
  };
}
```

### TickRunner

Orchestrates phase execution:

```typescript
class TickRunner {
  register(phase: TickPhase): void;
  recomputeOrder(): void;           // Topological sort based on reads/writes
  tick(state: GameState): GameEvent[];
  getExecutionOrder(): Array<{ id: string; name: string }>;
  validate(): ValidationResult;
}
```

## Phase Definitions (27 phases)

### Pre-tick Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `pretick:updateLaborPoolBonus` | Update Labor Pool Bonus | colony.colonists, buildings.assignments | buildings.constructionSpeedBonus |
| `pretick:applyOxygenContribution` | Apply Oxygen Contribution | buildings.active | resources.oxygen |

### Resource Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `resources:applyFlows` | Apply Resource Flows | resources.production, resources.consumption | resources.current |
| `resources:checkDepletion` | Check Resource Depletion | resources.current | events |

### Building Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `buildings:processConstruction` | Process Construction | buildings.pending, buildings.constructionSpeedBonus | buildings.status, resources.production, resources.consumption, events |
| `buildings:processRepairs` | Process Repairs | buildings.broken | buildings.status, resources.production, resources.consumption, events |
| `buildings:processRecycling` | Process Recycling | buildings.recycling | buildings.list, resources.current, events |
| `buildings:processMaintenanceDecay` | Process Maintenance Decay | buildings.active, currentSol | buildings.condition, resources.production, resources.consumption, events |

### Workforce Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `workforce:processCoworkerBonding` | Process Coworker Bonding | buildings.assignments, currentSol | workforce.relationships, events |
| `workforce:processHousemateBonding` | Process Housemate Bonding | colony.colonists, colony.housing, currentSol | workforce.relationships |
| `workforce:processGuildBonding` | Process Guild Bonding | colony.colonists, workforce.guilds, currentSol | workforce.relationships |
| `workforce:processSocialBonding` | Process Social Bonding | colony.colonists, buildings.social, currentSol | workforce.relationships |
| `workforce:processPreferentialAttachment` | Process Preferential Attachment | colony.colonists, workforce.relationships, currentSol | workforce.relationships |
| `workforce:processTraining` | Process Training | colony.colonists | colony.colonists.role, colony.colonists.training, events |
| `workforce:processExperience` | Process Experience | colony.colonists, buildings.assignments | colony.colonists.experience, colony.colonists.mastery, events |

### Colony Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `colony:calculateSocialCohesion` | Calculate Social Cohesion | colony.colonists, workforce.relationships | derived.socialCohesion |
| `colony:calculatePolicyEffects` | Calculate Policy Effects | operations.policies | derived.policyEffects |
| `colony:processPopulation` | Process Population Growth | colony.health, colony.morale, colony.colonists | colony.colonists, events |
| `colony:processHealth` | Process Health Changes | resources.current, buildings.medical, derived.policyEffects | colony.health, events |
| `colony:processMorale` | Process Morale Changes | resources.current, buildings.morale, derived.policyEffects, derived.socialCohesion | colony.morale, events |
| `colony:updateConsumption` | Update Colonist Consumption | colony.colonists | resources.consumption |
| `colony:autoAssignWorkers` | Auto-Assign Workers | colony.colonists, buildings.understaffed, events | buildings.assignments, events |
| `colony:assignHousing` | Assign Housing | colony.colonists, buildings.housing | colony.housing |

### Technology Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `technology:processResearch` | Process Research | technology.current, resources.current | technology.progress, technology.unlocked, events |

### Politics Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `politics:processNPCInfluence` | Process NPC Influence | npcInfluence.npcs, currentSol | npcInfluence.support, events |

### Operations Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `operations:processOperations` | Process Operations | operations.active, currentSol, resources.current, colony.colonists | operations.progress, events |
| `operations:processDepositExtraction` | Process Deposit Extraction | buildings.mining, operations.deposits | operations.deposits, buildings.status, resources.production, resources.consumption, events |

### Event Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `events:processRandomEvents` | Process Random Events | currentSol, events.pool | events.active, events |

### Victory Phases
| ID | Name | Reads | Writes |
|----|------|-------|--------|
| `victory:checkConditions` | Check Victory Conditions | technology.unlocked, colony.colonists, resources.current | victory.status, events |

## File Structure

```
src/core/
├── tick/
│   ├── TickRunner.ts         # Orchestrator
│   ├── TickContext.ts        # Context type and factory
│   ├── TickPhase.ts          # Phase interface
│   ├── phases/
│   │   ├── index.ts          # Exports all phases, registers them
│   │   ├── pretick.ts        # UpdateLaborPoolBonus, ApplyOxygenContribution
│   │   ├── resources.ts      # ApplyFlows, CheckDepletion
│   │   ├── buildings.ts      # Construction, Repairs, Recycling, Decay
│   │   ├── workforce.ts      # Bonding phases, Training, Experience
│   │   ├── colony.ts         # Cohesion, Population, Health, Morale, etc.
│   │   ├── technology.ts     # ProcessResearch
│   │   ├── politics.ts       # ProcessNPCInfluence
│   │   ├── operations.ts     # ProcessOperations, DepositExtraction
│   │   ├── events.ts         # ProcessRandomEvents
│   │   └── victory.ts        # CheckConditions
│   └── index.ts              # Public API: createTickRunner()
├── systems/                   # Existing managers (unchanged initially)
├── GameState.ts              # Simplified to use TickRunner
```

## Migration Strategy

### Step 1: Scaffold Infrastructure
- Create TickRunner, TickContext, TickPhase types
- Create empty phase files
- No changes to existing behavior

### Step 2: Extract Phases (one category at a time)
1. victory.ts (1 phase, simplest)
2. technology.ts (1 phase)
3. resources.ts (2 phases)
4. politics.ts (1 phase)
5. events.ts (1 phase)
6. operations.ts (2 phases)
7. pretick.ts (2 phases)
8. buildings.ts (4 phases)
9. workforce.ts (7 phases)
10. colony.ts (8 phases)

### Step 3: Wire Up Runner
- Create createStandardTickRunner()
- Replace GameState.tick() with tickRunner.tick()
- Verify all tests pass

### Step 4: Clean Up (future)
- Remove tick() methods from managers
- Managers become pure state containers

## Testing Strategy

- Existing tests continue to pass (behavior unchanged)
- Add unit tests for individual phases
- Add integration test verifying getExecutionOrder() matches expected sequence
