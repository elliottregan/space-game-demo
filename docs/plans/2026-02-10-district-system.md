# District System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 10x10 building grid with a district-based colony model to support 100-150 colonists, simplify power/resource systems, and prepare for Graph Rewriting Automata.

**Architecture:** Remove GridManager and all spatial grid code. Introduce DistrictManager as the new spatial unit. Buildings belong to districts instead of grid cells. Power becomes a colony-wide ledger. Worker assignment uses district membership instead of cluster transit. Housing auto-scales within districts.

**Tech Stack:** TypeScript, Bun test runner, Vue 3 renderer (GameService bridge)

**Working directory:** `/workspace/.worktrees/district-system`

---

## Task 1: District Model and Balance Constants

**Creates the foundational types and configuration that all other tasks depend on.**

**Files:**
- Create: `src/core/models/District.ts`
- Create: `src/core/balance/DistrictBalance.ts`

**Step 1: Create District model types**

Create `src/core/models/District.ts`:

```typescript
/**
 * A named population center within the colony.
 * Districts replace the building grid as the primary spatial unit.
 */
export interface District {
  id: string;
  name: string;
  foundedAt: number;
  capacity: number;
  growthCap: number | null;
  buildingIds: string[];
}

/**
 * Colony-wide power state.
 */
export enum PowerStatus {
  SURPLUS = "surplus",
  DEFICIT = "deficit",
  CRITICAL = "critical",
}
```

**Step 2: Create District balance constants**

Create `src/core/balance/DistrictBalance.ts`:

```typescript
/** Cost to found a new district */
export const DISTRICT_FOUNDING_COST = 100;

/** Starting housing capacity when a district is founded */
export const DISTRICT_INITIAL_CAPACITY = 20;

/** Occupancy ratio that triggers automatic growth */
export const DISTRICT_GROWTH_TRIGGER = 0.8;

/** Occupancy ratio that pauses growth */
export const DISTRICT_GROWTH_PAUSE = 0.6;

/** Capacity units added per growth tick */
export const DISTRICT_GROWTH_AMOUNT = 1;

/** Sols between each growth tick */
export const DISTRICT_GROWTH_INTERVAL = 5;

/** Materials consumed per sol while growing */
export const DISTRICT_GROWTH_MATERIAL_COST = 2;

/** Overcrowding soft cap per district */
export const DISTRICT_OVERCROWDING_CAP = 40;

/** Overcrowding penalty tiers: [threshold, moralePenalty] */
export const DISTRICT_OVERCROWDING_TIERS = [
  { min: 40, max: 50, moralePenalty: 5, healthRisk: 0.01 },
  { min: 50, max: 60, moralePenalty: 15, healthRisk: 0.03 },
  { min: 60, max: Infinity, moralePenalty: 25, healthRisk: 0.05 },
] as const;

/** Morale cost when a colonist is forcibly transferred */
export const DISTRICT_TRANSFER_MORALE_COST = 5;

/** Productivity penalty for cross-district work (0-1) */
export const CROSS_DISTRICT_WORK_PENALTY = 0.2;

/** Neighborhood bonding rate (per sol, same district) */
export const NEIGHBORHOOD_BONDING_RATE = 0.005;

/** Initial relationship strength for new neighbors */
export const INITIAL_NEIGHBORHOOD_RELATIONSHIP = 0.08;

/** Cross-district bonding rate (per sol, different districts) */
export const CROSS_DISTRICT_BONDING_RATE = 0.001;

/** Critical power deficit threshold (fraction of total demand) */
export const POWER_CRITICAL_THRESHOLD = 0.5;

/**
 * Population growth scaling.
 * Effective rate = BASE_RATE * (1 - population / SCALING_DENOMINATOR)
 */
export const POPULATION_SCALING_DENOMINATOR = 200;
```

**Step 3: Commit**

```bash
git add src/core/models/District.ts src/core/balance/DistrictBalance.ts
git commit -m "feat: add District model types and balance constants"
```

---

## Task 2: DistrictManager Core

**Creates the DistrictManager class with founding, assignment, growth, and power ledger logic. Includes full test coverage.**

**Files:**
- Create: `src/core/systems/DistrictManager.ts`
- Create: `tests/DistrictManager.test.ts`

**Step 1: Write failing tests**

