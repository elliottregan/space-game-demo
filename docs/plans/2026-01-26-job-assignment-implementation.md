# Job Assignment System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable colonists to be assigned to building worker slots, with staffing affecting production via diminishing returns.

**Architecture:** Core logic in WorkforceManager and BuildingManager, facade methods in ColonyFacade and BuildingsFacade, UI in ColonistCard with workplace dropdown.

**Tech Stack:** TypeScript, Vue 3, Bun test runner

---

### Task 1: Add Balance Constants

**Files:**
- Modify: `src/core/balance/WorkforceBalance.ts`

**Step 1: Add the new constants**

Add at end of file:

```typescript
// Job assignment system constants
export const ROLE_MISMATCH_PENALTY = 0.3;           // 30% efficiency penalty
export const TRAINING_WORK_PENALTY = 0.5;           // 50% efficiency while training
export const LABOR_POOL_BONUS_PER_COLONIST = 0.02;  // +2% construction speed
export const LABOR_POOL_BONUS_CAP = 0.2;            // +20% max
export const STAFFING_CURVE_EXPONENT = 1.5;         // Diminishing returns curve
```

**Step 2: Commit**

```bash
git add src/core/balance/WorkforceBalance.ts
git commit -m "feat: add job assignment balance constants"
```

---

### Task 2: Add WorkforceManager Helper Methods

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`
- Create: `tests/JobAssignment.test.ts`

**Step 1: Write the failing test for getColonistWorkplace**

Create `tests/JobAssignment.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { ColonistRole } from "../src/core/models/Colonist";

