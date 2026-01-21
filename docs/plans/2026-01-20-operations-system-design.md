# Operations System Design

Adds active resource management decisions through building modes, colony policies, expeditions, and prospecting.

## Overview

An "Operation" trades current resources/risk for future benefit. All operations share:
- **Cost** - upfront resources, workers, or capacity
- **Duration** - sols until resolution (0 for instant toggles)
- **Outcome** - deterministic or probabilistic results

| Type | Scope | Duration | Certainty |
|------|-------|----------|-----------|
| Building Modes | Per-building | Instant toggle | Deterministic |
| Colony Policies | Global | Instant toggle | Deterministic |
| Expeditions | One-off mission | 10-50 sols | Probabilistic |
| Prospecting | One-off mission | 5-20 sols | Probabilistic |

## File Structure

```
src/core/models/Operation.ts           - Type definitions
src/core/systems/OperationsManager.ts  - Manages active operations
src/core/data/operations.ts            - Expedition/prospecting definitions
src/core/balance/OperationsBalance.ts  - Tuning constants
src/renderer/components/OperationsPanel.vue - New UI panel
```

Integration: `GameState.tick()` calls `operations.tick()` between Politics and Events.

## Building Modes

Each building operates in one of three modes:

| Mode | Production | Consumption | Side Effect |
|------|------------|-------------|-------------|
| Conservation | 50% | 40% | — |
| Normal | 100% | 100% | — |
| Overdrive | 150% | 200% | -0.5 morale/sol, 2% breakdown chance/sol |

### Breakdown Mechanic

- Broken buildings stop producing until repaired
- Repair costs 25% of original build cost in materials
- Repair takes 3 sols

### Data Model

```typescript
interface Building {
  // ...existing fields
  mode: "conservation" | "normal" | "overdrive";
  broken: boolean;
  repairProgress: number;
}
```

## Colony Policies

Global stances affecting the entire colony. One choice per category, changeable once per 10 sols.

### Work Intensity

| Policy | Effect |
|--------|--------|
| Relaxed | -20% all production, +1 morale/sol |
| Standard | Baseline |
| Crunch | +20% all production, -1 morale/sol, -0.5 health/sol |

### Resource Priority

| Policy | Effect |
|--------|--------|
| Stockpile | +25% storage efficiency, -10% production |
| Balanced | Baseline |
| Burn Rate | +15% production, excess resources decay 5%/sol |

### Exploration Stance

| Policy | Effect |
|--------|--------|
| Cautious | Expeditions cost +50%, success rate +20% |
| Standard | Baseline |
| Aggressive | Expeditions cost -25%, success rate -15% |

### Data Model

```typescript
interface ColonyPolicies {
  workIntensity: "relaxed" | "standard" | "crunch";
  resourcePriority: "stockpile" | "balanced" | "burn";
  explorationStance: "cautious" | "standard" | "aggressive";
}
```

## Expeditions

Crew-led missions into the Martian wilderness. Maximum 2 concurrent.

| Expedition | Cost | Duration | Success Outcomes | Failure Outcomes |
|------------|------|----------|------------------|------------------|
| Survey Nearby | 2 crew, 20 materials | 10 sols | Reveal prospecting site | Nothing found |
| Salvage Run | 3 crew, 30 materials | 15 sols | 50-150 materials | Lose 1 crew, partial materials |
| Science Mission | 2 crew, 50 materials | 25 sols | +20% research speed for 50 sols | Equipment lost |
| Deep Exploration | 4 crew, 100 materials | 40 sols | Major discovery | Lose 1-2 crew |

### Success Rate

Base: 60-80% depending on type.

Modifiers:
- Exploration Stance policy (±15-20%)
- Crew health average (low health = -10%)
- Experience (+5% per completed expedition, caps at +20%)

### Data Model

```typescript
interface ActiveExpedition {
  id: string;
  definitionId: string;
  assignedCrew: string[];
  solsRemaining: number;
  resolved: boolean;
}
```

## Prospecting

Discover and develop resource deposits for permanent production bonuses.

### Flow

1. Complete "Survey Nearby" expedition to reveal sites
2. Spend 30 materials, 5 sols to reveal site quality (hidden until then)
3. Decide whether to develop or abandon

### Site Quality

| Quality | Development Cost | Bonus |
|---------|------------------|-------|
| Poor | 50 materials | +10% resource production |
| Moderate | 100 materials | +25% resource production |
| Rich | 200 materials | +50% resource production, unlocks advanced building |

### Limits

- Maximum 3 revealed sites at a time
- Maximum 5 developed sites total
- Resource types: water, materials, research

### Data Model

```typescript
interface ProspectingSite {
  id: string;
  resourceType: "water" | "materials" | "research";
  quality: "poor" | "moderate" | "rich";
  revealed: boolean;
  developed: boolean;
  developmentProgress: number;
}
```

## UI: Operations Panel

Tabbed panel consolidating all operation types.

```
┌─ Operations ─────────────────────────────┐
│ [Policies] [Buildings] [Missions]        │
│                                          │
│ Policies Tab:                            │
│  Work: [Relaxed] [Standard•] [Crunch]    │
│  Resources: [Stockpile] [Balanced•] ...  │
│  Exploration: [Cautious] [Standard•] ... │
│  ⏱ Policy change available in: 3 sols   │
│                                          │
│ Missions Tab:                            │
│  Active (1/2):                           │
│   • Salvage Run - 8 sols remaining       │
│  Available:                              │
│   [Survey Nearby] [Science Mission]      │
│  Sites (2 revealed, 1 developed):        │
│   • Water (Rich) - [Develop: 200 mat]    │
│   • ??? - [Reveal: 30 mat]               │
└──────────────────────────────────────────┘
```

Building modes stay on BuildingPanel as toggles. "Buildings" tab shows summary only.

Hover over policy/mode changes shows projected rates via existing highlight system.

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| All crew on expeditions | Cannot start new expedition, worker buildings at 50% |
| Crew dies on expedition | Colonist removed, morale -10 colony-wide |
| Building breaks during crisis | Breaks immediately |
| Policy change during active expedition | Applies to resolution only |
| Revealed site never developed | Stays revealed, blocks slot |
| Morale hits 0 from Crunch | Forced to Standard, 20-sol lockout |

## Testing

```
tests/OperationsManager.test.ts
- Building mode affects resource calculations
- Breakdown triggers and repair flow
- Policy cooldown enforcement
- Expedition resolution (deterministic with mocked random)
- Prospecting site reveal and development
- 100-sol stress test with various combinations
```