Create `tests/DistrictManager.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { DistrictManager } from "../src/core/systems/DistrictManager";
import { PowerStatus } from "../src/core/models/District";

describe("DistrictManager", () => {
  let dm: DistrictManager;

  beforeEach(() => {
    dm = new DistrictManager();
  });

  describe("founding", () => {
    test("creates initial district with correct defaults", () => {
      const district = dm.foundDistrict("Landing Site", 0);
      expect(district.name).toBe("Landing Site");
      expect(district.capacity).toBe(20);
      expect(district.foundedAt).toBe(0);
      expect(district.growthCap).toBeNull();
      expect(district.buildingIds).toEqual([]);
    });

    test("generates unique IDs for multiple districts", () => {
      const d1 = dm.foundDistrict("Alpha", 0);
      const d2 = dm.foundDistrict("Beta", 10);
      expect(d1.id).not.toBe(d2.id);
    });

    test("getDistricts returns all founded districts", () => {
      dm.foundDistrict("A", 0);
      dm.foundDistrict("B", 5);
      expect(dm.getDistricts()).toHaveLength(2);
    });

    test("getDistrict returns district by ID", () => {
      const d = dm.foundDistrict("Test", 0);
      expect(dm.getDistrict(d.id)).toBeDefined();
      expect(dm.getDistrict(d.id)!.name).toBe("Test");
    });

    test("getDistrict returns undefined for unknown ID", () => {
      expect(dm.getDistrict("nonexistent")).toBeUndefined();
    });
  });

  describe("building assignment", () => {
    test("assigns building to district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "building_1");
      expect(dm.getDistrict(d.id)!.buildingIds).toContain("building_1");
    });

    test("getBuildingDistrictId returns correct district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "building_1");
      expect(dm.getBuildingDistrictId("building_1")).toBe(d.id);
    });

    test("getBuildingDistrictId returns undefined for unassigned building", () => {
      expect(dm.getBuildingDistrictId("building_1")).toBeUndefined();
    });

    test("removeBuilding removes from district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "building_1");
      dm.removeBuilding("building_1");
      expect(dm.getDistrict(d.id)!.buildingIds).not.toContain("building_1");
      expect(dm.getBuildingDistrictId("building_1")).toBeUndefined();
    });
  });

  describe("colonist assignment", () => {
    test("assigns colonist to district", () => {
      const d = dm.foundDistrict("Test", 0);
      expect(dm.assignColonist(d.id, "colonist_1")).toBe(true);
      expect(dm.getColonistDistrictId("colonist_1")).toBe(d.id);
    });

    test("rejects assignment when district is at capacity", () => {
      const d = dm.foundDistrict("Test", 0);
      // Fill to capacity (20)
      for (let i = 0; i < 20; i++) {
        dm.assignColonist(d.id, `colonist_${i}`);
      }
      expect(dm.assignColonist(d.id, "colonist_overflow")).toBe(false);
    });

    test("getDistrictPopulation returns count", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignColonist(d.id, "c1");
      dm.assignColonist(d.id, "c2");
      expect(dm.getDistrictPopulation(d.id)).toBe(2);
    });

    test("getDistrictColonistIds returns colonist list", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignColonist(d.id, "c1");
      dm.assignColonist(d.id, "c2");
      expect(dm.getDistrictColonistIds(d.id)).toEqual(["c1", "c2"]);
    });

    test("removeColonist removes from district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignColonist(d.id, "c1");
      dm.removeColonist("c1");
      expect(dm.getDistrictPopulation(d.id)).toBe(0);
      expect(dm.getColonistDistrictId("c1")).toBeUndefined();
    });

    test("transferColonist moves between districts", () => {
      const d1 = dm.foundDistrict("A", 0);
      const d2 = dm.foundDistrict("B", 0);
      dm.assignColonist(d1.id, "c1");
      expect(dm.transferColonist("c1", d2.id)).toBe(true);
      expect(dm.getColonistDistrictId("c1")).toBe(d2.id);
      expect(dm.getDistrictPopulation(d1.id)).toBe(0);
      expect(dm.getDistrictPopulation(d2.id)).toBe(1);
    });
  });

  describe("housing growth", () => {
    test("processGrowth increases capacity when above trigger", () => {
      const d = dm.foundDistrict("Test", 0);
      // Fill to 80%+ (16 of 20)
      for (let i = 0; i < 17; i++) {
        dm.assignColonist(d.id, `c${i}`);
      }
      const materialsConsumed = dm.processGrowth(5); // sol 5 = first growth interval
      expect(dm.getDistrict(d.id)!.capacity).toBe(21);
      expect(materialsConsumed).toBeGreaterThan(0);
    });

    test("processGrowth does nothing below trigger threshold", () => {
      const d = dm.foundDistrict("Test", 0);
      // Only 5 of 20 = 25% occupancy
      for (let i = 0; i < 5; i++) {
        dm.assignColonist(d.id, `c${i}`);
      }
      const consumed = dm.processGrowth(5);
      expect(dm.getDistrict(d.id)!.capacity).toBe(20);
      expect(consumed).toBe(0);
    });

    test("processGrowth respects growth cap", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.setGrowthCap(d.id, 20); // Cap at current capacity
      for (let i = 0; i < 17; i++) {
        dm.assignColonist(d.id, `c${i}`);
      }
      const consumed = dm.processGrowth(5);
      expect(dm.getDistrict(d.id)!.capacity).toBe(20);
      expect(consumed).toBe(0);
    });
  });

  describe("power ledger", () => {
    test("registerPowerSource tracks production", () => {
      dm.registerPowerSource("solar_1", 10);
      expect(dm.getTotalPowerProduction()).toBe(10);
    });

    test("registerPowerConsumer tracks consumption", () => {
      dm.registerPowerConsumer("farm_1", 3);
      expect(dm.getTotalPowerConsumption()).toBe(3);
    });

    test("getPowerBalance returns production minus consumption", () => {
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerConsumer("farm_1", 3);
      expect(dm.getPowerBalance()).toBe(7);
    });

    test("getPowerStatus returns SURPLUS when balanced", () => {
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerConsumer("farm_1", 3);
      expect(dm.getPowerStatus()).toBe(PowerStatus.SURPLUS);
    });

    test("getPowerStatus returns DEFICIT when consumption exceeds production", () => {
      dm.registerPowerSource("solar_1", 5);
      dm.registerPowerConsumer("farm_1", 8);
      expect(dm.getPowerStatus()).toBe(PowerStatus.DEFICIT);
    });

    test("getPowerStatus returns CRITICAL when deficit exceeds 50%", () => {
      dm.registerPowerSource("solar_1", 2);
      dm.registerPowerConsumer("farm_1", 10);
      expect(dm.getPowerStatus()).toBe(PowerStatus.CRITICAL);
    });

    test("unregisterPowerSource removes production", () => {
      dm.registerPowerSource("solar_1", 10);
      dm.unregisterPowerSource("solar_1");
      expect(dm.getTotalPowerProduction()).toBe(0);
    });

    test("unregisterPowerConsumer removes consumption", () => {
      dm.registerPowerConsumer("farm_1", 3);
      dm.unregisterPowerConsumer("farm_1");
      expect(dm.getTotalPowerConsumption()).toBe(0);
    });
  });

  describe("serialization", () => {
    test("toJSON and fromJSON round-trip", () => {
      const d = dm.foundDistrict("Test", 5);
      dm.assignBuilding(d.id, "b1");
      dm.assignColonist(d.id, "c1");
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerConsumer("farm_1", 3);

      const json = dm.toJSON();
      const restored = DistrictManager.fromJSON(json);

      expect(restored.getDistricts()).toHaveLength(1);
      expect(restored.getDistrict(d.id)!.name).toBe("Test");
      expect(restored.getBuildingDistrictId("b1")).toBe(d.id);
      expect(restored.getColonistDistrictId("c1")).toBe(d.id);
      expect(restored.getTotalPowerProduction()).toBe(10);
      expect(restored.getTotalPowerConsumption()).toBe(3);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/DistrictManager.test.ts`
