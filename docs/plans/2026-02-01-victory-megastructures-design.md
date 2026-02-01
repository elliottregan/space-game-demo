# Victory Megastructures Design

## Overview

Each faction's capstone project unlocks a unique megastructure building. Completing construction of the megastructure wins the game.

### Victory Flow

1. Complete all 3 regular faction projects (35% support each)
2. Pass the capstone project (65% council support)
3. Build the unlocked megastructure (300-400 materials, 30-40 sols)
4. Construction complete → Victory

### The Three Megastructures

| Building | Faction | Cost | Build Time | Theme |
|----------|---------|------|------------|-------|
| Generation Ship | Earth Loyalists | 400 materials | 40 sols | Humanity's future among the stars |
| United Mars Station | Mars Independence | 350 materials | 35 sols | Symbol of Martian sovereignty |
| Space Elevator | Corporate Interests | 300 materials, 100 power | 30 sols | Economic dominance infrastructure |

---

## Building Definitions

### New BuildingIds

Add to `BuildingId` enum:
- `GENERATION_SHIP = "generation_ship"`
- `UNITED_MARS_STATION = "united_mars_station"`
- `SPACE_ELEVATOR = "space_elevator"`

### New BuildingDefinition Fields

```typescript
interface BuildingDefinition {
  // ... existing fields ...
  requiredProject?: ProjectId;  // Project that must be passed to unlock
  isVictoryBuilding?: boolean;  // Completing this building wins the game
}
```

### Building Definitions

```typescript
{
  id: BuildingId.GENERATION_SHIP,
  name: "Generation Ship",
  description: "A massive interstellar vessel capable of carrying colonists to distant stars. Completing this proves Mars can seed the galaxy.",
  cost: { materials: 400 },
  constructionTime: 40,
  oxygenContribution: 10,
  purpose: BuildingPurpose.Industrial,
  requiredProject: ProjectId.RETURN_MISSION,
  isVictoryBuilding: true,
}

{
  id: BuildingId.UNITED_MARS_STATION,
  name: "United Mars Station",
  description: "An orbital station symbolizing Martian unity and independence. A beacon of sovereignty visible from Earth.",
  cost: { materials: 350 },
  constructionTime: 35,
  oxygenContribution: 8,
  purpose: BuildingPurpose.Industrial,
  requiredProject: ProjectId.DECLARATION_OF_SOVEREIGNTY,
  isVictoryBuilding: true,
}

{
  id: BuildingId.SPACE_ELEVATOR,
  name: "Space Elevator",
  description: "A tether to orbit enabling cheap access to space. The ultimate infrastructure for economic dominance.",
  cost: { materials: 300, power: 100 },
  constructionTime: 30,
  oxygenContribution: 5,
  purpose: BuildingPurpose.Industrial,
  requiredProject: ProjectId.PLANETARY_ACQUISITION,
  isVictoryBuilding: true,
}
```

---

## Project Changes

Update capstone projects to unlock megastructures:

```typescript
{
  id: ProjectId.RETURN_MISSION,
  name: "Return Mission",
  description: "Launch a crewed mission back to Earth, proving Mars can sustain true interplanetary civilization.",
  type: NPCFaction.EarthLoyalists,
  proposalCost: {},
  requiredSupport: 0,
  isCapstone: true,
  prerequisites: [ProjectId.EARTH_MEMORIAL, ProjectId.HERITAGE_ARCHIVE, ProjectId.GENERATION_SHIP],
  requiredCouncilSupport: 0.65,
  effects: { unlockBuilding: BuildingId.GENERATION_SHIP },
}

{
  id: ProjectId.DECLARATION_OF_SOVEREIGNTY,
  name: "Declaration of Sovereignty",
  description: "Formally declare Mars an independent nation, free from Earth jurisdiction.",
  type: NPCFaction.MarsIndependence,
  proposalCost: {},
  requiredSupport: 0,
  isCapstone: true,
  prerequisites: [ProjectId.UNIVERSAL_HOUSING, ProjectId.HEALTHCARE_EXPANSION, ProjectId.DEMOCRATIC_ASSEMBLY],
  requiredCouncilSupport: 0.65,
  effects: { unlockBuilding: BuildingId.UNITED_MARS_STATION },
}

{
  id: ProjectId.PLANETARY_ACQUISITION,
  name: "Planetary Acquisition",
  description: "Take the colony public. Shareholders on Earth now own Mars.",
  type: NPCFaction.CorporateInterests,
  proposalCost: {},
  requiredSupport: 0,
  isCapstone: true,
  prerequisites: [ProjectId.LABOR_EFFICIENCY, ProjectId.MINING_CONCESSION, ProjectId.AI_GOVERNANCE],
  requiredCouncilSupport: 0.65,
  effects: { unlockBuilding: BuildingId.SPACE_ELEVATOR },
}
```

---

## Victory System

### Victory Event

When a megastructure completes construction:

```typescript
{
  type: 'VICTORY_BUILDING_COMPLETED',
  buildingId: BuildingId,
  faction: NPCFaction,
  severity: 'victory'
}
```

### Victory State

Add to GameState:

```typescript
victory: {
  achieved: boolean;
  type: 'building' | 'other';  // Extensible for future victory types
  faction: NPCFaction;
  buildingId?: BuildingId;
  sol: number;
} | null
```

### Victory Detection

In `BuildingManager.tick()`:
1. Detect building status changing from `pending` → `active`
2. If `isVictoryBuilding === true`, emit `VICTORY_BUILDING_COMPLETED` event

In `GameState.tick()`:
1. Check for victory events
2. Set victory state with faction, building, and current sol

---

## Implementation Files

| File | Changes |
|------|---------|
| `src/core/models/Building.ts` | Add 3 new BuildingIds, add `requiredProject?` and `isVictoryBuilding?` fields |
| `src/core/data/buildings.ts` | Add 3 megastructure definitions |
| `src/core/data/projects.ts` | Add `effects.unlockBuilding` to 3 capstones |
| `src/core/systems/BuildingManager.ts` | Check `requiredProject` in canBuild, emit victory event on completion |
| `src/core/GameState.ts` | Add `victory` state, handle victory events in tick |
| `src/renderer/components/VictoryModal.vue` | New victory modal component |
| `src/facade/domains/BuildingsFacade.ts` | Expose project-gated building availability |
| `tests/BuildingManager.test.ts` | Tests for victory trigger |
| `tests/GameState.test.ts` | Tests for victory state |

---

## Edge Cases

- **Only one megastructure can win:** First to complete construction wins
- **Game continues during construction:** Opponents can still complete their megastructure first
- **Save/load:** Victory state persists correctly
- **UI:** Building panel shows megastructures only when unlocked by capstone project

---

## Not Changing

- Existing regular projects (e.g., GENERATION_SHIP project keeps unlocking "shipyard")
- Other victory conditions (population-based, etc.) remain separate paths if they exist
