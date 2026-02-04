# Research Buildings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fixed research rate with building-driven research where Science Stations and Research Labs produce research output that determines tech progress speed.

**Architecture:** Add `researchOutput` property to `BuildingDefinition`. Technology tick phase calculates total research rate from active research buildings (accounting for staffing/efficiency), passes it to `TechnologyTree.tick()`. Zero buildings = zero progress.

**Tech Stack:** TypeScript, Bun test runner

---

## Task 1: Add researchOutput to BuildingDefinition

**Files:**
- Modify: `src/core/models/Building.ts:44-70`

**Step 1: Add the property to BuildingDefinition interface**

In `src/core/models/Building.ts`, add `researchOutput` property after `depotRange`:

```typescript
  /** Research output per sol when active (for research buildings) */
  researchOutput?: number;
```

**Step 2: Run lint to verify no errors**

Run: `bun run lint`
Expected: No errors related to Building.ts

**Step 3: Commit**

```bash
git add src/core/models/Building.ts
git commit -m "feat(buildings): add researchOutput property to BuildingDefinition"
```

---

## Task 2: Add SCIENCE_STATION to BuildingId enum

**Files:**
- Modify: `src/core/models/Building.ts:6-34`

**Step 1: Add the enum value**

In `BuildingId` enum, add after `ROVER_DEPOT`:

```typescript
  SCIENCE_STATION = "science_station",
```

**Step 2: Run lint to verify no errors**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/models/Building.ts
git commit -m "feat(buildings): add SCIENCE_STATION to BuildingId enum"
```

---

## Task 3: Add Science Station building definition

**Files:**
- Modify: `src/core/data/buildings.ts`

**Step 1: Add Science Station definition**

Add after OXYGEN_GENERATOR (around line 86), before the "Tech-gated buildings" comment:

```typescript
  {
    id: BuildingId.SCIENCE_STATION,
    name: "Science Station",
    description: "Basic research facility for analyzing Martian data",
    cost: { materials: 60 },
    constructionTime: 12,
    powerConsumption: 5,
    workerSlots: 2,
    workerRole: ColonistRole.RESEARCH,
    researchOutput: 1.0,
    airContribution: 0,
    purpose: BuildingPurpose.Industrial,
  },
```

**Step 2: Run lint to verify no errors**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/data/buildings.ts
git commit -m "feat(buildings): add Science Station building definition"
```

---

## Task 4: Add researchOutput to Research Lab

**Files:**
- Modify: `src/core/data/buildings.ts:119-130`

**Step 1: Add researchOutput to Research Lab**

Find RESEARCH_LAB definition and add `researchOutput: 3.0` after `requiredTech`:

```typescript
  {
    id: BuildingId.RESEARCH_LAB,
    name: "Research Lab",
    description: "Speeds up technology research",
    cost: { materials: 150 },
    constructionTime: 25,
    powerConsumption: 10,
    workerSlots: 3,
    workerRole: ColonistRole.RESEARCH,
    requiredTech: TechnologyId.ADVANCED_MATERIALS,
    researchOutput: 3.0,
    airContribution: -1,
    purpose: BuildingPurpose.Industrial,
  },
```

**Step 2: Run lint to verify no errors**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/data/buildings.ts
git commit -m "feat(buildings): add researchOutput to Research Lab"
```

---

## Task 5: Add getTotalResearchOutput method to BuildingManager

**Files:**
- Test: `tests/ResearchBuildings.test.ts` (new file)
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Write the failing test**

Create `tests/ResearchBuildings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { WorkforceManager } from "../src/core/systems/WorkforceManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { BuildingId } from "../src/core/models/Building";
import { ColonistRole } from "../src/core/models/Colonist";

