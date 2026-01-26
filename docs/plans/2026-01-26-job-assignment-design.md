# Job Assignment System Design

## Overview

Colonists can be assigned to work in buildings with worker slots. Staffing affects building efficiency through diminishing returns, and role matching provides incentives for proper specialization.

## Core Mechanics

### Staffing Efficiency (Diminishing Returns)

Buildings with `workerSlots` require colonists to operate at full efficiency. Production scales with staffing using diminishing returns:

| Staffing % | Efficiency |
|------------|------------|
| 0% | 0% |
| 25% | 40% |
| 50% | 65% |
| 75% | 82% |
| 100% | 100% |

Formula: `efficiency = 1 - (1 - staffingRatio)^1.5`

### Role Matching

Any colonist can work any building, but mismatched roles (e.g., a Farmer in a Lab) apply a **30% efficiency penalty**. This stacks multiplicatively with staffing efficiency.

### Training Colonists

Colonists actively training can still be assigned to buildings but work at **50% efficiency**. This stacks with other modifiers.

### Unassigned Colonists (Labor Pool)

Unassigned colonists form a general labor pool providing:
- **+2% construction speed** per unassigned colonist
- **Capped at +20%** (10 colonists max benefit)

## Data Model Changes

### Existing Fields (No Changes)

**BuildingDefinition:**
- `workerSlots: number` - max workers
- `workerRole: ColonistRole` - preferred role

**Building:**
- `assignedWorkers: string[]` - colonist IDs

### New/Modified Methods

**WorkforceManager:**
```typescript
getColonistWorkplace(colonistId: string, buildings: BuildingManager): string | undefined
```
Searches buildings to find where a colonist is assigned.

**BuildingManager:**
- `assignWorker()` - Add validation: colonist not already assigned elsewhere
- `getStaffingEfficiency(buildingId)` - New method returning the diminishing returns multiplier
- `getWorkerEfficiency(buildingId)` - New method returning average worker efficiency
- Modify `getEffectiveProduction()` / `getEffectiveConsumption()` to include staffing and worker multipliers

## Efficiency Calculation

All modifiers stack multiplicatively:

```
finalEfficiency = baseProduction
  × modeMultiplier        // conservation/normal/overdrive
  × conditionMultiplier   // building condition penalty
  × oxygenMultiplier      // oxygen deficit penalty
  × staffingMultiplier    // diminishing returns curve
  × workerEfficiency      // average of assigned workers
```

### Worker Efficiency (Per Colonist)

- Base: 100%
- Role mismatch: ×0.7 (30% penalty)
- Training: ×0.5 (50% penalty)
- Mastery bonus: ×(1 + masteryBonus) - existing system
- Skills bonus: ×(1 + skillsBonus) - existing system

When multiple workers are assigned, their individual efficiencies are **averaged**.

### Example Calculation

Lab with 2/4 workers:
- Worker A: Researcher, Expert mastery → 1.0 × 1.15 = 1.15
- Worker B: Farmer (mismatched), training → 1.0 × 0.7 × 0.5 = 0.35
- Average worker efficiency: (1.15 + 0.35) / 2 = 0.75
- Staffing multiplier (50%): 0.65
- Final: base × 0.65 × 0.75 = 48.75% of max production

## UI: Colonist Assignment

Assignment is colonist-focused, managed from the Colony Panel.

### Colonist Card (Expanded View)

```
╭─ Dr. Sarah Chen ─────────────────╮
│ Researcher (Expert)              │
│ Skills: Botany, Geology          │
│                                  │
│ Workplace: [Research Lab #1  ▼]  │
│   Efficiency: 115%               │
│   Role match: ✓                  │
│                                  │
│ [Unassign]                       │
╰──────────────────────────────────╯
```

### Workplace Dropdown

Shows:
- Current assignment (if any)
- "Unassigned" option
- Available buildings grouped by type:
  - Building name + slots status (e.g., "Research Lab #1 (1/2)")
  - Role match indicator (✓ or ⚠)
  - Disabled if building full

### Building Tooltips

Enhanced to show:
- Worker slots: "Workers: 2/4"
- Current efficiency from staffing
- List of assigned colonists

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Colonist dies while assigned | Auto-remove from building |
| Building recycled with workers | Auto-unassign all workers first |
| Building broken | Workers stay assigned but don't contribute |
| New colonist arrives | Starts unassigned (joins labor pool) |

## Events

- No events for routine assignment/unassignment (too noisy)
- Warning when building drops below 50% staffing: "Research Lab #1 is understaffed"

## Balance Constants

New constants for `src/core/balance/WorkforceBalance.ts`:

```typescript
export const ROLE_MISMATCH_PENALTY = 0.3;        // 30% efficiency penalty
export const TRAINING_WORK_PENALTY = 0.5;        // 50% efficiency while training
export const LABOR_POOL_BONUS_PER_COLONIST = 0.02; // +2% construction speed
export const LABOR_POOL_BONUS_CAP = 0.2;         // +20% max
export const STAFFING_CURVE_EXPONENT = 1.5;      // Diminishing returns curve
```