Expected: FAIL — module not found

**Step 3: Implement DistrictManager**

Create `src/core/systems/DistrictManager.ts`:

```typescript
import type { District } from "../models/District";
import { PowerStatus } from "../models/District";
import {
  DISTRICT_INITIAL_CAPACITY,
  DISTRICT_GROWTH_TRIGGER,
  DISTRICT_GROWTH_AMOUNT,
  DISTRICT_GROWTH_INTERVAL,
  DISTRICT_GROWTH_MATERIAL_COST,
  POWER_CRITICAL_THRESHOLD,
} from "../balance/DistrictBalance";

export class DistrictManager {
  private districts: Map<string, District> = new Map();
  private nextId = 1;

  // Colonist → district mapping
  private colonistToDistrict: Map<string, string> = new Map();
  private districtColonists: Map<string, string[]> = new Map();

  // Building → district mapping
  private buildingToDistrict: Map<string, string> = new Map();

  // Power ledger
  private powerSources: Map<string, number> = new Map();
  private powerConsumers: Map<string, number> = new Map();

  // Growth tracking
  private lastGrowthSol: Map<string, number> = new Map();

  // --- District lifecycle ---

  foundDistrict(name: string, currentSol: number): District {
    const id = `district_${this.nextId++}`;
    const district: District = {
      id,
      name,
      foundedAt: currentSol,
      capacity: DISTRICT_INITIAL_CAPACITY,
      growthCap: null,
      buildingIds: [],
    };
    this.districts.set(id, district);
    this.districtColonists.set(id, []);
    this.lastGrowthSol.set(id, currentSol);
    return district;
  }

  getDistrict(id: string): District | undefined {
    return this.districts.get(id);
  }

  getDistricts(): District[] {
    return Array.from(this.districts.values());
  }

  setGrowthCap(districtId: string, cap: number | null): void {
    const district = this.districts.get(districtId);
    if (district) {
      district.growthCap = cap;
    }
  }

  // --- Building assignment ---

  assignBuilding(districtId: string, buildingId: string): void {
    const district = this.districts.get(districtId);
    if (!district) return;
    district.buildingIds.push(buildingId);
    this.buildingToDistrict.set(buildingId, districtId);
  }

  removeBuilding(buildingId: string): void {
    const districtId = this.buildingToDistrict.get(buildingId);
    if (!districtId) return;
    const district = this.districts.get(districtId);
    if (district) {
      district.buildingIds = district.buildingIds.filter((id) => id !== buildingId);
    }
    this.buildingToDistrict.delete(buildingId);
  }

  getBuildingDistrictId(buildingId: string): string | undefined {
    return this.buildingToDistrict.get(buildingId);
  }

  // --- Colonist assignment ---

  assignColonist(districtId: string, colonistId: string): boolean {
    const district = this.districts.get(districtId);
    if (!district) return false;
    const population = this.districtColonists.get(districtId)?.length ?? 0;
    if (population >= district.capacity) return false;

    // Remove from previous district if any
    this.removeColonist(colonistId);

    this.colonistToDistrict.set(colonistId, districtId);
    const colonists = this.districtColonists.get(districtId) ?? [];
    colonists.push(colonistId);
    this.districtColonists.set(districtId, colonists);
    return true;
  }

  removeColonist(colonistId: string): void {
    const districtId = this.colonistToDistrict.get(colonistId);
    if (!districtId) return;
    const colonists = this.districtColonists.get(districtId);
    if (colonists) {
      const idx = colonists.indexOf(colonistId);
      if (idx !== -1) colonists.splice(idx, 1);
    }
    this.colonistToDistrict.delete(colonistId);
  }

  transferColonist(colonistId: string, targetDistrictId: string): boolean {
    const district = this.districts.get(targetDistrictId);
    if (!district) return false;
    const population = this.districtColonists.get(targetDistrictId)?.length ?? 0;
    if (population >= district.capacity) return false;

    this.removeColonist(colonistId);
    this.colonistToDistrict.set(colonistId, targetDistrictId);
    const colonists = this.districtColonists.get(targetDistrictId) ?? [];
    colonists.push(colonistId);
    this.districtColonists.set(targetDistrictId, colonists);
    return true;
  }

  getColonistDistrictId(colonistId: string): string | undefined {
    return this.colonistToDistrict.get(colonistId);
  }

  getDistrictPopulation(districtId: string): number {
    return this.districtColonists.get(districtId)?.length ?? 0;
  }

  getDistrictColonistIds(districtId: string): string[] {
    return this.districtColonists.get(districtId) ?? [];
  }

  // --- Housing growth ---

  processGrowth(currentSol: number): number {
    let totalMaterialsCost = 0;

    for (const [districtId, district] of this.districts) {
      const lastSol = this.lastGrowthSol.get(districtId) ?? 0;
      if (currentSol - lastSol < DISTRICT_GROWTH_INTERVAL) continue;

      const population = this.getDistrictPopulation(districtId);
      const occupancy = district.capacity > 0 ? population / district.capacity : 0;

      if (occupancy < DISTRICT_GROWTH_TRIGGER) continue;
      if (district.growthCap !== null && district.capacity >= district.growthCap) continue;

      district.capacity += DISTRICT_GROWTH_AMOUNT;
      this.lastGrowthSol.set(districtId, currentSol);
      totalMaterialsCost += DISTRICT_GROWTH_INTERVAL * DISTRICT_GROWTH_MATERIAL_COST;
    }

    return totalMaterialsCost;
  }

  // --- Power ledger ---

  registerPowerSource(buildingId: string, output: number): void {
    this.powerSources.set(buildingId, output);
  }

  unregisterPowerSource(buildingId: string): void {
    this.powerSources.delete(buildingId);
  }

  registerPowerConsumer(buildingId: string, consumption: number): void {
    this.powerConsumers.set(buildingId, consumption);
  }

  unregisterPowerConsumer(buildingId: string): void {
    this.powerConsumers.delete(buildingId);
  }

  getTotalPowerProduction(): number {
    let total = 0;
    for (const output of this.powerSources.values()) total += output;
    return total;
  }

  getTotalPowerConsumption(): number {
    let total = 0;
    for (const consumption of this.powerConsumers.values()) total += consumption;
    return total;
  }

  getPowerBalance(): number {
    return this.getTotalPowerProduction() - this.getTotalPowerConsumption();
  }

  getPowerStatus(): PowerStatus {
    const production = this.getTotalPowerProduction();
    const consumption = this.getTotalPowerConsumption();
    if (production >= consumption) return PowerStatus.SURPLUS;
    const deficit = consumption - production;
    if (consumption > 0 && deficit / consumption > POWER_CRITICAL_THRESHOLD) {
      return PowerStatus.CRITICAL;
    }
    return PowerStatus.DEFICIT;
  }

  // --- Serialization ---

  toJSON(): {
    districts: Array<District & { colonistIds: string[] }>;
    nextId: number;
    powerSources: Array<{ buildingId: string; output: number }>;
    powerConsumers: Array<{ buildingId: string; consumption: number }>;
    lastGrowthSol: Array<[string, number]>;
  } {
    const districts = this.getDistricts().map((d) => ({
      ...d,
      colonistIds: this.getDistrictColonistIds(d.id),
    }));
    return {
      districts,
      nextId: this.nextId,
      powerSources: Array.from(this.powerSources.entries()).map(([buildingId, output]) => ({
        buildingId,
        output,
      })),
      powerConsumers: Array.from(this.powerConsumers.entries()).map(
        ([buildingId, consumption]) => ({ buildingId, consumption }),
      ),
      lastGrowthSol: Array.from(this.lastGrowthSol.entries()),
    };
  }

  static fromJSON(data: ReturnType<DistrictManager["toJSON"]>): DistrictManager {
    const dm = new DistrictManager();
    dm.nextId = data.nextId;

    for (const d of data.districts) {
      const district: District = {
        id: d.id,
        name: d.name,
        foundedAt: d.foundedAt,
        capacity: d.capacity,
        growthCap: d.growthCap,
        buildingIds: d.buildingIds,
      };
      dm.districts.set(d.id, district);
      dm.districtColonists.set(d.id, []);
      for (const bid of d.buildingIds) {
        dm.buildingToDistrict.set(bid, d.id);
      }
      for (const cid of d.colonistIds) {
        dm.colonistToDistrict.set(cid, d.id);
        dm.districtColonists.get(d.id)!.push(cid);
      }
    }
    for (const { buildingId, output } of data.powerSources) {
      dm.powerSources.set(buildingId, output);
    }
    for (const { buildingId, consumption } of data.powerConsumers) {
      dm.powerConsumers.set(buildingId, consumption);
    }
    for (const [id, sol] of data.lastGrowthSol) {
      dm.lastGrowthSol.set(id, sol);
    }
    return dm;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/DistrictManager.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/systems/DistrictManager.ts tests/DistrictManager.test.ts
git commit -m "feat: implement DistrictManager with founding, assignment, growth, and power ledger"
```