describe("Research Buildings", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;
  let colony: ColonyManager;
  let workforce: WorkforceManager;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      water: 500,
      materials: 500,
    });
    colony = new ColonyManager();
    workforce = new WorkforceManager();

    buildings.setColonyManager(colony);
    buildings.setWorkforceManager(workforce);
  });

  describe("getTotalResearchOutput", () => {
    it("should return 0 when no research buildings exist", () => {
      expect(buildings.getTotalResearchOutput()).toBe(0);
    });

    it("should return research output from active Science Station", () => {
      const id = buildings.startConstruction(BuildingId.SCIENCE_STATION, resources);
      expect(id).not.toBeNull();

      // Complete construction
      const def = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < def.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Without workers, output is 0 (staffing efficiency = 0)
      expect(buildings.getTotalResearchOutput()).toBe(0);
    });

    it("should return full output when fully staffed", () => {
      const id = buildings.startConstruction(BuildingId.SCIENCE_STATION, resources);
      expect(id).not.toBeNull();

      // Complete construction
      const def = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < def.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Add colonists and assign them
      const c1 = colony.addColonist({ role: ColonistRole.RESEARCH });
      const c2 = colony.addColonist({ role: ColonistRole.RESEARCH });
      workforce.assignWorker(c1.id, id!);
      workforce.assignWorker(c2.id, id!);
      buildings.assignWorker(id!, c1.id);
      buildings.assignWorker(id!, c2.id);

      // Fully staffed Science Station = 1.0 output
      expect(buildings.getTotalResearchOutput()).toBeCloseTo(1.0, 1);
    });

    it("should sum output from multiple research buildings", () => {
      // Build Science Station
      const ssId = buildings.startConstruction(BuildingId.SCIENCE_STATION, resources);
      const ssDef = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < ssDef.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Add workers to Science Station
      const c1 = colony.addColonist({ role: ColonistRole.RESEARCH });
      const c2 = colony.addColonist({ role: ColonistRole.RESEARCH });
      workforce.assignWorker(c1.id, ssId!);
      workforce.assignWorker(c2.id, ssId!);
      buildings.assignWorker(ssId!, c1.id);
      buildings.assignWorker(ssId!, c2.id);

      // Build another Science Station
      const ss2Id = buildings.startConstruction(BuildingId.SCIENCE_STATION, resources);
      for (let i = 0; i < ssDef.constructionTime; i++) {
        buildings.tick(resources, i + ssDef.constructionTime);
      }

      // Add workers to second Science Station
      const c3 = colony.addColonist({ role: ColonistRole.RESEARCH });
      const c4 = colony.addColonist({ role: ColonistRole.RESEARCH });
      workforce.assignWorker(c3.id, ss2Id!);
      workforce.assignWorker(c4.id, ss2Id!);
      buildings.assignWorker(ss2Id!, c3.id);
      buildings.assignWorker(ss2Id!, c4.id);

      // Two fully staffed Science Stations = 2.0 output
      expect(buildings.getTotalResearchOutput()).toBeCloseTo(2.0, 1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/ResearchBuildings.test.ts`
Expected: FAIL with "getTotalResearchOutput is not a function"

**Step 3: Write the implementation**

In `src/core/systems/BuildingManager.ts`, add method after `getEffectiveConsumption` (around line 760):

```typescript
  /**
   * Calculate total research output from all active research buildings.
   * Accounts for staffing efficiency, worker efficiency, air quality, and team cohesion.
   * @returns Total research output per sol
   */
  getTotalResearchOutput(): number {
    let total = 0;

    for (const [buildingId, building] of this.buildings) {
      if (building.status !== "active" || building.broken) continue;

      const def = this.definitions.get(building.definitionId);
      if (!def?.researchOutput) continue;

      // Check power state
      if (this.gridManager) {
        const placement = this.gridManager.getPlacement(buildingId);
        if (placement && placement.powerState === PowerState.UNPOWERED) {
          continue;
        }
      }

      const efficiencyMultiplier = this.getBuildingEfficiencyMultiplier(buildingId);
      total += def.researchOutput * efficiencyMultiplier;
    }

    return total;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/ResearchBuildings.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add tests/ResearchBuildings.test.ts src/core/systems/BuildingManager.ts
git commit -m "feat(buildings): add getTotalResearchOutput method"
```

---

## Task 6: Modify TechnologyTree.tick to accept research rate parameter

**Files:**
- Test: `tests/TechnologyTree.test.ts`
- Modify: `src/core/systems/TechnologyTree.ts`

**Step 1: Write the failing test**

Add to `tests/TechnologyTree.test.ts` at the end of the file, inside the main describe block:

```typescript
  describe("Research Rate", () => {
    it("should use provided research rate instead of fixed 1.0", () => {
      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // Tick with research rate of 2.0
      tree.tick(resources, 2.0);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBe(2);
    });

    it("should not progress when research rate is 0", () => {
      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // Tick with research rate of 0
      tree.tick(resources, 0);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBe(0);
    });

    it("should complete research faster with higher rate", () => {
      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);
      const tech = tree.getTech(TechnologyId.WATER_RECYCLING)!;

      // With rate 5.0, need cost.sols / 5 ticks
      const ticksNeeded = Math.ceil(tech.cost.sols / 5);
      for (let i = 0; i < ticksNeeded; i++) {
        tree.tick(resources, 5.0);
      }

      expect(tree.isResearched(TechnologyId.WATER_RECYCLING)).toBe(true);
    });

    it("should default to 0 research rate when not provided", () => {
      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // Tick without research rate (simulates no research buildings)
      tree.tick(resources);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBe(0);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts -t "Research Rate"`
Expected: FAIL - tests expecting rate-based behavior will fail

**Step 3: Modify the implementation**

In `src/core/systems/TechnologyTree.ts`, modify the `tick` method signature and implementation (around line 30):

```typescript
  tick(resources?: ResourceManager, researchRate: number = 0): GameEvent[] {
    const events: GameEvent[] = [];

    if (this.currentResearchId) {
      // Use provided research rate (from buildings) instead of fixed 1.0 + bonus
      const currentProgress = this.researchProgress.get(this.currentResearchId) ?? 0;
      const newProgress = currentProgress + researchRate;
      this.researchProgress.set(this.currentResearchId, newProgress);

      const tech = this.technologies.get(this.currentResearchId);
      if (!tech) {
        this.currentResearchId = null;
        return events;
      }

      if (newProgress >= tech.cost.sols) {
        this.researched.add(this.currentResearchId);
        this.researchProgress.delete(this.currentResearchId);

        // Remove from queue front
        if (this.researchQueue.length > 0 && this.researchQueue[0] === this.currentResearchId) {
          this.researchQueue.shift();
        }

        events.push({
          type: "RESEARCH_COMPLETE",
          techId: this.currentResearchId,
          techName: tech.name,
          severity: "info",
          message: `Research complete: ${tech.name}!`,
        });

        this.currentResearchId = null;
        this.currentResearch = null; // Backward compatibility

        // Auto-start next in queue
        this.tryStartNextInQueue(resources);
      }
    } else if (this.researchQueue.length > 0) {
      // Nothing researching but queue exists - try to start
      this.tryStartNextInQueue(resources);
    }

    return events;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts -t "Research Rate"`
Expected: All "Research Rate" tests PASS

**Step 5: Run all TechnologyTree tests to check for regressions**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: Some existing tests may fail due to default rate of 0

**Step 6: Update existing tests that call tick() without rate**

For tests that expect progress, update them to pass a research rate. Find lines like `tree.tick()` or `tree.tick(resources)` and change to `tree.tick(resources, 1.0)` where progress is expected.

Key tests to update:
- "should complete research after required sols" - use rate 1.0
- "should emit event on research completion" - use rate 1.0
- "should allow researching dependent tech after prerequisite is complete" - use rate 1.0
- All "Research Queue" tests that expect progress - use rate 1.0

**Step 7: Run all TechnologyTree tests again**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: All tests PASS

**Step 8: Commit**

```bash
git add tests/TechnologyTree.test.ts src/core/systems/TechnologyTree.ts
git commit -m "feat(technology): accept research rate parameter in tick()"
```

---

## Task 7: Update technology tick phase to calculate research rate from buildings

**Files:**
- Modify: `src/core/tick/phases/technology.ts`

**Step 1: Update the phase implementation**

Replace contents of `src/core/tick/phases/technology.ts`:

```typescript
import { definePhase } from "../TickPhase";

export const processResearch = definePhase({
  id: "technology:processResearch",
  name: "Process Research",
  reads: ["technology", "resources", "buildings"],
  writes: ["technology", "events"],
  execute(ctx) {
    const researchRate = ctx.buildings.getTotalResearchOutput();
    return ctx.technology.tick(ctx.resources, researchRate);
  },
});
```

**Step 2: Run lint to verify no errors**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/tick/phases/technology.ts
git commit -m "feat(technology): calculate research rate from buildings in tick phase"
```

---

## Task 8: Remove deprecated researchSpeedBonus system

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/BuildingRecycling.test.ts`

**Step 1: Remove researchSpeedBonus from TechnologyTree**

In `src/core/systems/TechnologyTree.ts`:

1. Remove line 12: `private researchSpeedBonus: number = 0;`
2. Remove method `setResearchSpeedBonus` (around line 203-205)
3. Remove `researchSpeedBonus` from `toJSON()` return object
4. Remove `researchSpeedBonus` from `fromJSON()` type and assignment

**Step 2: Update BuildingRecycling.test.ts**

Remove `researchSpeedBonus: 0` from all mock TechnologyTree.fromJSON calls.

**Step 3: Run tests to verify**

Run: `bun test tests/TechnologyTree.test.ts tests/BuildingRecycling.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/BuildingRecycling.test.ts
git commit -m "refactor(technology): remove deprecated researchSpeedBonus system"
```

---

## Task 9: Add integration test for research building workflow

**Files:**
- Modify: `tests/ResearchBuildings.test.ts`

**Step 1: Add integration test**

Add to `tests/ResearchBuildings.test.ts`:

```typescript
  describe("Integration: Research Progress", () => {
    it("should require research building for tech progress", () => {
      const tree = new TechnologyTree(TECHNOLOGIES);

      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // No research buildings = 0 output
      const researchRate = buildings.getTotalResearchOutput();
      expect(researchRate).toBe(0);

      // Tick with 0 rate
      tree.tick(resources, researchRate);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBe(0);
    });

    it("should progress research when Science Station is active and staffed", () => {
      const tree = new TechnologyTree(TECHNOLOGIES);

      // Build and staff Science Station
      const ssId = buildings.startConstruction(BuildingId.SCIENCE_STATION, resources);
      const ssDef = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < ssDef.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      const c1 = colony.addColonist({ role: ColonistRole.RESEARCH });
      const c2 = colony.addColonist({ role: ColonistRole.RESEARCH });
      workforce.assignWorker(c1.id, ssId!);
      workforce.assignWorker(c2.id, ssId!);
      buildings.assignWorker(ssId!, c1.id);
      buildings.assignWorker(ssId!, c2.id);

      // Start research
      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // Get research rate and tick
      const researchRate = buildings.getTotalResearchOutput();
      expect(researchRate).toBeCloseTo(1.0, 1);

      tree.tick(resources, researchRate);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBeCloseTo(1.0, 1);
    });
  });
```

Add import at top:
```typescript
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { TechnologyId } from "../src/core/models/Technology";
```

**Step 2: Run test to verify it passes**

Run: `bun test tests/ResearchBuildings.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/ResearchBuildings.test.ts
git commit -m "test: add integration tests for research building workflow"
```

---

## Task 10: Run full test suite and fix any regressions

**Files:**
- Various test files as needed

**Step 1: Run full test suite**

Run: `bun test`
Expected: Note any new failures (beyond the 11 pre-existing)

**Step 2: Fix any regressions**

If tests fail due to missing research rate parameter in tick() calls, update them to pass appropriate rate.

Common patterns to look for:
- `tree.tick()` → `tree.tick(resources, 1.0)`
- `ctx.technology.tick(...)` calls in other test files

**Step 3: Run full test suite again**

Run: `bun test`
Expected: Same pass/fail count as baseline (989 pass, 11 fail)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: update tests to use research rate parameter"
```

---

## Task 11: Final verification and summary commit

**Step 1: Run lint and format**

Run: `bun run lint && bun run format:check`
Expected: No errors

**Step 2: Run tests one final time**

Run: `bun test`
Expected: 989+ pass, 11 fail (pre-existing)

**Step 3: Review changes**

Run: `git log --oneline main..HEAD`
Verify all commits are present and well-described.

---

## Summary of Changes

1. **BuildingDefinition** - Added `researchOutput?: number` property
2. **BuildingId** - Added `SCIENCE_STATION` enum value
3. **buildings.ts** - Added Science Station (1.0/sol), added researchOutput to Research Lab (3.0/sol)
4. **BuildingManager** - Added `getTotalResearchOutput()` method
5. **TechnologyTree** - Modified `tick()` to accept research rate, removed `researchSpeedBonus`
6. **technology.ts phase** - Calculates research rate from buildings and passes to tick