describe("Job Assignment", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("getColonistWorkplace", () => {
    it("returns undefined for unassigned colonist", () => {
      const colonist = gameState.colony.getColonists()[0];
      const workplace = gameState.workforce.getColonistWorkplace(
        colonist.id,
        gameState.buildings
      );
      expect(workplace).toBeUndefined();
    });

    it("returns building id when colonist is assigned", () => {
      // Build a basic farm (has workerSlots)
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      expect(farm).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const workplace = gameState.workforce.getColonistWorkplace(
        colonist.id,
        gameState.buildings
      );
      expect(workplace).toBe(farm!.id);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL with "getColonistWorkplace is not a function"

**Step 3: Implement getColonistWorkplace in WorkforceManager**

Add to `src/core/systems/WorkforceManager.ts` after the imports:

```typescript
import type { BuildingManager } from "./BuildingManager";
```

Add method to WorkforceManager class:

```typescript
  /**
   * Find the building where a colonist is assigned to work.
   * Returns undefined if colonist is not assigned to any building.
   */
  getColonistWorkplace(colonistId: string, buildings: BuildingManager): string | undefined {
    for (const building of buildings.getBuildings()) {
      if (building.assignedWorkers.includes(colonistId)) {
        return building.id;
      }
    }
    return undefined;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/WorkforceManager.ts tests/JobAssignment.test.ts
git commit -m "feat: add getColonistWorkplace to WorkforceManager"
```

---

### Task 3: Add Staffing Efficiency Calculation

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Write failing test for getStaffingEfficiency**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("getStaffingEfficiency", () => {
    it("returns 0 for building with no workers when slots required", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      expect(efficiency).toBe(0);
    });

    it("returns 1 for building without worker slots", () => {
      const solar = gameState.buildings.startBuilding(
        "solar_panel",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 10; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getStaffingEfficiency(solar!.id);
      expect(efficiency).toBe(1);
    });

    it("returns diminishing returns value for partial staffing", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 1 of 2 workers (50% staffing)
      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      // Formula: 1 - (1 - 0.5)^1.5 ≈ 0.646
      expect(efficiency).toBeCloseTo(0.646, 2);
    });

    it("returns 1 for fully staffed building", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 2 of 2 workers (100% staffing)
      const colonists = gameState.colony.getColonists();
      gameState.buildings.assignWorker(farm!.id, colonists[0].id);
      gameState.buildings.assignWorker(farm!.id, colonists[1].id);

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      expect(efficiency).toBe(1);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL with "getStaffingEfficiency is not a function"

**Step 3: Implement getStaffingEfficiency in BuildingManager**

Add import at top of `src/core/systems/BuildingManager.ts`:

```typescript
import { STAFFING_CURVE_EXPONENT } from "../balance/WorkforceBalance";
```

Add method to BuildingManager class:

```typescript
  /**
   * Calculate staffing efficiency using diminishing returns curve.
   * Returns 1 for buildings without worker slots.
   * Formula: 1 - (1 - staffingRatio)^STAFFING_CURVE_EXPONENT
   */
  getStaffingEfficiency(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    const def = this.definitions.get(building.definitionId);
    if (!def || !def.workerSlots) return 1; // No worker slots = always full efficiency

    if (building.assignedWorkers.length === 0) return 0;

    const staffingRatio = building.assignedWorkers.length / def.workerSlots;
    return 1 - Math.pow(1 - staffingRatio, STAFFING_CURVE_EXPONENT);
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/JobAssignment.test.ts
git commit -m "feat: add getStaffingEfficiency with diminishing returns"
```

---

### Task 4: Add Worker Efficiency Calculation

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Write failing test for getWorkerEfficiency**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("getWorkerEfficiency", () => {
    it("returns 1 for building without worker slots", () => {
      const solar = gameState.buildings.startBuilding(
        "solar_panel",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 10; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getWorkerEfficiency(solar!.id);
      expect(efficiency).toBe(1);
    });

    it("returns 1 for building with no workers assigned", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
      expect(efficiency).toBe(1); // No workers = base efficiency (staffing handles the 0)
    });

    it("applies role mismatch penalty", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Find a non-farmer colonist
      const colonists = gameState.colony.getColonists();
      const nonFarmer = colonists.find((c) => c.role !== ColonistRole.FARMING);
      if (nonFarmer) {
        gameState.buildings.assignWorker(farm!.id, nonFarmer.id);
        const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
        // Should include 30% role mismatch penalty: base * 0.7
        expect(efficiency).toBeLessThan(1);
      }
    });

    it("applies training penalty", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Start training a colonist
      const colonist = gameState.colony.getColonists()[0];
      gameState.workforce.startTraining(colonist, ColonistRole.FARMING);
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
      // Should include 50% training penalty
      expect(efficiency).toBeLessThan(1);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL with "getWorkerEfficiency is not a function"

**Step 3: Implement getWorkerEfficiency in BuildingManager**

Add imports at top of `src/core/systems/BuildingManager.ts`:

```typescript
import {
  STAFFING_CURVE_EXPONENT,
  ROLE_MISMATCH_PENALTY,
  TRAINING_WORK_PENALTY,
  MASTERY_EFFICIENCY,
  MAX_SKILL_EFFICIENCY_BONUS,
} from "../balance/WorkforceBalance";
import { SKILLS } from "../data/skills";
import type { Colonist } from "../models/Colonist";
import type { ColonyManager } from "./ColonyManager";
```

Add private field and setter to BuildingManager:

```typescript
  private colonyManager: ColonyManager | null = null;

  setColonyManager(colony: ColonyManager): void {
    this.colonyManager = colony;
  }
```

Add method to BuildingManager class:

```typescript
  /**
   * Calculate average worker efficiency for a building.
   * Factors in: mastery, skills, role mismatch penalty, training penalty.
   * Returns 1 if no workers assigned or building has no worker slots.
   */
  getWorkerEfficiency(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    const def = this.definitions.get(building.definitionId);
    if (!def || !def.workerSlots) return 1;
    if (building.assignedWorkers.length === 0) return 1;

    if (!this.colonyManager) return 1;

    let totalEfficiency = 0;
    for (const colonistId of building.assignedWorkers) {
      const colonist = this.colonyManager.getColonist(colonistId);
      if (!colonist) continue;

      let efficiency = this.calculateSingleWorkerEfficiency(colonist, def.workerRole);
      totalEfficiency += efficiency;
    }

    return totalEfficiency / building.assignedWorkers.length;
  }

  private calculateSingleWorkerEfficiency(
    colonist: Colonist,
    requiredRole?: ColonistRole
  ): number {
    // Base mastery efficiency
    let efficiency = MASTERY_EFFICIENCY[colonist.masteryLevel] ?? 1;

    // Add skill bonus (capped)
    let skillBonus = 0;
    for (const skillId of colonist.skills) {
      const skill = SKILLS.find((s) => s.id === skillId);
      if (skill?.affinity.includes(colonist.role)) {
        skillBonus += skill.efficiencyBonus;
      }
    }
    skillBonus = Math.min(skillBonus, MAX_SKILL_EFFICIENCY_BONUS);
    efficiency += skillBonus;

    // Role mismatch penalty
    if (requiredRole && colonist.role !== requiredRole) {
      efficiency *= (1 - ROLE_MISMATCH_PENALTY);
    }

    // Training penalty
    if (colonist.trainingTarget) {
      efficiency *= (1 - TRAINING_WORK_PENALTY);
    }

    return efficiency;
  }
```

Add import for ColonistRole if not present:

```typescript
import type { ColonistRole } from "../models/Colonist";
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/JobAssignment.test.ts
git commit -m "feat: add getWorkerEfficiency with role/training penalties"
```

---

### Task 5: Wire ColonyManager into BuildingManager in GameState

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Add setColonyManager call in GameState constructor**

In `src/core/GameState.ts`, find where `this.buildings` and `this.colony` are initialized. After both are created, add:

```typescript
this.buildings.setColonyManager(this.colony);
```

Also add it in the `fromJSON` static method after restoring managers.

**Step 2: Run all tests to verify nothing breaks**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat: wire ColonyManager into BuildingManager"
```

---

### Task 6: Integrate Staffing into Production/Consumption

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Write failing test for staffing affecting production**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("staffing affects production", () => {
    it("unstaffed building with worker slots produces nothing", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBe(0);
    });

    it("fully staffed building produces at full rate", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 2 of 2 workers
      const colonists = gameState.colony.getColonists();
      // Find farmers for best efficiency
      const farmers = colonists.filter((c) => c.role === ColonistRole.FARMING);
      if (farmers.length >= 2) {
        gameState.buildings.assignWorker(farm!.id, farmers[0].id);
        gameState.buildings.assignWorker(farm!.id, farmers[1].id);
      } else {
        gameState.buildings.assignWorker(farm!.id, colonists[0].id);
        gameState.buildings.assignWorker(farm!.id, colonists[1].id);
      }

      const production = gameState.buildings.getEffectiveProduction(farm!.id);
      // Basic farm produces 10 food, staffing multiplier = 1
      // Worker efficiency depends on colonist stats
      expect(production.food).toBeGreaterThan(0);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL (unstaffed building still produces food)

**Step 3: Modify getEffectiveProduction to include staffing**

In `src/core/systems/BuildingManager.ts`, update `getEffectiveProduction`:

```typescript
  getEffectiveProduction(buildingId: string, overrideCondition?: number): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.production) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].production;
    const condition = overrideCondition ?? building.condition;
    const conditionMultiplier = this.getConditionMultiplier(condition);
    const oxygenMultiplier = this.getOxygenDeficitMultiplier();
    const staffingMultiplier = this.getStaffingEfficiency(buildingId);
    const workerMultiplier = this.getWorkerEfficiency(buildingId);
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.production)) {
      if (value)
        result[key as keyof ResourceDelta] =
          value * modeMultiplier * conditionMultiplier * oxygenMultiplier * staffingMultiplier * workerMultiplier;
    }

    return result;
  }
```

Similarly update `getEffectiveConsumption`:

```typescript
  getEffectiveConsumption(buildingId: string, overrideCondition?: number): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.consumption) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].consumption;
    const condition = overrideCondition ?? building.condition;
    const conditionMultiplier = this.getConditionMultiplier(condition);
    const oxygenMultiplier = this.getOxygenDeficitMultiplier();
    const staffingMultiplier = this.getStaffingEfficiency(buildingId);
    const workerMultiplier = this.getWorkerEfficiency(buildingId);
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.consumption)) {
      if (value)
        result[key as keyof ResourceDelta] =
          value * modeMultiplier * conditionMultiplier * oxygenMultiplier * staffingMultiplier * workerMultiplier;
    }

    return result;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `bun test`
