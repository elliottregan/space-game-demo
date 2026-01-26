# Distributed Oxygen System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace dedicated Oxygen Generator with building-based oxygen contributions where each building contributes positive, neutral, or negative oxygen to colony air quality.

**Architecture:** Add `oxygenContribution` field to `BuildingDefinition`, aggregate contributions in `BuildingManager.getTotalOxygenContribution()`, apply efficiency penalty when total < 0. Follows existing `moraleBoost` pattern.

**Tech Stack:** TypeScript, Bun test, Vue 3 (renderer)

---

## Task 1: Add oxygenContribution to BuildingDefinition

**Files:**
- Modify: `src/core/models/Building.ts:6-20`

**Step 1: Write the failing test**

Create test file `tests/DistributedOxygen.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Distributed Oxygen System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("BuildingDefinition.oxygenContribution", () => {
    it("should have oxygenContribution defined on habitat", () => {
      const habitat = gameState.buildings.getDefinition("habitat");
      expect(habitat?.oxygenContribution).toBe(2);
    });

    it("should have oxygenContribution defined on research_lab", () => {
      const lab = gameState.buildings.getDefinition("research_lab");
      expect(lab?.oxygenContribution).toBe(-1);
    });

    it("should have oxygenContribution as 0 on solar_panel", () => {
      const solar = gameState.buildings.getDefinition("solar_panel");
      expect(solar?.oxygenContribution).toBe(0);
    });

    it("should NOT have oxygen_generator building", () => {
      const oxygenGen = gameState.buildings.getDefinition("oxygen_generator");
      expect(oxygenGen).toBeUndefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: FAIL - oxygenContribution property does not exist

**Step 3: Add oxygenContribution to BuildingDefinition interface**

In `src/core/models/Building.ts`, add to `BuildingDefinition` interface:

```typescript
export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  cost: ResourceDelta;
  constructionTime: number;
  production?: ResourceDelta;
  consumption?: ResourceDelta;
  workerSlots?: number;
  workerRole?: ColonistRole;
  requiredTech?: string;
  requiresDeposit?: boolean;
  repurposeTargets?: string[];
  moraleBoost?: number;
  oxygenContribution?: number; // NEW: Air quality contribution (+positive, 0 neutral, -negative)
}
```

**Step 4: Run test to verify it still fails (need data)**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: FAIL - values are undefined

**Step 5: Commit interface change**

```bash
git add src/core/models/Building.ts tests/DistributedOxygen.test.ts
git commit -m "feat(oxygen): add oxygenContribution field to BuildingDefinition"
```

---

## Task 2: Update buildings.ts with oxygen contribution values

**Files:**
- Modify: `src/core/data/buildings.ts`

**Step 1: Update building definitions**

In `src/core/data/buildings.ts`:

1. **Remove oxygen_generator entirely** (delete lines 21-30)

2. **Remove oxygen consumption from habitat and advanced_habitat** (they now produce air)

3. **Add oxygenContribution to all buildings:**

**Positive (+2):** habitat, advanced_habitat, basic_farm, greenhouse, hydroponic_garden
**Neutral (0):** solar_panel, water_extractor, storage_depot, water_reclaimer, nuclear_reactor, gymnasium, observatory_dome, medical_center, cryo_facility, common_room
**Negative (-1):** research_lab, biolab, automated_factory, mining_station

Here are the exact changes:

```typescript
// habitat - change consumption, add oxygenContribution
{
  id: "habitat",
  name: "Habitat Module",
  description: "Basic living quarters for colonists",
  cost: { materials: 50 },
  constructionTime: 10,
  consumption: { power: 2 }, // REMOVED oxygen: 1
  oxygenContribution: 2,     // NEW
},

// solar_panel - add oxygenContribution
{
  id: "solar_panel",
  name: "Solar Panel Array",
  description: "Generates power from sunlight",
  cost: { materials: 30 },
  constructionTime: 5,
  production: { power: 10 },
  oxygenContribution: 0,     // NEW
},

// DELETE oxygen_generator entirely

// water_extractor - add oxygenContribution
{
  id: "water_extractor",
  // ... existing fields ...
  oxygenContribution: 0,     // NEW
},

// storage_depot
oxygenContribution: 0,

// basic_farm
oxygenContribution: 2,

// greenhouse
oxygenContribution: 2,

// water_reclaimer
oxygenContribution: 0,

// research_lab
oxygenContribution: -1,