---

## Task 3: Wire DistrictManager into GameState

**Replace GridManager with DistrictManager in GameState, TickContext, and tick phases. This is the integration backbone — after this task, the game initializes with districts instead of a grid.**

**Files:**
- Modify: `src/core/GameState.ts`
- Modify: `src/core/tick/TickContext.ts`
- Modify: `src/core/tick/phases/index.ts`
- Create: `src/core/tick/phases/districts.ts` (replaces `grid.ts`)
- Modify: `src/core/tick/phases/autoHousing.ts` → district auto-growth
- Modify: `src/core/tick/phases/colony.ts` — `assignHousing` phase → `assignToDistrict`
- Delete: `src/core/tick/phases/grid.ts`

**Key changes:**
- `GameState.grid: GridManager` → `GameState.districts: DistrictManager`
- `TickContext.grid: GridManager` → `TickContext.districts: DistrictManager`
- `processGridTick` phase → `processDistrictGrowth` phase
- `checkAutoHousing` phase → uses district growth instead
- `assignHousing` phase → assigns unhoused colonists to districts
- `placeStartingBuildingsOnGrid()` → `initializeStartingDistrict()`
- `toJSON`/`fromJSON` — serialize districts instead of grid

**Testing approach:** After this task, run `bun test tests/GameState.test.ts` and fix compilation errors. Many existing tests will need grid setup code removed — that's handled in Task 8.