Expected: All pass (some existing tests may need adjustment if they relied on unstaffed production)

**Step 6: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/JobAssignment.test.ts
git commit -m "feat: integrate staffing efficiency into production/consumption"
```

---

### Task 7: Add Labor Pool Construction Bonus

**Files:**
- Modify: `src/core/GameState.ts`
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Write failing test for labor pool bonus**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("labor pool bonus", () => {
    it("unassigned colonists boost construction speed", () => {
      // Count unassigned colonists
      const colonists = gameState.colony.getColonists();
      const assignedIds = new Set<string>();
      for (const building of gameState.buildings.getBuildings()) {
        for (const id of building.assignedWorkers) {
          assignedIds.add(id);
        }
      }
      const unassignedCount = colonists.filter((c) => !assignedIds.has(c.id)).length;

      // Expected bonus: 2% per unassigned, capped at 20%
      const expectedBonus = Math.min(unassignedCount * 0.02, 0.2);

      // The GameState should apply this bonus
      gameState.tick(); // Trigger recalculation

      // Check that construction speed bonus is set
      // We'll verify by checking the building manager's bonus
      expect(gameState.getConstructionSpeedBonus()).toBeCloseTo(expectedBonus, 2);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL with "getConstructionSpeedBonus is not a function"

**Step 3: Add labor pool calculation to GameState**

In `src/core/GameState.ts`, add method:

```typescript
  getConstructionSpeedBonus(): number {
    return this.buildings.getConstructionSpeedBonus();
  }

  private updateLaborPoolBonus(): void {
    const colonists = this.colony.getColonists();
    const assignedIds = new Set<string>();

    for (const building of this.buildings.getBuildings()) {
      for (const id of building.assignedWorkers) {
        assignedIds.add(id);
      }
    }

    const unassignedCount = colonists.filter((c) => !assignedIds.has(c.id)).length;
    const bonus = Math.min(
      unassignedCount * LABOR_POOL_BONUS_PER_COLONIST,
      LABOR_POOL_BONUS_CAP
    );

    this.buildings.setConstructionSpeedBonus(bonus);
  }