// advanced_habitat - change consumption, add oxygenContribution
{
  id: "advanced_habitat",
  name: "Advanced Habitat",
  description: "Comfortable living for more colonists",
  cost: { materials: 120 },
  constructionTime: 18,
  consumption: { power: 5 }, // REMOVED oxygen: 2
  oxygenContribution: 2,     // NEW
  requiredTech: "advanced_materials",
},

// automated_factory
oxygenContribution: -1,

// mining_station
oxygenContribution: -1,

// nuclear_reactor
oxygenContribution: 0,

// biolab
oxygenContribution: -1,

// medical_center
oxygenContribution: 0,

// cryo_facility
oxygenContribution: 0,

// common_room
oxygenContribution: 0,

// gymnasium
oxygenContribution: 0,

// hydroponic_garden
oxygenContribution: 2,

// observatory_dome
oxygenContribution: 0,
```

**Step 2: Run test to verify it passes**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: PASS

**Step 3: Commit data changes**

```bash
git add src/core/data/buildings.ts
git commit -m "feat(oxygen): add oxygen contributions to buildings, remove oxygen_generator"
```

---

## Task 3: Add getTotalOxygenContribution to BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/DistributedOxygen.test.ts`

**Step 1: Add test for getTotalOxygenContribution**

Add to `tests/DistributedOxygen.test.ts`:

