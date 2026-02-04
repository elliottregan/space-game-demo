# Prefab Construction: Auto-Housing Design

## Overview

A new technology that enables automatic housing construction when the colony approaches capacity, plus an upgrade path from Basic Habitat to Advanced Habitat.

## Technology Definition

**Prefab Construction**
- **ID**: `PREFAB_CONSTRUCTION`
- **Cost**: 45 sols
- **Prerequisites**: Advanced Materials
- **Description**: "Modular prefabricated housing units enable automatic colony expansion"
- **Unlocks**: None (effect-based tech)
- **Effects**: `auto_housing`

```typescript
{
  id: TechnologyId.PREFAB_CONSTRUCTION,
  name: "Prefab Construction",
  description: "Modular prefabricated housing units enable automatic colony expansion",
  prerequisites: [TechnologyId.ADVANCED_MATERIALS],
  cost: { sols: 45 },
  unlocks: [],
  effects: [{ type: "auto_housing" }],
}
```

## Auto-Housing Trigger Logic

**When it runs**: Each game tick, after colony manager updates population.

**Trigger conditions** (all must be true):
- Prefab Construction is researched
- Population ≥ 85% of total housing capacity
- No habitat already under construction
- Resources ≥ 50 materials

**What happens**:
1. Deduct 50 materials
2. Start a Basic Habitat in "pending" status
3. Emit `AUTO_HOUSING_STARTED` event

**Implementation**: New method `BuildingManager.checkAutoHousing()` called from `GameState.tick()` after colony tick.

```typescript
checkAutoHousing(
  resources: ResourceManager,
  technology: TechnologyTree,
  population: number,
  housingCapacity: number
): GameEvent[] {
  if (!technology.isResearched(TechnologyId.PREFAB_CONSTRUCTION)) return [];
  if (population < housingCapacity * 0.85) return [];
  if (this.hasHabitatUnderConstruction()) return [];
  if (!resources.canAfford({ materials: 50 })) return [];

  this.startBuilding(BuildingId.HABITAT, resources, technology);
  return [{ type: "AUTO_HOUSING_STARTED", ... }];
}
```

## Habitat Upgrade Mechanic

**Action**: Active Basic Habitats gain an "Upgrade" action to convert to Advanced Habitat.

**Cost**: 70 materials (difference between Advanced Habitat 120 and Basic Habitat 50)

**Duration**: 8 sols (shorter than building new since modifying existing structure)

**Process**:
1. Player clicks "Upgrade" on an active Basic Habitat
2. Deduct 70 materials
3. Building enters `upgrading` status
4. Progress ticks each sol
5. On completion: change `definitionId` to `ADVANCED_HABITAT`, status to `active`, capacity increases 6 → 8

**Constraints**:
- Only works on active, non-broken Basic Habitats
- Colonists stay housed during upgrade (same building type)
- Cannot upgrade while under construction

**New Building fields**:
```typescript
upgradeProgress?: number;
upgradeTargetDefId?: BuildingId;
```

## Events and Player Feedback

| Event | When | Severity | Message |
|-------|------|----------|---------|
| `AUTO_HOUSING_STARTED` | Auto-build triggers | `info` | "Prefab habitat construction started automatically" |
| `AUTO_HOUSING_BLOCKED` | Threshold hit but no materials | `warning` | "Housing needed but insufficient materials for auto-construction" |
| `BUILDING_UPGRADE_STARTED` | Player starts upgrade | `info` | "Upgrading Habitat Module to Advanced Habitat" |
| `BUILDING_UPGRADE_COMPLETE` | Upgrade finishes | `info` | "Habitat upgraded to Advanced Habitat!" |

`AUTO_HOUSING_BLOCKED` fires once per threshold crossing (track via flag that resets when population drops or materials become available).

## Implementation Scope

### Files to Modify

- `src/core/models/Technology.ts` - Add `auto_housing` to `TechEffect` type, add `PREFAB_CONSTRUCTION` to enum
- `src/core/data/technologies.ts` - Add Prefab Construction tech definition
- `src/core/models/Building.ts` - Add `upgrading` status, upgrade fields
- `src/core/systems/BuildingManager.ts` - Add `checkAutoHousing()`, upgrade methods
- `src/core/GameState.ts` - Call `checkAutoHousing()` in tick loop
- `src/core/models/GameEvent.ts` - Add new event types

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Colony at 84% capacity | No action (below threshold) |
| Colony at 90% with habitat building | No action (already building) |
| Colony at 90% with 40 materials | Warning event, no build |
| Upgrading habitat with colonists | Colonists stay housed, capacity unchanged until complete |
| Save/load | Serialize `upgradeProgress` and `upgradeTargetDefId` |

### Out of Scope

- Auto-building other building types
- UI for toggling auto-housing on/off
- Priority queue for auto-builds