```

Add import:

```typescript
import { LABOR_POOL_BONUS_PER_COLONIST, LABOR_POOL_BONUS_CAP } from "./balance/WorkforceBalance";
```

Call `updateLaborPoolBonus()` at the start of the `tick()` method.

In BuildingManager, add getter:

```typescript
  getConstructionSpeedBonus(): number {
    return this.constructionSpeedBonus;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/GameState.ts src/core/systems/BuildingManager.ts tests/JobAssignment.test.ts
git commit -m "feat: add labor pool construction speed bonus"
```

---

### Task 8: Add Assignment Validation

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Write failing test for duplicate assignment prevention**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("assignment validation", () => {
    it("prevents assigning colonist to multiple buildings", () => {
      // Build two farms
      const farm1 = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      const farm2 = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );

      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const colonist = gameState.colony.getColonists()[0];

      // Assign to first farm
      const result1 = gameState.buildings.assignWorker(farm1!.id, colonist.id);
      expect(result1).toBe(true);

      // Try to assign to second farm - should fail
      const result2 = gameState.buildings.assignWorker(farm2!.id, colonist.id);
      expect(result2).toBe(false);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL (colonist can be assigned to both buildings)

**Step 3: Update assignWorker to check for existing assignment**

In `src/core/systems/BuildingManager.ts`, update `assignWorker`:

```typescript
  assignWorker(buildingId: string, colonistId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active") return false;

    const def = this.definitions.get(building.definitionId);
    if (!def || !def.workerSlots || building.assignedWorkers.length >= def.workerSlots)
      return false;

    if (building.assignedWorkers.includes(colonistId)) return false;

    // Check if colonist is already assigned elsewhere
    for (const b of this.buildings.values()) {
      if (b.assignedWorkers.includes(colonistId)) {
        return false;
      }
    }

    building.assignedWorkers.push(colonistId);
    return true;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/JobAssignment.test.ts
git commit -m "feat: prevent colonist from being assigned to multiple buildings"
```

---

### Task 9: Auto-unassign on Colonist Death

**Files:**
- Modify: `src/core/systems/ColonyManager.ts`
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Write failing test for auto-unassign on death**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("colonist death", () => {
    it("removes colonist from building assignment on death", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      // Verify assignment
      const building = gameState.buildings.getBuilding(farm!.id);
      expect(building?.assignedWorkers).toContain(colonist.id);

      // Kill the colonist (simulate via removeColonist if available, or direct manipulation)
      gameState.colony.removeColonist(colonist.id, gameState.buildings);

      // Verify unassigned
      const updatedBuilding = gameState.buildings.getBuilding(farm!.id);
      expect(updatedBuilding?.assignedWorkers).not.toContain(colonist.id);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/JobAssignment.test.ts`
Expected: FAIL (removeColonist doesn't exist or doesn't unassign)

**Step 3: Add removeColonist method to ColonyManager**

In `src/core/systems/ColonyManager.ts`, add method:

```typescript
  removeColonist(colonistId: string, buildings: BuildingManager): boolean {
    const index = this.colonists.findIndex((c) => c.id === colonistId);
    if (index === -1) return false;

    // Remove from any building assignments
    for (const building of buildings.getBuildings()) {
      buildings.removeWorker(building.id, colonistId);
    }

    // Remove from housing
    const colonist = this.colonists[index];
    if (colonist.housingId) {
      this.unassignHousing(colonistId);
    }

    this.colonists.splice(index, 1);
    return true;
  }
```

Add import if needed:

```typescript
import type { BuildingManager } from "./BuildingManager";
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/ColonyManager.ts tests/JobAssignment.test.ts
git commit -m "feat: auto-unassign colonist from buildings on death"
```

---

### Task 10: Add Facade Methods for Assignment

**Files:**
- Modify: `src/facade/domains/ColonyFacade.ts`
- Modify: `tests/ColonyFacade.test.ts`

**Step 1: Write failing test for assignToBuilding**

Add to `tests/ColonyFacade.test.ts`:

```typescript
  describe("assignToBuilding", () => {
    it("should assign colonist to building", () => {
      // Build a farm
      api.buildings.startBuilding("basic_farm");

      // Complete construction
      for (let i = 0; i < 15; i++) {
        api.flow.tick();
      }

      const colonist = api.colony.snapshot().colonists[0];
      const buildings = api.buildings.snapshot().buildings;
      const farm = buildings.find((b) => b.template.id === "basic_farm");

      const result = api.colony.assignToBuilding(colonist.id, farm!.id);
      expect(result.ok).toBe(true);
    });

    it("should fail if colonist already assigned", () => {
      // Build two farms
      api.buildings.startBuilding("basic_farm");
      api.buildings.startBuilding("basic_farm");

      for (let i = 0; i < 15; i++) {
        api.flow.tick();
      }

      const colonist = api.colony.snapshot().colonists[0];
      const buildings = api.buildings.snapshot().buildings;
      const farms = buildings.filter((b) => b.template.id === "basic_farm");

      api.colony.assignToBuilding(colonist.id, farms[0].id);
      const result = api.colony.assignToBuilding(colonist.id, farms[1].id);

      expect(result.ok).toBe(false);
    });
  });

  describe("unassignFromBuilding", () => {
    it("should unassign colonist from building", () => {
      api.buildings.startBuilding("basic_farm");
      for (let i = 0; i < 15; i++) {
        api.flow.tick();
      }

      const colonist = api.colony.snapshot().colonists[0];
      const buildings = api.buildings.snapshot().buildings;
      const farm = buildings.find((b) => b.template.id === "basic_farm");

      api.colony.assignToBuilding(colonist.id, farm!.id);
      const result = api.colony.unassignFromBuilding(colonist.id);

      expect(result.ok).toBe(true);
    });
  });

  describe("getColonistWorkplace", () => {
    it("should return building id for assigned colonist", () => {
      api.buildings.startBuilding("basic_farm");
      for (let i = 0; i < 15; i++) {
        api.flow.tick();
      }

      const colonist = api.colony.snapshot().colonists[0];
      const buildings = api.buildings.snapshot().buildings;
      const farm = buildings.find((b) => b.template.id === "basic_farm");

      api.colony.assignToBuilding(colonist.id, farm!.id);

      const workplace = api.colony.getWorkplace(colonist.id);
      expect(workplace).toBe(farm!.id);
    });

    it("should return undefined for unassigned colonist", () => {
      const colonist = api.colony.snapshot().colonists[0];
      const workplace = api.colony.getWorkplace(colonist.id);
      expect(workplace).toBeUndefined();
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/ColonyFacade.test.ts`
Expected: FAIL (methods don't exist)

**Step 3: Implement facade methods in ColonyFacade**

Add to `src/facade/domains/ColonyFacade.ts`:

```typescript
  /**
   * Assign a colonist to work at a building.
   */
  assignToBuilding(colonistId: string, buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const colonist = this.gameState.colony.getColonist(colonistId);
      if (!colonist) {
        return err({
          type: "NOT_FOUND",
          entity: "colonist",
          id: colonistId,
        });
      }

      const success = this.gameState.buildings.assignWorker(buildingId, colonistId);
      if (!success) {
        return err({
          type: "INVALID_STATE",
          current: "cannot assign",
          expected: "assignable",
          reason: "Building full, colonist already assigned, or building not active",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Unassign a colonist from their current building.
   */
  unassignFromBuilding(colonistId: string): Result<void> {
    return this.executeCommand(() => {
      const workplace = this.gameState.workforce.getColonistWorkplace(
        colonistId,
        this.gameState.buildings
      );

      if (!workplace) {
        return err({
          type: "INVALID_STATE",
          current: "not assigned",
          expected: "assigned",
          reason: "Colonist is not assigned to any building",
        });
      }

      this.gameState.buildings.removeWorker(workplace, colonistId);
      return ok(undefined);
    });
  }

  /**
   * Get the building ID where a colonist works, or undefined if unassigned.
   */
  getWorkplace(colonistId: string): string | undefined {
    return this.gameState.workforce.getColonistWorkplace(
      colonistId,
      this.gameState.buildings
    );
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/ColonyFacade.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/facade/domains/ColonyFacade.ts tests/ColonyFacade.test.ts
git commit -m "feat: add job assignment facade methods"
```

---

### Task 11: Add Facade Type Exports

**Files:**
- Modify: `src/facade/types/index.ts`

**Step 1: Export workplace-related types if needed**

Check if types need to be added. Usually the existing types suffice. Just verify the facade exports are complete.

**Step 2: Commit if changes made**

```bash
git add src/facade/types/index.ts
git commit -m "chore: export job assignment types from facade"
```

---

### Task 12: Add UI - Workplace Dropdown to ColonistCard

**Files:**
- Modify: `src/renderer/components/ColonyPanel/ColonistCard.vue`
- Modify: `src/renderer/services/GameService.ts` (if needed for new methods)

**Step 1: Update ColonistCard to show workplace**

In `src/renderer/components/ColonyPanel/ColonistCard.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { MASTERY_DISPLAY_NAMES, ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import type { Colonist, SkillDefinition, PlacedBuilding } from "../../../facade";
import { useGame } from "../../composables/useGame";
import ColonistSkillBadge from "./ColonistSkillBadge.vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
}>();

const { gameService } = useGame();

const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

function isSkillActive(skill: SkillDefinition): boolean {
  return skill.affinity.includes(props.colonist.role);
}

const workplace = computed(() => {
  return gameService.api.colony.getWorkplace(props.colonist.id);
});

const workplaceBuilding = computed(() => {
  if (!workplace.value) return null;
  const buildings = gameService.api.buildings.snapshot().buildings;
  return buildings.find((b) => b.id === workplace.value) ?? null;
});

const availableWorkplaces = computed(() => {
  const buildings = gameService.api.buildings.snapshot().buildings;
  return buildings.filter((b) => {
    if (!b.template.workerSlots) return false;
    if (b.constructionProgress) return false; // Still under construction
    const current = b.workers ?? 0;
    return current < b.template.workerSlots;
  });
});

function assignToBuilding(buildingId: string) {
  if (buildingId === "") {
    gameService.api.colony.unassignFromBuilding(props.colonist.id);
  } else {
    // Unassign first if already assigned
    if (workplace.value) {
      gameService.api.colony.unassignFromBuilding(props.colonist.id);
    }
    gameService.api.colony.assignToBuilding(props.colonist.id, buildingId);
  }
}

function roleMatches(building: PlacedBuilding): boolean {
  return building.template.workerRole === props.colonist.role;
}
</script>

<template>
  <div class="colonist-card">
    <div class="colonist-header">
      <span class="colonist-name">{{ colonist.name }}</span>
      <span class="colonist-role">{{ ROLE_DISPLAY_NAMES[colonist.role] }}</span>
    </div>
    <div class="colonist-mastery">{{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }}</div>
    <div class="colonist-skills" v-if="colonistSkills.length > 0">
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="isSkillActive(skill)"
      />
    </div>
    <div class="colonist-workplace">
      <label class="workplace-label">Workplace:</label>
      <select
        class="workplace-select"
        :value="workplace ?? ''"
        @change="assignToBuilding(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Unassigned (Labor Pool)</option>
        <option
          v-for="building in availableWorkplaces"
          :key="building.id"
          :value="building.id"
          :disabled="building.id !== workplace && (building.workers ?? 0) >= (building.template.workerSlots ?? 0)"
        >
          {{ building.template.name }} ({{ building.workers ?? 0 }}/{{ building.template.workerSlots }})
          {{ roleMatches(building) ? '✓' : '⚠' }}
        </option>
        <option
          v-if="workplaceBuilding && !availableWorkplaces.find(b => b.id === workplace)"
          :value="workplace"
        >
          {{ workplaceBuilding.template.name }} ({{ workplaceBuilding.workers ?? 0 }}/{{ workplaceBuilding.template.workerSlots }})
          {{ roleMatches(workplaceBuilding) ? '✓' : '⚠' }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.colonist-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.colonist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.colonist-name {
  font-weight: bold;
  font-size: var(--g-font-size-sm);
}

.colonist-role {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.colonist-mastery {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.colonist-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: var(--g-space-xs);
}

.colonist-workplace {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  margin-top: var(--g-space-xs);
  padding-top: var(--g-space-xs);
  border-top: 1px solid var(--g-color-border);
}

.workplace-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.workplace-select {
  flex: 1;
  font-size: var(--g-font-size-xs);
  padding: 2px 4px;
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  color: var(--g-color-text);
}
</style>
```

**Step 2: Test manually in dev server**

Run: `bun run dev`
Verify: Colony panel shows workplace dropdown for each colonist

**Step 3: Commit**

```bash
git add src/renderer/components/ColonyPanel/ColonistCard.vue
git commit -m "feat: add workplace assignment dropdown to ColonistCard"
```

---

### Task 13: Update BuildingsSnapshot to Include Worker Count

**Files:**
- Modify: `src/facade/domains/BuildingsFacade.ts`

**Step 1: Ensure PlacedBuilding includes worker count**

Check `src/facade/domains/BuildingsFacade.ts` and ensure the `workers` field is populated in the snapshot:

```typescript
// In the method that creates PlacedBuilding objects
workers: building.assignedWorkers.length,
```

**Step 2: Run tests and verify**

Run: `bun test`
Expected: All pass

**Step 3: Commit if changes made**

```bash
git add src/facade/domains/BuildingsFacade.ts
git commit -m "feat: include worker count in building snapshot"
```

---

### Task 14: Run Full Test Suite and Fix Any Failures

**Files:**
- Various test files

**Step 1: Run all tests**

Run: `bun test`

**Step 2: Fix any failing tests**

Some existing tests may fail because they relied on buildings producing without workers. Update those tests to assign workers before checking production.

**Step 3: Commit fixes**

```bash
git add .
git commit -m "fix: update tests for job assignment system"
```

---

### Task 15: Final Integration Test

**Files:**
- Modify: `tests/JobAssignment.test.ts`

**Step 1: Add integration test**

Add to `tests/JobAssignment.test.ts`:

```typescript
  describe("integration", () => {
    it("full workflow: assign, produce, unassign", () => {
      // Build farm
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Initially no production (no workers)
      let production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBe(0);

      // Assign worker
      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      // Now has production
      production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBeGreaterThan(0);

      // Unassign worker
      gameState.buildings.removeWorker(farm!.id, colonist.id);

      // Back to no production
      production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBe(0);
    });
  });
```

**Step 2: Run test**

Run: `bun test tests/JobAssignment.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/JobAssignment.test.ts
git commit -m "test: add job assignment integration test"
```

---

## Summary

This plan implements:
1. Balance constants for staffing curves and penalties
2. `getColonistWorkplace()` helper in WorkforceManager
3. `getStaffingEfficiency()` with diminishing returns curve
4. `getWorkerEfficiency()` with role mismatch and training penalties
5. Integration into `getEffectiveProduction()` and `getEffectiveConsumption()`
6. Labor pool construction speed bonus
7. Assignment validation (no double-assignment)
8. Auto-unassign on colonist death
9. Facade methods for UI integration
10. Workplace dropdown in ColonistCard

All changes follow TDD with frequent commits.