```typescript
describe("BuildingManager.getTotalOxygenContribution", () => {
  it("should return 0 when no buildings exist", () => {
    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBe(0);
  });

  it("should sum oxygen contributions from active buildings", () => {
    // Build a habitat (+2) and basic_farm (+2)
    gameState.resources.add({ materials: 500 });

    gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);
    gameState.buildings.startBuilding("basic_farm", gameState.resources, gameState.technology);

    // Fast-forward construction (12 sols for basic_farm)
    for (let i = 0; i < 12; i++) {
      gameState.tick();
    }

    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBe(4); // 2 + 2
  });

  it("should include negative contributions", () => {
    gameState.resources.add({ materials: 500 });

    // Research advanced_materials for research_lab
    gameState.technology.completeResearch("advanced_materials");

    gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);
    gameState.buildings.startBuilding("research_lab", gameState.resources, gameState.technology);

    // Fast-forward construction (25 sols for research_lab)
    for (let i = 0; i < 25; i++) {
      gameState.tick();
    }

    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBe(1); // 2 + (-1) = 1
  });

  it("should not count broken buildings", () => {
    gameState.resources.add({ materials: 500 });

    gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);

    // Fast-forward construction
    for (let i = 0; i < 10; i++) {
      gameState.tick();
    }

    const buildings = gameState.buildings.getActiveBuildings();
    const habitat = buildings.find(b => b.definitionId === "habitat");

    // Break the building
    gameState.buildings.breakBuilding(habitat!.id, gameState.resources);

    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBe(0);
  });

  it("should not count pending buildings", () => {
    gameState.resources.add({ materials: 500 });

    gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);

    // Don't advance time - building is still pending
    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: FAIL - getTotalOxygenContribution is not a function

**Step 3: Implement getTotalOxygenContribution**

Add to `src/core/systems/BuildingManager.ts` after `getTotalMoraleBoost()`:

```typescript
getTotalOxygenContribution(): number {
  let total = 0;
  for (const building of this.buildings.values()) {
    if (building.status !== "active" || building.broken) continue;
    const def = this.definitions.get(building.definitionId);
    if (def?.oxygenContribution !== undefined) {
      total += def.oxygenContribution;
    }
  }
  return total;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/DistributedOxygen.test.ts
git commit -m "feat(oxygen): add getTotalOxygenContribution to BuildingManager"
```

---

## Task 4: Add oxygen deficit efficiency penalty

**Files:**
- Modify: `src/core/balance/BuildingBalance.ts`
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/DistributedOxygen.test.ts`

**Step 1: Add balance constant**

Add to `src/core/balance/BuildingBalance.ts`:

```typescript
/** Efficiency penalty when colony oxygen contribution is negative (0.5 = -50%) */
export const OXYGEN_DEFICIT_EFFICIENCY_PENALTY = 0.5;
```

**Step 2: Add test for efficiency penalty**

Add to `tests/DistributedOxygen.test.ts`:

```typescript
describe("Oxygen deficit efficiency penalty", () => {
  it("should apply 50% efficiency penalty when oxygen is negative", () => {
    gameState.resources.add({ materials: 1000 });

    // Research needed techs
    gameState.technology.completeResearch("advanced_materials");
    gameState.technology.completeResearch("robotics");

    // Build factory (-1) without any positive oxygen buildings
    // Need to build multiple factories to go negative
    gameState.buildings.startBuilding("automated_factory", gameState.resources, gameState.technology);
    gameState.buildings.startBuilding("automated_factory", gameState.resources, gameState.technology);

    // Fast-forward construction (30 sols)
    for (let i = 0; i < 30; i++) {
      gameState.tick();
    }

    // Total oxygen contribution should be -2
    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBe(-2);

    // Get effective production - should be penalized
    const factories = gameState.buildings.getActiveBuildings()
      .filter(b => b.definitionId === "automated_factory");

    const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0].id);

    // Base production is 15 materials, with 50% penalty should be 7.5
    expect(effectiveProd.materials).toBe(7.5);
  });

  it("should not apply penalty when oxygen is positive", () => {
    gameState.resources.add({ materials: 500 });

    // Build habitat (+2) and farm (+2)
    gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);
    gameState.buildings.startBuilding("basic_farm", gameState.resources, gameState.technology);

    // Fast-forward construction
    for (let i = 0; i < 12; i++) {
      gameState.tick();
    }

    const total = gameState.buildings.getTotalOxygenContribution();
    expect(total).toBeGreaterThan(0);

    const farms = gameState.buildings.getActiveBuildings()
      .filter(b => b.definitionId === "basic_farm");

    const effectiveProd = gameState.buildings.getEffectiveProduction(farms[0].id);

    // Base production is 10 food, no penalty
    expect(effectiveProd.food).toBe(10);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: FAIL - penalty not applied

**Step 4: Update getEffectiveProduction and getEffectiveConsumption**

In `src/core/systems/BuildingManager.ts`:

1. Import the new constant:
```typescript
import {
  MAINTENANCE_START_SOL,
  CONDITION_DECAY_INTERVAL,
  CONDITION_DECAY_AMOUNT,
  CONDITION_EFFICIENCY_THRESHOLD,
  CONDITION_EFFICIENCY_PENALTY,
  MAINTENANCE_COST_MULTIPLIER,
  OXYGEN_DEFICIT_EFFICIENCY_PENALTY, // NEW
} from "../balance/BuildingBalance";
```

2. Add helper method:
```typescript
private getOxygenDeficitMultiplier(): number {
  if (this.getTotalOxygenContribution() < 0) {
    return 1 - OXYGEN_DEFICIT_EFFICIENCY_PENALTY;
  }
  return 1;
}
```

3. Update `getEffectiveProduction`:
```typescript
getEffectiveProduction(buildingId: string, overrideCondition?: number): ResourceDelta {
  const building = this.buildings.get(buildingId);
  if (!building || building.status !== "active" || building.broken) return {};

  const def = this.definitions.get(building.definitionId);
  if (!def?.production) return {};

  const modeMultiplier = BUILDING_MODES[building.mode].production;
  const condition = overrideCondition ?? building.condition;
  const conditionMultiplier = this.getConditionMultiplier(condition);
  const oxygenMultiplier = this.getOxygenDeficitMultiplier(); // NEW
  const result: ResourceDelta = {};

  for (const [key, value] of Object.entries(def.production)) {
    if (value) result[key as keyof ResourceDelta] = value * modeMultiplier * conditionMultiplier * oxygenMultiplier;
  }

  return result;
}
```

4. Update `getEffectiveConsumption` similarly:
```typescript
getEffectiveConsumption(buildingId: string, overrideCondition?: number): ResourceDelta {
  const building = this.buildings.get(buildingId);
  if (!building || building.status !== "active" || building.broken) return {};

  const def = this.definitions.get(building.definitionId);
  if (!def?.consumption) return {};

  const modeMultiplier = BUILDING_MODES[building.mode].consumption;
  const condition = overrideCondition ?? building.condition;
  const conditionMultiplier = this.getConditionMultiplier(condition);
  const oxygenMultiplier = this.getOxygenDeficitMultiplier(); // NEW
  const result: ResourceDelta = {};

  for (const [key, value] of Object.entries(def.consumption)) {
    if (value) result[key as keyof ResourceDelta] = value * modeMultiplier * conditionMultiplier * oxygenMultiplier;
  }

  return result;
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/DistributedOxygen.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/balance/BuildingBalance.ts src/core/systems/BuildingManager.ts tests/DistributedOxygen.test.ts
git commit -m "feat(oxygen): add efficiency penalty when oxygen contribution is negative"
```

---

## Task 5: Update starting oxygen in EconomyBaseline

**Files:**
- Modify: `src/core/balance/EconomyBaseline.ts`

**Step 1: Update STARTING_RESOURCES**

In `src/core/balance/EconomyBaseline.ts`, increase starting oxygen from 250 to 400:

```typescript
export const STARTING_RESOURCES: Resources = {
  food: 300,
  oxygen: 400, // CHANGED from 250 - more buffer since no oxygen generator
  water: 120,
  power: 500,
  materials: 500,
};
```

**Step 2: Run all tests to verify nothing breaks**

Run: `bun test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/core/balance/EconomyBaseline.ts
git commit -m "feat(oxygen): increase starting oxygen buffer to compensate for removed generator"
```

---

## Task 6: Expose totalOxygenContribution via facade and GameService

**Files:**
- Modify: `src/facade/types/buildings.ts`
- Modify: `src/facade/domains/BuildingsFacade.ts`
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Update BuildingSnapshot type**

In `src/facade/types/buildings.ts`, add to `BuildingSnapshot` interface:

```typescript
export interface BuildingSnapshot {
  active: readonly Building[];
  pending: readonly Building[];
  definitions: readonly BuildingDefinition[];
  moraleBoost: number;
  totalOxygenContribution: number; // NEW
}
```

**Step 2: Update BuildingsFacade.snapshot()**

In `src/facade/domains/BuildingsFacade.ts`:

```typescript
snapshot(): BuildingSnapshot {
  return {
    active: Object.freeze([...this.gameState.buildings.getActiveBuildings()]),
    pending: Object.freeze([...this.gameState.buildings.getPendingBuildings()]),
    definitions: Object.freeze([...this.gameState.buildings.getAllDefinitions()]),
    moraleBoost: this.gameState.buildings.getTotalMoraleBoost(),
    totalOxygenContribution: this.gameState.buildings.getTotalOxygenContribution(), // NEW
  };
}
```

**Step 3: Update GameUIState and syncState**

In `src/renderer/services/GameService.ts`:

1. Add to `GameUIState` interface:
```typescript
interface GameUIState {
  // ... existing fields ...
  moraleBoost: number;
  totalOxygenContribution: number; // NEW
  colonists: Colonist[];
  // ...
}
```

2. Add to `createInitialState()`:
```typescript
private createInitialState(): GameUIState {
  return {
    // ... existing fields ...
    moraleBoost: 0,
    totalOxygenContribution: 0, // NEW
    colonists: [],
    // ...
  };
}
```

3. Update `syncState()`:
```typescript
// Buildings
const buildings = this.facade.buildings.snapshot();
this.state.buildings = [...buildings.active];
this.state.pendingBuildings = [...buildings.pending];
this.state.buildingDefinitions = [...buildings.definitions];
this.state.moraleBoost = buildings.moraleBoost;
this.state.totalOxygenContribution = buildings.totalOxygenContribution; // NEW
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/facade/types/buildings.ts src/facade/domains/BuildingsFacade.ts src/renderer/services/GameService.ts
git commit -m "feat(oxygen): expose totalOxygenContribution via facade and GameService"
```

---

## Task 7: Run full test suite and verify game still works

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 2: Start dev server and manual test**

Run: `bun run dev`

Manual verification:
1. Start new game
2. Build a habitat - should complete without issues
3. Build a basic farm - oxygen contribution should increase
4. Check that no oxygen_generator is available in building list
5. Build multiple research labs (after researching advanced_materials)
6. Verify efficiency penalty kicks in when oxygen goes negative

**Step 3: Commit any fixes needed**

---

## Summary

| Task | Files Modified | Tests Added |
|------|----------------|-------------|
| 1 | Building.ts | BuildingDefinition tests |
| 2 | buildings.ts | - |
| 3 | BuildingManager.ts | getTotalOxygenContribution tests |
| 4 | BuildingBalance.ts, BuildingManager.ts | Efficiency penalty tests |
| 5 | EconomyBaseline.ts | - |
| 6 | BuildingsFacade.ts, GameService.ts | - |
| 7 | - | Full test suite |

**Total estimated commits:** 6-7

**Key patterns followed:**
- `oxygenContribution` follows same pattern as `moraleBoost`
- `getTotalOxygenContribution()` follows same pattern as `getTotalMoraleBoost()`
- Efficiency penalty follows same pattern as condition penalty
- Facade snapshot follows existing pattern