**Step 1: Create district tick phase**

Create `src/core/tick/phases/districts.ts`:

```typescript
import { definePhase } from "../definePhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../../facade/types";

export const processDistrictGrowth = definePhase({
  id: "districts:growth",
  name: "Process District Growth",
  reads: ["districts", "resources"],
  writes: ["districts", "resources"],
  execute(ctx: TickContext): GameEvent[] {
    const materialsCost = ctx.districts.processGrowth(ctx.currentSol);
    if (materialsCost > 0) {
      const available = ctx.resources.getResources().materials;
      if (available >= materialsCost) {
        ctx.resources.deductResources({ materials: materialsCost });
      }
      // If not enough materials, growth already happened in processGrowth
      // but we don't charge. TODO: make growth conditional on materials
    }
    return [];
  },
});
```

**Step 2: Update TickContext to use DistrictManager instead of GridManager**

In `src/core/tick/TickContext.ts`:
- Replace `import { GridManager }` with `import { DistrictManager }`
- Replace `grid: GridManager` with `districts: DistrictManager` in both the interface and `createTickContext`

**Step 3: Update tick phase registration in index.ts**

In `src/core/tick/phases/index.ts`:
- Remove `import { processGridTick } from "./grid"`
- Add `import { processDistrictGrowth } from "./districts"`
- Replace `runner.register(processGridTick)` with `runner.register(processDistrictGrowth)`
- Remove `processGridTick` from re-exports, add `processDistrictGrowth`

**Step 4: Update GameState**

In `src/core/GameState.ts`:
- Replace `grid: GridManager` property with `districts: DistrictManager`
- Replace constructor grid init with: `this.districts = new DistrictManager()`
- Replace `placeStartingBuildingsOnGrid()` with `initializeStartingDistrict()` that:
  - Founds "Landing Site" district
  - Assigns starting buildings to it
  - Registers power sources/consumers on DistrictManager
  - Assigns starting colonists to the district
- Replace `this.buildings.setGridManager(this.grid)` with `this.buildings.setDistrictManager(this.districts)` (BuildingManager change comes in Task 4)
- Update tick() to pass `districts` instead of `grid` in TickContext
- Update toJSON/fromJSON for districts

**Step 5: Update autoHousing phase**

In `src/core/tick/phases/autoHousing.ts`:
- Replace housing capacity check with district-based: total district capacity vs total population
- Remove the phase body — district auto-growth replaces it. Keep the phase definition but make it a no-op (or remove the phase registration in index.ts)

**Step 6: Update assignHousing in colony.ts**

