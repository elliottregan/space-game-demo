# Prefab Construction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Prefab Construction" technology that auto-builds Basic Habitats when colony reaches 85% housing capacity, plus a habitat upgrade mechanic.

**Architecture:** New technology with `auto_housing` effect type. New tick phase checks capacity threshold and triggers auto-build. Building upgrade system adds `upgrading` status and progress tracking to BuildingManager.

**Tech Stack:** TypeScript, Bun test runner, existing tick phase system

---

## Task 1: Add Technology ID and Effect Type

**Files:**
- Modify: `src/core/models/Technology.ts`

**Step 1: Write the failing test**

Create test file `tests/PrefabConstruction.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { TechnologyId } from "../src/core/models/Technology";

describe("Prefab Construction", () => {
  test("TechnologyId includes PREFAB_CONSTRUCTION", () => {
    expect(TechnologyId.PREFAB_CONSTRUCTION).toBe("prefab_construction");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL with "Property 'PREFAB_CONSTRUCTION' does not exist"

**Step 3: Write minimal implementation**

In `src/core/models/Technology.ts`, add to the `TechnologyId` enum:

```typescript
PREFAB_CONSTRUCTION = "prefab_construction",
```

And update the `TechEffect` interface type union:

```typescript
export interface TechEffect {
  type: "research_speed" | "construction_speed" | "production_bonus" | "mining_efficiency" | "auto_housing";
  value?: number;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/Technology.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add PREFAB_CONSTRUCTION technology ID and auto_housing effect type"
```

---

## Task 2: Add Technology Definition

**Files:**
- Modify: `src/core/data/technologies.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
import { TECHNOLOGIES } from "../src/core/data/technologies";

describe("Prefab Construction", () => {
  // ... existing test ...

  test("TECHNOLOGIES includes Prefab Construction with correct properties", () => {
    const tech = TECHNOLOGIES.find((t) => t.id === TechnologyId.PREFAB_CONSTRUCTION);
    expect(tech).toBeDefined();
    expect(tech!.name).toBe("Prefab Construction");
    expect(tech!.cost.sols).toBe(45);
    expect(tech!.prerequisites).toEqual([TechnologyId.ADVANCED_MATERIALS]);
    expect(tech!.effects).toContainEqual({ type: "auto_housing" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL with "tech is undefined"

**Step 3: Write minimal implementation**

In `src/core/data/technologies.ts`, add after ADVANCED_MATERIALS entry:

```typescript
{
  id: TechnologyId.PREFAB_CONSTRUCTION,
  name: "Prefab Construction",
  description: "Modular prefabricated housing units enable automatic colony expansion",
  prerequisites: [TechnologyId.ADVANCED_MATERIALS],
  cost: { sols: 45 },
  unlocks: [],
  effects: [{ type: "auto_housing" }],
},
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/data/technologies.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add Prefab Construction technology definition"
```

---

## Task 3: Add Building Upgrade Fields and Status

**Files:**
- Modify: `src/core/models/Building.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
import type { Building, BuildingStatus } from "../src/core/models/Building";

describe("Building Upgrade Model", () => {
  test("BuildingStatus includes upgrading", () => {
    const status: BuildingStatus = "upgrading";
    expect(status).toBe("upgrading");
  });

  test("Building interface accepts upgrade fields", () => {
    const building: Building = {
      id: "test_1",
      definitionId: BuildingId.HABITAT,
      status: "upgrading",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
      upgradeProgress: 5,
      upgradeTargetDefId: BuildingId.ADVANCED_HABITAT,
    };
    expect(building.upgradeProgress).toBe(5);
    expect(building.upgradeTargetDefId).toBe(BuildingId.ADVANCED_HABITAT);
  });
});
```

Also add import at top:

```typescript
import { BuildingId } from "../src/core/models/Building";
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL with type errors about "upgrading" status and missing properties

**Step 3: Write minimal implementation**

In `src/core/models/Building.ts`:

Update `BuildingStatus` type:
```typescript
export type BuildingStatus = "pending" | "active" | "disabled" | "idle" | "recycling" | "upgrading";
```

Add fields to `Building` interface:
```typescript
export interface Building {
  // ... existing fields ...
  upgradeProgress?: number;
  upgradeTargetDefId?: BuildingId;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/Building.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add upgrading status and upgrade fields to Building model"
```

---

## Task 4: Add Auto-Housing Check Method to BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { BUILDINGS } from "../src/core/data/buildings";
import { TECHNOLOGIES } from "../src/core/data/technologies";

describe("Auto-Housing", () => {
  test("checkAutoHousing returns empty when tech not researched", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });
    const technology = new TechnologyTree(TECHNOLOGIES);

    const events = buildings.checkAutoHousing(resources, technology, 5, 6);
    expect(events).toEqual([]);
  });

  test("checkAutoHousing returns empty when below 85% capacity", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // 4 population, 6 capacity = 67% (below 85%)
    const events = buildings.checkAutoHousing(resources, technology, 4, 6);
    expect(events).toEqual([]);
  });

  test("checkAutoHousing starts habitat when at 85% capacity", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // 6 population, 7 capacity = 86% (above 85%)
    const events = buildings.checkAutoHousing(resources, technology, 6, 7);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("AUTO_HOUSING_STARTED");
    expect(resources.getAmount("materials")).toBe(50); // 100 - 50 cost
    expect(buildings.getPendingBuildings().length).toBe(1);
    expect(buildings.getPendingBuildings()[0].definitionId).toBe(BuildingId.HABITAT);
  });

  test("checkAutoHousing does not build when habitat already pending", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 200 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // First auto-build
    buildings.checkAutoHousing(resources, technology, 6, 7);
    expect(buildings.getPendingBuildings().length).toBe(1);

    // Second attempt should not build another
    const events = buildings.checkAutoHousing(resources, technology, 6, 7);
    expect(events).toEqual([]);
    expect(buildings.getPendingBuildings().length).toBe(1);
  });

  test("checkAutoHousing emits blocked event when insufficient materials", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 30 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    const events = buildings.checkAutoHousing(resources, technology, 6, 7);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("AUTO_HOUSING_BLOCKED");
    expect(events[0].severity).toBe("warning");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL with "checkAutoHousing is not a function"

**Step 3: Write minimal implementation**

In `src/core/systems/BuildingManager.ts`, add method:

```typescript
import { TechnologyId } from "../models/Technology";

// Add to class:
private autoHousingBlockedShown: boolean = false;

checkAutoHousing(
  resources: ResourceManager,
  technology: TechnologyTree,
  population: number,
  housingCapacity: number
): GameEvent[] {
  const events: GameEvent[] = [];

  // Check if tech is researched
  if (!technology.isResearched(TechnologyId.PREFAB_CONSTRUCTION)) {
    return events;
  }

  // Check if below 85% threshold
  if (housingCapacity === 0 || population < housingCapacity * 0.85) {
    this.autoHousingBlockedShown = false; // Reset warning flag
    return events;
  }

  // Check if habitat already under construction
  if (this.hasHabitatUnderConstruction()) {
    return events;
  }

  // Check if can afford
  const habitatDef = this.definitions.get(BuildingId.HABITAT);
  if (!habitatDef || !resources.canAfford(habitatDef.cost)) {
    if (!this.autoHousingBlockedShown) {
      this.autoHousingBlockedShown = true;
      events.push({
        type: "AUTO_HOUSING_BLOCKED",
        severity: "warning",
        message: "Housing needed but insufficient materials for auto-construction",
      });
    }
    return events;
  }

  // Build the habitat
  resources.deduct(habitatDef.cost);
  const building: Building = {
    id: `building_${this.nextId++}`,
    definitionId: BuildingId.HABITAT,
    status: "pending",
    constructionProgress: 0,
    assignedWorkers: [],
    mode: "normal",
    broken: false,
    repairProgress: 0,
  };
  this.buildings.set(building.id, building);

  this.autoHousingBlockedShown = false; // Reset warning flag on success
  events.push({
    type: "AUTO_HOUSING_STARTED",
    severity: "info",
    message: "Prefab habitat construction started automatically",
    buildingId: building.id,
  });

  return events;
}

private hasHabitatUnderConstruction(): boolean {
  for (const building of this.buildings.values()) {
    if (
      building.definitionId === BuildingId.HABITAT &&
      building.status === "pending"
    ) {
      return true;
    }
  }
  return false;
}
```

Also add to `toJSON()`:
```typescript
autoHousingBlockedShown: this.autoHousingBlockedShown,
```

And in `fromJSON()`:
```typescript
manager.autoHousingBlockedShown = data.autoHousingBlockedShown ?? false;
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add checkAutoHousing method to BuildingManager"
```

---

## Task 5: Create Auto-Housing Tick Phase

**Files:**
- Create: `src/core/tick/phases/autoHousing.ts`
- Modify: `src/core/tick/phases/index.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
import { GameState } from "../src/core/GameState";

describe("Auto-Housing Tick Phase", () => {
  test("auto-housing triggers during game tick when conditions met", () => {
    const state = new GameState();

    // Research prerequisites
    state.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    state.technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // Give enough materials
    state.resources.add({ materials: 200 });

    // Get current housing capacity and set population to 85%+
    const capacity = state.colony.getHousingCapacity(state.buildings);
    const targetPop = Math.ceil(capacity * 0.86);

    // Add colonists to reach threshold
    while (state.colony.getPopulation() < targetPop) {
      state.colony.addColonist();
    }

    const initialPending = state.buildings.getPendingBuildings().length;

    // Run a tick
    const events = state.tick();

    // Should have auto-started a habitat
    const autoHousingEvent = events.find((e) => e.type === "AUTO_HOUSING_STARTED");
    expect(autoHousingEvent).toBeDefined();
    expect(state.buildings.getPendingBuildings().length).toBe(initialPending + 1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL (no AUTO_HOUSING_STARTED event because phase not registered)

**Step 3: Write minimal implementation**

Create `src/core/tick/phases/autoHousing.ts`:

```typescript
import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Auto-Housing Phase
 *
 * Checks if colony is at 85%+ housing capacity and automatically
 * starts a Basic Habitat if Prefab Construction tech is researched.
 */
export const checkAutoHousing = definePhase({
  id: "buildings:checkAutoHousing",
  name: "Check Auto-Housing",
  reads: ["buildings", "resources", "technology", "colony"],
  writes: ["buildings", "resources", "events"],
  execute(ctx: TickContext): GameEvent[] {
    const population = ctx.colony.getPopulation();
    const housingCapacity = ctx.colony.getHousingCapacity(ctx.buildings);

    return ctx.buildings.checkAutoHousing(
      ctx.resources,
      ctx.technology,
      population,
      housingCapacity
    );
  },
});
```

Update `src/core/tick/phases/index.ts`:

Add import:
```typescript
import { checkAutoHousing } from "./autoHousing";
```

Add export:
```typescript
export { checkAutoHousing } from "./autoHousing";
```

Register in `createStandardTickRunner()` after `assignHousing`:
```typescript
// 5b. Auto-housing (after colony phases, before technology)
runner.register(checkAutoHousing);
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/tick/phases/autoHousing.ts src/core/tick/phases/index.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add auto-housing tick phase"
```

---

## Task 6: Add Habitat Upgrade Methods to BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
describe("Habitat Upgrade", () => {
  test("canUpgradeHabitat returns false for non-habitat buildings", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 200 });

    const farm = buildings.addBuilding({
      definitionId: BuildingId.BASIC_FARM,
      status: "active",
      constructionProgress: 12,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(farm.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns false for pending habitat", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 200 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "pending",
      constructionProgress: 5,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(habitat.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns false when insufficient materials", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 50 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(habitat.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns true for active habitat with materials", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(habitat.id, resources)).toBe(true);
  });

  test("startUpgrade deducts materials and sets upgrading status", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    const result = buildings.startUpgrade(habitat.id, resources);

    expect(result).toBe(true);
    expect(resources.getAmount("materials")).toBe(30); // 100 - 70
    const updated = buildings.getBuilding(habitat.id);
    expect(updated?.status).toBe("upgrading");
    expect(updated?.upgradeProgress).toBe(0);
    expect(updated?.upgradeTargetDefId).toBe(BuildingId.ADVANCED_HABITAT);
  });

  test("getUpgradeCost returns 70 materials for habitat", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const cost = buildings.getUpgradeCost(BuildingId.HABITAT);
    expect(cost).toEqual({ materials: 70 });
  });

  test("getUpgradeTime returns 8 sols for habitat", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const time = buildings.getUpgradeTime(BuildingId.HABITAT);
    expect(time).toBe(8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL with "canUpgradeHabitat is not a function"

**Step 3: Write minimal implementation**

In `src/core/systems/BuildingManager.ts`, add methods:

```typescript
/** Upgrade costs: cost difference between basic and advanced versions */
private static readonly UPGRADE_COSTS: Partial<Record<BuildingId, { cost: ResourceDelta; time: number; target: BuildingId }>> = {
  [BuildingId.HABITAT]: {
    cost: { materials: 70 }, // 120 (advanced) - 50 (basic)
    time: 8,
    target: BuildingId.ADVANCED_HABITAT,
  },
};

getUpgradeCost(defId: BuildingId): ResourceDelta | undefined {
  return BuildingManager.UPGRADE_COSTS[defId]?.cost;
}

getUpgradeTime(defId: BuildingId): number {
  return BuildingManager.UPGRADE_COSTS[defId]?.time ?? 0;
}

canUpgradeHabitat(buildingId: string, resources: ResourceManager): boolean {
  const building = this.buildings.get(buildingId);
  if (!building) return false;
  if (building.status !== "active") return false;
  if (building.broken) return false;

  const upgradeInfo = BuildingManager.UPGRADE_COSTS[building.definitionId];
  if (!upgradeInfo) return false;

  return resources.canAfford(upgradeInfo.cost);
}

startUpgrade(buildingId: string, resources: ResourceManager): boolean {
  if (!this.canUpgradeHabitat(buildingId, resources)) return false;

  const building = this.buildings.get(buildingId);
  if (!building) return false;

  const upgradeInfo = BuildingManager.UPGRADE_COSTS[building.definitionId];
  if (!upgradeInfo) return false;

  resources.deduct(upgradeInfo.cost);
  building.status = "upgrading";
  building.upgradeProgress = 0;
  building.upgradeTargetDefId = upgradeInfo.target;

  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add habitat upgrade methods to BuildingManager"
```

---

## Task 7: Add Upgrade Progress Processing to BuildingManager.tick()

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
describe("Upgrade Progress", () => {
  test("tick progresses upgrade and completes after 8 sols", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    buildings.startUpgrade(habitat.id, resources);

    // Tick 7 times - should still be upgrading
    for (let i = 0; i < 7; i++) {
      buildings.tick(resources);
    }
    expect(buildings.getBuilding(habitat.id)?.status).toBe("upgrading");
    expect(buildings.getBuilding(habitat.id)?.upgradeProgress).toBe(7);

    // Tick once more - should complete
    const events = buildings.tick(resources);
    const updated = buildings.getBuilding(habitat.id);

    expect(updated?.status).toBe("active");
    expect(updated?.definitionId).toBe(BuildingId.ADVANCED_HABITAT);
    expect(updated?.upgradeProgress).toBeUndefined();
    expect(updated?.upgradeTargetDefId).toBeUndefined();

    const completeEvent = events.find((e) => e.type === "BUILDING_UPGRADE_COMPLETE");
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.buildingName).toBe("Advanced Habitat");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL (upgrade doesn't progress)

**Step 3: Write minimal implementation**

In `src/core/systems/BuildingManager.ts`, add method and update tick:

```typescript
private processUpgrades(
  building: Building,
  def: BuildingDefinition,
  resources: ResourceManager,
  events: GameEvent[],
): void {
  if (building.status !== "upgrading") return;
  if (building.upgradeTargetDefId === undefined) return;

  building.upgradeProgress = (building.upgradeProgress ?? 0) + 1;

  const upgradeTime = this.getUpgradeTime(building.definitionId);
  if (building.upgradeProgress >= upgradeTime) {
    // Complete the upgrade
    const targetDef = this.definitions.get(building.upgradeTargetDefId);
    building.definitionId = building.upgradeTargetDefId;
    building.status = "active";
    building.upgradeProgress = undefined;
    building.upgradeTargetDefId = undefined;

    events.push({
      type: "BUILDING_UPGRADE_COMPLETE",
      buildingId: building.id,
      buildingName: targetDef?.name ?? "Unknown",
      severity: "info",
      message: `Habitat upgraded to ${targetDef?.name ?? "Advanced Habitat"}!`,
    });
  }
}
```

Update the `tick` method to call `processUpgrades`:

```typescript
tick(resources: ResourceManager, currentSol?: number): GameEvent[] {
  if (currentSol !== undefined) {
    this.currentSol = currentSol;
  }
  const events: GameEvent[] = [];
  const buildingsToDelete: string[] = [];

  for (const building of this.buildings.values()) {
    const def = this.definitions.get(building.definitionId);
    if (!def) continue;

    this.processConstruction(building, def, resources, events);
    this.processRepairs(building, def, resources, events);
    this.processRecycling(building, def, resources, events, buildingsToDelete);
    this.processUpgrades(building, def, resources, events); // Add this line
  }

  // ... rest of method unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add upgrade progress processing to BuildingManager.tick"
```

---

## Task 8: Add Serialization for Upgrade State

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/PrefabConstruction.test.ts`

**Step 1: Write the failing test**

Add to `tests/PrefabConstruction.test.ts`:

```typescript
describe("Upgrade Serialization", () => {
  test("upgrade state survives save/load", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    buildings.startUpgrade(habitat.id, resources);

    // Tick a few times
    for (let i = 0; i < 3; i++) {
      buildings.tick(resources);
    }

    // Serialize and restore
    const json = buildings.toJSON();
    const restored = BuildingManager.fromJSON(json, BUILDINGS);

    const restoredBuilding = restored.getBuilding(habitat.id);
    expect(restoredBuilding?.status).toBe("upgrading");
    expect(restoredBuilding?.upgradeProgress).toBe(3);
    expect(restoredBuilding?.upgradeTargetDefId).toBe(BuildingId.ADVANCED_HABITAT);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: FAIL (upgrade fields not restored)

**Step 3: Write minimal implementation**

Update `fromJSON` in `src/core/systems/BuildingManager.ts`:

```typescript
static fromJSON(
  data: {
    buildings: Building[];
    nextId: number;
    constructionSpeedBonus: number;
    autoHousingBlockedShown?: boolean;
  },
  defs: BuildingDefinition[],
): BuildingManager {
  const manager = new BuildingManager(defs);
  data.buildings.forEach((b) => {
    // Add defaults for new fields (backward compatibility)
    const building: Building = {
      ...b,
      mode: b.mode ?? "normal",
      broken: b.broken ?? false,
      repairProgress: b.repairProgress ?? 0,
      recyclingProgress: b.recyclingProgress,
      repurposeFromDefId: b.repurposeFromDefId,
      upgradeProgress: b.upgradeProgress,
      upgradeTargetDefId: b.upgradeTargetDefId,
    };
    manager.buildings.set(building.id, building);
  });
  manager.nextId = data.nextId;
  manager.constructionSpeedBonus = data.constructionSpeedBonus || 0;
  manager.autoHousingBlockedShown = data.autoHousingBlockedShown ?? false;
  return manager;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/PrefabConstruction.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/PrefabConstruction.test.ts
git commit -m "feat: add serialization for building upgrade state"
```

---

## Task 9: Run Full Test Suite and Verify

**Files:** None (verification only)

**Step 1: Run full test suite**

Run: `bun test`
Expected: All existing tests pass, new tests pass

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 3: Final commit if any cleanup needed**

If any issues found, fix and commit:
```bash
git add -A
git commit -m "fix: address lint and test issues"
```

---

## Task 10: Update MANUAL.md

**Files:**
- Modify: `MANUAL.md`

**Step 1: Add Prefab Construction to technology section**

Find the technology section and add:

```markdown
### Prefab Construction
- **Cost:** 45 sols
- **Prerequisites:** Advanced Materials
- **Effect:** Enables automatic habitat construction when colony reaches 85% housing capacity

When researched, the colony will automatically start building a Basic Habitat whenever:
- Population reaches 85% of total housing capacity
- No habitat is already under construction
- At least 50 materials are available

This automation helps maintain housing without constant micromanagement.
```

**Step 2: Add habitat upgrade to buildings section**

Find the habitat section and add:

```markdown
#### Habitat Upgrades

Basic Habitats can be upgraded to Advanced Habitats:
- **Cost:** 70 materials
- **Duration:** 8 sols
- Colonists remain housed during the upgrade
- Capacity increases from 6 to 8 upon completion
```

**Step 3: Commit**

```bash
git add MANUAL.md
git commit -m "docs: add Prefab Construction and habitat upgrades to manual"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add technology ID and effect type | Technology.ts |
| 2 | Add technology definition | technologies.ts |
| 3 | Add building upgrade model fields | Building.ts |
| 4 | Add checkAutoHousing method | BuildingManager.ts |
| 5 | Create auto-housing tick phase | autoHousing.ts, index.ts |
| 6 | Add habitat upgrade methods | BuildingManager.ts |
| 7 | Add upgrade progress processing | BuildingManager.ts |
| 8 | Add upgrade serialization | BuildingManager.ts |
| 9 | Verify full test suite | (verification) |
| 10 | Update manual | MANUAL.md |
