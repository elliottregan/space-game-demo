# Research Buildings Design

## Overview

Replace the fixed research rate (1 sol per tick) with a building-driven research system. Research progress depends on having active research buildings - no buildings means no research.

## Core Mechanic

**Research Rate System**

```
research_progress_per_tick = sum of (research output from all active research buildings)
```

- Research progress accumulates each tick based on total research output
- When progress reaches tech's `cost.sols`, the tech completes
- Zero active research buildings = zero research progress
- Material costs on techs remain unchanged (paid upfront when starting)

## Buildings

### Science Station (new)

Basic research facility available from game start.

| Property | Value |
|----------|-------|
| Tech required | None |
| Cost | 60 materials |
| Construction time | 12 sols |
| Power consumption | 5 |
| Worker slots | 2 (Research) |
| Research output | 1.0/sol |
| Air contribution | 0 |

### Research Lab (modified)

Advanced research facility, now produces research output.

| Property | Value |
|----------|-------|
| Tech required | Advanced Materials |
| Cost | 150 materials |
| Construction time | 25 sols |
| Power consumption | 10 |
| Worker slots | 3 (Research) |
| Research output | 3.0/sol |
| Air contribution | -1 |

## Building States

- Only `active` buildings contribute research output
- `disabled`, `idle`, `pending`, `broken`, `recycling` buildings produce 0
- Understaffed buildings produce proportionally less (e.g., 1/2 workers = 50% output)
- Worker skill/efficiency affects output as with other production buildings

## Research Queue Behavior

- When research rate drops to 0, research pauses but progress is preserved
- When research rate returns, research resumes from saved progress
- No change to prerequisite chains or queue mechanics

## Implementation Changes

### Model Changes

1. **`BuildingDefinition`** - Add `researchOutput?: number` property
2. **`BuildingId`** - Add `SCIENCE_STATION` enum value

### Data Changes

1. **`buildings.ts`** - Add Science Station definition
2. **`buildings.ts`** - Add `researchOutput: 3.0` to Research Lab

### System Changes

1. **`TechnologyTree.ts`** - Modify `tick()` to accept research rate parameter
2. **`tick/phases/technology.ts`** - Calculate total research rate from active buildings

### Calculation Logic

```typescript
// In technology tick phase:
const researchRate = buildings
  .filter(b => b.status === 'active' && b.definition.researchOutput)
  .reduce((sum, b) => {
    const efficiency = getWorkerEfficiency(b); // 0-1 based on staffing/skill
    return sum + (b.definition.researchOutput * efficiency);
  }, 0);

technologyTree.tick(researchRate, resourceManager);
```

## UI Considerations

- Display current research rate (e.g., "Research: 4.0/sol")
- Show estimated completion time based on current rate
- Indicate when research is stalled (0 rate)

## What Doesn't Change

- Tech prerequisites
- Tech effects (research_speed bonus removed as redundant)
- Material costs on expensive techs
- Research queue mechanics