In `src/core/tick/phases/colony.ts`:
- The `assignHousing` phase currently calls `ctx.colony.assignHousing(ctx.buildings)`
- Change to assign unhoused colonists to districts with available capacity via `ctx.districts`

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire DistrictManager into GameState and tick phases, replacing GridManager"
```

---

## Task 4: Update BuildingManager — Remove Grid, Add Districts

**Replace all grid/cluster references in BuildingManager with district-based logic.**

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `src/core/interfaces/Queries.ts`

**Key changes:**
- Remove: `setGridManager()`, `setGridQueries()`, `triggerClusterUpdate()`, `handleDisconnectedBuildings()`
- Add: `setDistrictManager(dm: DistrictManager)`
- Replace cluster-based worker filtering with district-based filtering in `autoAssignWorkers()`, `autoAssignAllWorkers()`, `assignWorker()`
- Replace `GridQueries` interface with `DistrictQueries` interface
- Remove power-state gating from `getEffectiveProduction()` / `getEffectiveConsumption()` — power is colony-wide now
- Remove: `checkAutoHousing()` — district growth replaces it

**Step 1: Update Queries interface**

In `src/core/interfaces/Queries.ts`:
- Replace `GridQueries` with:
```typescript
export interface DistrictQueries {
  getBuildingDistrictId(buildingId: string): string | undefined;
  getColonistDistrictId(colonistId: string): string | undefined;
}
```
- Remove `BuildingPlacement` import

**Step 2: Update BuildingManager**

Replace all grid references:
- `gridManager` → `districtManager`
- `gridQueries` → `districtQueries`
- Worker assignment: instead of `getBuildingClusterId`, use `getBuildingDistrictId` and `getColonistDistrictId`
- Remove `triggerClusterUpdate()` calls — no clusters to update
- Remove `handleDisconnectedBuildings()` — districts don't disconnect
- Remove power-state checks in `getEffectiveProduction()` / `getEffectiveConsumption()`
- Remove `checkAutoHousing()` method

**Step 3: Run BuildingManager tests**

Run: `bun test tests/BuildingManager.test.ts`
Fix compilation errors — tests that set up grids need to set up districts instead.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace grid/cluster logic with district routing in BuildingManager"
```

---

## Task 5: Update ColonyManager — District Assignment

**Replace housing-by-building with housing-by-district.**

**Files:**
- Modify: `src/core/models/Colonist.ts`
- Modify: `src/core/systems/ColonyManager.ts`

**Key changes to Colonist model:**
- Replace `housingId?: string` with `districtId?: string`

**Key changes to ColonyManager:**
- `assignHousing(buildingManager)` → `assignToDistrict(districtManager)`: assigns unhoused colonists to districts with capacity
- `getHousingCapacity(buildingManager)` → `getHousingCapacity(districtManager)`: sums district capacities
- `getUnhousedColonists()` → checks `districtId` instead of `housingId`
- `assignColonistToHousing()` → `assignColonistToDistrict()`
- `clearHousingAssignment()` → clears `districtId`
- `getHousingAssignments()` → groups by district
- Population growth scaling: replace flat `POPULATION_GROWTH_RATE` with `baseRate * (1 - population / 200)`

**Step 1: Update Colonist model**

In `src/core/models/Colonist.ts`, replace `housingId` with `districtId`:
```typescript
districtId?: string; // District where colonist lives
```

**Step 2: Update ColonyManager methods**

Replace all `housingId` references with `districtId`. The `assignToDistrict` method iterates districts from DistrictManager and assigns unhoused colonists to districts with available capacity.

**Step 3: Update population growth curve**

In `tryPopulationGrowth()`, replace:
```typescript
const effectiveRate = POPULATION_GROWTH_RATE * (1 + healthBonus);
```
with:
```typescript
const scalingFactor = Math.max(0, 1 - population / POPULATION_SCALING_DENOMINATOR);
const effectiveRate = POPULATION_GROWTH_RATE * scalingFactor * (1 + healthBonus);
```

**Step 4: Run colony tests**

Run: `bun test tests/ColonyFacade.test.ts tests/HousingAssignment.test.ts`
Fix compilation errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace housing-by-building with district assignment in ColonyManager"
```

---

## Task 6: Update WorkforceManager — Neighborhood Bonding

**Replace housemate bonding (by building) with neighborhood bonding (by district).**

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`
- Modify: `src/core/balance/WorkforceBalance.ts`

**Key changes:**
- `processHousemateBonding()` → `processNeighborhoodBonding()`: groups colonists by `districtId` instead of `housingId`
- Uses `NEIGHBORHOOD_BONDING_RATE` (0.005/sol) instead of `HOUSEMATE_BONDING_RATE` (0.015/sol)
- Add cross-district weak tie formation at `CROSS_DISTRICT_BONDING_RATE` (0.001/sol)

**Step 1: Add balance constants**

In `src/core/balance/WorkforceBalance.ts`, add (or import from DistrictBalance):
```typescript
export const NEIGHBORHOOD_BONDING_RATE = 0.005;
export const INITIAL_NEIGHBORHOOD_RELATIONSHIP = 0.08;
export const CROSS_DISTRICT_BONDING_RATE = 0.001;
```

**Step 2: Update processHousemateBonding**

Replace the method to group by `colonist.districtId` instead of `colonist.housingId`. Use the new bonding rates. Rename to `processNeighborhoodBonding`.

**Step 3: Run workforce tests**

Run: `bun test tests/WorkforceManager.test.ts`
Fix tests that rely on `housingId` bonding behavior.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace housemate bonding with district neighborhood bonding"
```

---

## Task 7: Update Facades

**Replace GridFacade and PowerGridFacade with DistrictFacade. Update BuildingsFacade to remove grid placement.**

**Files:**
- Create: `src/facade/domains/DistrictFacade.ts`
- Modify: `src/facade/domains/BuildingsFacade.ts`
- Modify: `src/facade/domains/GameFlowFacade.ts`
- Modify: `src/facade/GameAPI.ts`
- Modify: `src/facade/domains/index.ts`
- Modify: `src/facade/types/index.ts`
- Delete: `src/facade/domains/GridFacade.ts`
- Delete: `src/facade/domains/PowerGridFacade.ts`
- Delete: `src/facade/types/grid.ts`

**Step 1: Create DistrictFacade**

```typescript
// src/facade/domains/DistrictFacade.ts
import type { GameState } from "../../core/GameState";
import type { District } from "../../core/models/District";
import { PowerStatus } from "../../core/models/District";

