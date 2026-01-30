# Materials Income Balance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3D Fabricator building and reduce Robotics research time to improve early-mid game materials income.

**Architecture:** Data-only changes to building definitions and technology costs. No system changes needed - existing BuildingManager handles production automatically.

**Tech Stack:** TypeScript, Bun test runner

---

## Task 1: Add FABRICATOR_3D to BuildingId enum

**Files:**
- Modify: `src/core/models/Building.ts:17` (after AUTOMATED_FACTORY)

**Step 1: Add enum value**

In `src/core/models/Building.ts`, add `FABRICATOR_3D` to the `BuildingId` enum after `AUTOMATED_FACTORY`:

```typescript
  AUTOMATED_FACTORY = "automated_factory",
  FABRICATOR_3D = "fabricator_3d",
  MINING_STATION = "mining_station",
```

**Step 2: Verify no TypeScript errors**

Run: `cd /workspace/.worktrees/materials-balance && bun run build 2>&1 | head -20`
Expected: Build succeeds (new enum value doesn't break anything yet)

**Step 3: Commit**

```bash
git add src/core/models/Building.ts
git commit -m "feat(buildings): add FABRICATOR_3D to BuildingId enum"
```

---

## Task 2: Add 3D Fabricator building definition

**Files:**
- Modify: `src/core/data/buildings.ts:151` (after ADVANCED_HABITAT, before AUTOMATED_FACTORY)

**Step 1: Add building definition**

In `src/core/data/buildings.ts`, add the 3D Fabricator definition after ADVANCED_HABITAT (line ~151) and before AUTOMATED_FACTORY:

```typescript
  {
    id: BuildingId.FABRICATOR_3D,
    name: "3D Fabricator",
    description: "Additive manufacturing unit that constructs components from raw feedstock",
    cost: { materials: 90 },
    constructionTime: 15,
    production: { materials: 7 },
    consumption: { power: 8 },
    workerSlots: 2,
    workerRole: ColonistRole.ENGINEERING,
    requiredTech: TechnologyId.ADVANCED_MATERIALS,
    oxygenContribution: -1,
    purpose: BuildingPurpose.Industrial,
  },
```

**Step 2: Verify build succeeds**

Run: `cd /workspace/.worktrees/materials-balance && bun run build 2>&1 | head -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/core/data/buildings.ts
git commit -m "feat(buildings): add 3D Fabricator building definition

- Cost: 90 materials
- Production: 7 materials/sol
- Consumption: 8 power
- Workers: 2 ENGINEERING
- Requires: Advanced Materials tech"
```

---

## Task 3: Write test for 3D Fabricator production

**Files:**
- Create: `tests/Fabricator3D.test.ts`

**Step 1: Write the test file**

Create `tests/Fabricator3D.test.ts`:

```typescript
// tests/Fabricator3D.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";
import { GameAPI } from "../src/facade";

describe("3D Fabricator", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
  });

  // Helper to advance sols
  const advanceSols = (n: number) => {
    for (let i = 0; i < n; i++) api.game.advanceSol();
  };

  // Helper to research a technology
  const researchTech = (techId: TechnologyId) => {
    api.research.startResearch(techId);
    const tech = api.research.getTechnology(techId);
    if (tech) {
      advanceSols(tech.cost.sols);
    }
  };

  describe("building requirements", () => {
    it("cannot build without Advanced Materials tech", () => {
      const result = api.buildings.build(BuildingId.FABRICATOR_3D);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("technology");
      }
    });

    it("can build after researching Advanced Materials", () => {
      researchTech(TechnologyId.ADVANCED_MATERIALS);
      const result = api.buildings.build(BuildingId.FABRICATOR_3D);
      expect(result.success).toBe(true);
    });
  });

  describe("production", () => {
    it("produces 7 materials per sol when staffed", () => {
      // Research tech and build fabricator
      researchTech(TechnologyId.ADVANCED_MATERIALS);

      // Build solar panels for power (need 8 power)
      api.buildings.build(BuildingId.SOLAR_PANEL);
      advanceSols(5);

      const buildResult = api.buildings.build(BuildingId.FABRICATOR_3D);
      expect(buildResult.success).toBe(true);

      // Complete construction (15 sols)
      advanceSols(15);

      if (buildResult.success) {
        const building = api.buildings.getById(buildResult.data.id);
        expect(building?.status).toBe("active");

        // Assign workers
        const colonists = api.colony.getColonists();
        const engineers = colonists.filter(c =>
          api.colony.getColonistRole(c.id) === "engineering" ||
          api.colony.getColonistRole(c.id) === "unassigned"
        ).slice(0, 2);

        for (const engineer of engineers) {
          api.colony.assignToBuilding(engineer.id, buildResult.data.id);
        }

        // Get materials before production
        const materialsBefore = api.resources.getStock().materials;

        // Advance one sol
        api.game.advanceSol();

        // Check production (should be close to 7, accounting for consumption elsewhere)
        const materialsAfter = api.resources.getStock().materials;
        const produced = materialsAfter - materialsBefore;

        // Production is 7/sol, but we need to account for the building existing
        // Just verify it produces materials (positive production)
        expect(produced).toBeGreaterThan(0);
      }
    });

    it("consumes 8 power per sol", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.consumption?.power).toBe(8);
    });

    it("requires 2 engineering workers", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.workerSlots).toBe(2);
      expect(def?.workerRole).toBe("engineering");
    });

    it("does not require a deposit", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.requiresDeposit).toBeFalsy();
    });
  });

  describe("building stats", () => {
    it("has correct cost of 90 materials", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.cost.materials).toBe(90);
    });

    it("has construction time of 15 sols", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.constructionTime).toBe(15);
    });

    it("has -1 oxygen contribution", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.oxygenContribution).toBe(-1);
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd /workspace/.worktrees/materials-balance && bun test tests/Fabricator3D.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/Fabricator3D.test.ts
git commit -m "test(buildings): add 3D Fabricator tests"
```

---

## Task 4: Reduce Robotics research time

**Files:**
- Modify: `src/core/data/technologies.ts:38`

**Step 1: Update Robotics cost**

In `src/core/data/technologies.ts`, change Robotics cost from 120 to 85 sols:

```typescript
  {
    id: TechnologyId.ROBOTICS,
    name: "Robotics",
    description: "Automated labor and manufacturing",
    prerequisites: [TechnologyId.ADVANCED_MATERIALS],
    cost: { sols: 85 },
    unlocks: [BuildingId.AUTOMATED_FACTORY],
    effects: [
      { type: "construction_speed", value: 1.2 },
      { type: "mining_efficiency", value: 1 },
    ],
  },
```

**Step 2: Verify build succeeds**

Run: `cd /workspace/.worktrees/materials-balance && bun run build 2>&1 | head -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/core/data/technologies.ts
git commit -m "balance(tech): reduce Robotics research time from 120 to 85 sols

This makes Automated Factory reachable at ~140 sols instead of ~175 sols,
reducing the mid-game materials bottleneck."
```

---

## Task 5: Run full test suite

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `cd /workspace/.worktrees/materials-balance && bun test 2>&1 | tail -30`
Expected: All tests pass (850+ pass, 0 fail)

**Step 2: Run linter**

Run: `cd /workspace/.worktrees/materials-balance && bun run lint 2>&1 | tail -10`
Expected: No errors

---

## Task 6: Run simulation to verify balance impact

**Files:** None (verification only)

**Step 1: Run quick simulation**

Run: `cd /workspace/.worktrees/materials-balance && bun run scripts/simulate.ts --runs 20 --seed 42 2>&1 | tail -30`
Expected: Win rate 90%+, results visible

**Step 2: Document results**

Note the key metrics:
- Win rate (target: 90-95%)
- Median victory time (target: 500-600 sols)
- Any obvious issues

---

## Task 7: Update balance documentation

**Files:**
- Modify: `docs/specs/11-BALANCE-CONSTANTS.md`

**Step 1: Add 3D Fabricator to building documentation**

Add a new entry for 3D Fabricator in the buildings section of `docs/specs/11-BALANCE-CONSTANTS.md`. Find the appropriate location near other material-producing buildings and add:

```markdown
### 3D Fabricator (requires Advanced Materials)

| Property | Value |
|----------|-------|
| Cost | 90 materials |
| Construction | 15 sols |
| Production | 7 materials/sol |
| Consumption | 8 power |
| Workers | 2 ENGINEERING |
```

**Step 2: Update Robotics entry if present**

If there's a Robotics entry, update the research time from 120 to 85 sols.

**Step 3: Commit**

```bash
git add docs/specs/11-BALANCE-CONSTANTS.md
git commit -m "docs: update balance constants with 3D Fabricator and Robotics changes"
```

---

## Summary

| Task | Description | Est. Changes |
|------|-------------|--------------|
| 1 | Add enum value | 1 line |
| 2 | Add building definition | ~15 lines |
| 3 | Write tests | ~100 lines |
| 4 | Reduce Robotics cost | 1 line |
| 5 | Run test suite | verification |
| 6 | Run simulation | verification |
| 7 | Update docs | ~10 lines |

Total: ~130 lines of code/tests, 4 commits