export interface DistrictSnapshot {
  districts: Array<{
    id: string;
    name: string;
    foundedAt: number;
    capacity: number;
    population: number;
    growthCap: number | null;
    buildingCount: number;
  }>;
  power: {
    production: number;
    consumption: number;
    balance: number;
    status: PowerStatus;
  };
}

export class DistrictFacade {
  constructor(private gameState: GameState) {}

  snapshot(): DistrictSnapshot {
    const dm = this.gameState.districts;
    return {
      districts: dm.getDistricts().map((d) => ({
        id: d.id,
        name: d.name,
        foundedAt: d.foundedAt,
        capacity: d.capacity,
        population: dm.getDistrictPopulation(d.id),
        growthCap: d.growthCap,
        buildingCount: d.buildingIds.length,
      })),
      power: {
        production: dm.getTotalPowerProduction(),
        consumption: dm.getTotalPowerConsumption(),
        balance: dm.getPowerBalance(),
        status: dm.getPowerStatus(),
      },
    };
  }

  getDistrictColonists(districtId: string): string[] {
    return this.gameState.districts.getDistrictColonistIds(districtId);
  }
}
```

**Step 2: Update BuildingsFacade**

- Remove `buildAtPosition(defId, position)` — replace with `build(defId, districtId)` that:
  - Validates district exists
  - Starts building via BuildingManager
  - Assigns building to district via DistrictManager
  - Registers power source/consumer on DistrictManager
- Remove `recycle()` grid removal code — just call `DistrictManager.removeBuilding()`
- Replace `getAssignableWorkersForBuilding()` — filter by district instead of cluster

**Step 3: Update GameFlowFacade**

- Remove all `getGridBuildingPosition`, `getGridPlacement`, `getGridDeposits`, `getGridBuildingPowerState` methods
- Add district-related accessors if needed

**Step 4: Update GameAPI**

- Replace `_grid: GridFacade` with `_districts: DistrictFacade`
- Replace `get grid()` with `get districts()`
- Remove `_powerGrid: PowerGridFacade` and its accessor

**Step 5: Update facade type exports**

- Remove `GridPosition`, `DepositInfo`, `GridSnapshot`, `PlacementHints`, `PowerSourceInfo`, `DepositType` from `src/facade/types/index.ts`
- Add `DistrictSnapshot` export

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: replace GridFacade/PowerGridFacade with DistrictFacade"
```

---

## Task 8: Update Simulation — HeuristicStrategy

**Replace grid-based building placement with district-based building decisions.**

**Files:**
- Modify: `src/simulation/HeuristicStrategy.ts`

**Key changes:**
- Remove all `api.grid.*` calls
- Remove `findBestPosition()`, `findPowerSourcePosition()`, `findPoweredPosition()`
- `tryBuild()` now calls `api.buildings.build(defId, districtId)` — always builds in the district with most capacity or most workers
- Remove habitat building logic — districts auto-grow
- Remove grid space checks (`emptyCells.length < 20`)
- Add district founding logic: when population exceeds overcrowding threshold, found a new district
- Remove `GRID_CENTER` constant and deposit-based placement

**Step 1: Rewrite building strategy**

Replace grid placement with:
1. Pick target district (prefer district with most related buildings, or least crowded for habitats)
2. Call `api.buildings.build(defId, targetDistrictId)`

**Step 2: Add district founding strategy**

When total population > 80% of total capacity across all districts, and a single district is above the overcrowding soft cap, found a new district.

**Step 3: Remove Rover Depot, Habitat, Advanced Habitat from strategy**

These buildings no longer exist.

**Step 4: Run simulation test**

Run: `bun run simulate --runs 5 --log silent`
Expected: Runs complete (may need balance tuning)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: update HeuristicStrategy for district-based building decisions"
```

---

## Task 9: Update Renderer — GameService

**Update the GameService state bridge to sync district state instead of grid state.**

**Files:**
- Modify: `src/renderer/services/GameService.ts`
- Delete: `src/renderer/components/BaseGrid/renderBaseGrid.ts`
- Delete: `src/renderer/components/BaseGrid/isometricUtils.ts`

**Key changes to GameService:**
- Replace `gridBuildings` and `gridDeposits` in `GameUIState` with `districts` array
- Replace grid sync in `syncState()` with district data sync
- Remove `PowerState`, `DepositType`, `GridPosition` imports from core Grid

**Step 1: Update GameUIState interface**

Replace:
```typescript
gridBuildings: Array<{...}>;
gridDeposits: Array<{...}>;
```
With:
```typescript
districts: Array<{
  id: string;
  name: string;
  population: number;
  capacity: number;
  buildingCount: number;
  growthCap: number | null;
}>;
powerStatus: {
  production: number;
  consumption: number;
  balance: number;
  status: string;
};
```

**Step 2: Update syncState()**

Replace grid building/deposit sync with district snapshot sync from the DistrictFacade.

**Step 3: Delete grid renderer files**

Remove `renderBaseGrid.ts` and `isometricUtils.ts` — no grid to render.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: update GameService to sync district state instead of grid"
```

---

## Task 10: Remove Grid System and Building Definitions

**Delete all grid code, grid tests, and removed building definitions.**

**Files to delete:**
- `src/core/models/Grid.ts`
- `src/core/systems/GridManager.ts`
- `src/core/balance/GridBalance.ts`
- `src/core/tick/phases/grid.ts`
- `src/facade/domains/GridFacade.ts`
- `src/facade/domains/PowerGridFacade.ts`
- `src/facade/types/grid.ts`
- `src/renderer/components/BaseGrid/renderBaseGrid.ts`
- `src/renderer/components/BaseGrid/isometricUtils.ts`
- `tests/Grid.test.ts`
- `tests/GridManager.test.ts`
- `tests/GridBalance.test.ts`
- `tests/GridIntegration.test.ts`
- `tests/GridConnectivity.test.ts`
- `tests/GameState-Grid.test.ts`
- `tests/isometricUtils.test.ts`
- `tests/TransitWorkerAssignment.test.ts`

**Files to modify:**
- `src/core/data/buildings.ts` — Remove `HABITAT`, `ADVANCED_HABITAT`, `ROVER_DEPOT` definitions
- `src/core/models/Building.ts` — Remove `HABITAT`, `ADVANCED_HABITAT`, `ROVER_DEPOT` from `BuildingId` enum; remove `depotRange` from `BuildingDefinition`

**Step 1: Delete grid files**

Remove all files listed above.

**Step 2: Remove building definitions**

Remove the three building types from `buildings.ts` data and `BuildingId` enum.

**Step 3: Clean up remaining imports**

Search for any remaining imports of deleted modules and fix them.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove grid system, grid tests, and obsolete building definitions"
```

---

## Task 11: Fix Remaining Test Failures

**Audit and fix all test files that reference grid, housingId, clusters, or removed buildings.**

**Test files likely needing updates:**
- `tests/BuildingManager.test.ts` — remove grid setup, add district setup
- `tests/BuildingsFacade.test.ts` — remove `buildAtPosition`, use `build(defId, districtId)`
- `tests/AutoAssignWorkers.test.ts` — district filtering instead of cluster
- `tests/HousingAssignment.test.ts` — district assignment instead of building housing
- `tests/PrefabConstruction.test.ts` — may reference auto-housing, needs update or removal
- `tests/WorkforceManager.test.ts` — `housingId` → `districtId` in bonding tests
- `tests/GameState.test.ts` — remove grid initialization checks
- `tests/GameFacade.test.ts` — remove grid facade tests
- `tests/DepositDepletion.test.ts` — deposits removed, delete or rework
- `tests/DepositIntegration.test.ts` — deposits removed, delete or rework
- `tests/simulation/HeuristicStrategy.test.ts` — remove grid mocks

**Approach:**
1. Run `bun test` to see all failures
2. Fix each file — prefer updating to deleting
3. Delete test files for removed systems (deposits, grid balance)
4. Re-run until all pass

**Step 1: Run full test suite and capture failures**

Run: `bun test 2>&1 | tail -50`

**Step 2: Fix each failing test file**

Work through failures systematically. For each file:
- Replace `housingId` with `districtId`
- Replace grid/cluster setup with district setup
- Remove grid-specific assertions
- Delete tests for removed features

**Step 3: Run full suite again**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "test: fix all test files for district system migration"
```

---

## Task 12: Verification — Full Test Suite and Simulation

**Final verification that everything works.**

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass, 0 failures

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Run simulation**

Run: `bun run simulate --runs 20 --log silent`
Expected: Simulations complete. Win rate may need tuning but should not crash.

**Step 4: Run build**

Run: `bun run build`
Expected: No TypeScript errors

**Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```

---

## Parallelization Notes

**Sequential dependencies:**
- Task 1 → Task 2 → Task 3 (foundation must be first)
- Task 3 → Tasks 4, 5, 6 (GameState wiring needed before system updates)
- Tasks 4, 5, 6 → Task 7 (systems updated before facades)
- Task 7 → Tasks 8, 9 (facades needed before simulation/renderer)
- Tasks 8, 9, 10 → Task 11 → Task 12

**Parallelizable groups:**
- Tasks 4, 5, 6 can run in parallel (independent system modifications)
- Tasks 8, 9 can run in parallel (simulation and renderer are independent)
- Task 10 can run alongside 8, 9 (file deletion)

## Summary

| Task | Description | Estimated Changes |
|------|-------------|-------------------|
| 1 | District model + balance constants | ~80 lines new |
| 2 | DistrictManager + tests | ~350 lines new |
| 3 | Wire into GameState + tick phases | ~200 lines modified |
| 4 | BuildingManager district routing | ~150 lines modified |
| 5 | ColonyManager district assignment | ~100 lines modified |
| 6 | WorkforceManager neighborhood bonding | ~50 lines modified |
| 7 | Facades (DistrictFacade, remove GridFacade) | ~200 lines new, ~400 lines deleted |
| 8 | HeuristicStrategy update | ~200 lines modified |
| 9 | GameService/Renderer update | ~100 lines modified |
| 10 | Remove grid system + building defs | ~2000 lines deleted |
| 11 | Fix test failures | ~500 lines modified |
| 12 | Final verification | 0 lines |
| **Total** | | **~1200 new, ~2800 deleted = net -1600** |
