# Operations System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add active resource management through building modes, colony policies, expeditions, and prospecting.

**Architecture:** New `OperationsManager` system integrates with existing managers. Building modes modify `BuildingManager` behavior. Policies apply global multipliers. Expeditions/prospecting are time-based missions with probabilistic outcomes.

**Tech Stack:** TypeScript, Vue 3, Bun test runner

---

## Task 1: Balance Constants

**Files:**
- Create: `src/core/balance/OperationsBalance.ts`

**Step 1: Create the balance constants file**

```typescript
// src/core/balance/OperationsBalance.ts

// Building Mode Multipliers
export const BUILDING_MODES = {
  conservation: { production: 0.5, consumption: 0.4 },
  normal: { production: 1.0, consumption: 1.0 },
  overdrive: { production: 1.5, consumption: 2.0, moralePenalty: 0.5, breakdownChance: 0.02 },
} as const;

export const REPAIR_COST_MULTIPLIER = 0.25;
export const REPAIR_DURATION_SOLS = 3;

// Policy Effects
export const WORK_INTENSITY = {
  relaxed: { productionMult: 0.8, moralePerSol: 1 },
  standard: { productionMult: 1.0, moralePerSol: 0 },
  crunch: { productionMult: 1.2, moralePerSol: -1, healthPerSol: -0.5 },
} as const;

export const RESOURCE_PRIORITY = {
  stockpile: { productionMult: 0.9 },
  balanced: { productionMult: 1.0 },
  burn: { productionMult: 1.15, decayRate: 0.05 },
} as const;

export const EXPLORATION_STANCE = {
  cautious: { costMult: 1.5, successMod: 0.2 },
  standard: { costMult: 1.0, successMod: 0 },
  aggressive: { costMult: 0.75, successMod: -0.15 },
} as const;

export const POLICY_CHANGE_COOLDOWN_SOLS = 10;

// Expedition Definitions
export const EXPEDITIONS = {
  survey: { crew: 2, materials: 20, duration: 10, baseSuccess: 0.7 },
  salvage: { crew: 3, materials: 30, duration: 15, baseSuccess: 0.65 },
  science: { crew: 2, materials: 50, duration: 25, baseSuccess: 0.6 },
  deep: { crew: 4, materials: 100, duration: 40, baseSuccess: 0.5 },
} as const;

export const MAX_CONCURRENT_EXPEDITIONS = 2;
export const EXPEDITION_EXPERIENCE_BONUS = 0.05;
export const EXPEDITION_EXPERIENCE_CAP = 0.2;

// Prospecting
export const PROSPECTING_REVEAL_COST = { materials: 30, duration: 5 };
export const PROSPECTING_QUALITY = {
  poor: { developCost: 50, bonus: 0.1 },
  moderate: { developCost: 100, bonus: 0.25 },
  rich: { developCost: 200, bonus: 0.5 },
} as const;

export const MAX_REVEALED_SITES = 3;
export const MAX_DEVELOPED_SITES = 5;
```

**Step 2: Commit**

```bash
git add src/core/balance/OperationsBalance.ts
git commit -m "feat: add operations balance constants"
```

---

## Task 2: Operation Type Definitions

**Files:**
- Create: `src/core/models/Operation.ts`

**Step 1: Create the type definitions**

```typescript
// src/core/models/Operation.ts

export type BuildingMode = "conservation" | "normal" | "overdrive";

export type WorkIntensity = "relaxed" | "standard" | "crunch";
export type ResourcePriority = "stockpile" | "balanced" | "burn";
export type ExplorationStance = "cautious" | "standard" | "aggressive";

export interface ColonyPolicies {
  workIntensity: WorkIntensity;
  resourcePriority: ResourcePriority;
  explorationStance: ExplorationStance;
  lastChangeAt: number; // sol when last changed
}

export type ExpeditionType = "survey" | "salvage" | "science" | "deep";

export interface ActiveExpedition {
  id: string;
  type: ExpeditionType;
  assignedCrew: string[];
  startedAt: number;
  solsRemaining: number;
}

export type ProspectingResourceType = "water" | "materials" | "research";
export type ProspectingQuality = "poor" | "moderate" | "rich";

export interface ProspectingSite {
  id: string;
  resourceType: ProspectingResourceType;
  quality: ProspectingQuality;
  revealed: boolean;
  developed: boolean;
  developmentProgress: number;
}

export interface ExpeditionResult {
  success: boolean;
  type: ExpeditionType;
  rewards?: {
    materials?: number;
    site?: ProspectingSite;
    researchBonus?: { multiplier: number; expiresAt: number };
    discovery?: string;
  };
  losses?: {
    crewLost: string[];
    materialsLost?: number;
  };
}
```

**Step 2: Commit**

```bash
git add src/core/models/Operation.ts
git commit -m "feat: add operation type definitions"
```

---

## Task 3: Update Building Model

**Files:**
- Modify: `src/core/models/Building.ts`

**Step 1: Add mode and broken fields to Building interface**

Add after line 24 (`assignedWorkers: string[];`):

```typescript
  mode: "conservation" | "normal" | "overdrive";
  broken: boolean;
  repairProgress: number;
```

**Step 2: Commit**

```bash
git add src/core/models/Building.ts
git commit -m "feat: add mode and broken fields to Building"
```

---

## Task 4: Building Mode Tests

**Files:**
- Create: `tests/BuildingModes.test.ts`

**Step 1: Write failing tests for building modes**

```typescript
// tests/BuildingModes.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { BUILDING_MODES } from "../src/core/balance/OperationsBalance";

describe("Building Modes", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      oxygen: 500,
      water: 500,
      power: 500,
      materials: 500,
    });
  });

  test("new buildings default to normal mode", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    expect(building?.mode).toBe("normal");
    expect(building?.broken).toBe(false);
    expect(building?.repairProgress).toBe(0);
  });

  test("setBuildingMode changes mode", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    buildings.setBuildingMode(building!.id, "overdrive");
    expect(buildings.getBuilding(building!.id)?.mode).toBe("overdrive");
  });

  test("conservation mode reduces production to 50%", () => {
    expect(BUILDING_MODES.conservation.production).toBe(0.5);
  });

  test("overdrive mode increases production to 150%", () => {
    expect(BUILDING_MODES.overdrive.production).toBe(1.5);
  });

  test("getEffectiveProduction applies mode multiplier", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    // Complete construction
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    const normalProd = buildings.getEffectiveProduction(building!.id);
    buildings.setBuildingMode(building!.id, "overdrive");
    const overdriveProd = buildings.getEffectiveProduction(building!.id);

    expect(overdriveProd.power).toBe(normalProd.power! * 1.5);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/BuildingModes.test.ts
```

Expected: FAIL - `setBuildingMode` and `getEffectiveProduction` not defined

**Step 3: Commit failing tests**

```bash
git add tests/BuildingModes.test.ts
git commit -m "test: add failing building mode tests"
```

---

## Task 5: Implement Building Modes in BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Update startBuilding to set defaults**

In `startBuilding` method, update the building creation (around line 76-82) to:

```typescript
    const building: Building = {
      id: `building_${this.nextId++}`,
      definitionId: defId,
      status: "pending",
      constructionProgress: 0,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    };
```

**Step 2: Add setBuildingMode method**

Add after `removeWorker` method (around line 151):

```typescript
  setBuildingMode(buildingId: string, mode: "conservation" | "normal" | "overdrive"): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return false;
    building.mode = mode;
    return true;
  }

  getBuildingMode(buildingId: string): "conservation" | "normal" | "overdrive" | undefined {
    return this.buildings.get(buildingId)?.mode;
  }
```

**Step 3: Add getEffectiveProduction method**

```typescript
  getEffectiveProduction(buildingId: string): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.production) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].production;
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.production)) {
      if (value) result[key as keyof ResourceDelta] = value * modeMultiplier;
    }

    return result;
  }

  getEffectiveConsumption(buildingId: string): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.consumption) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].consumption;
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.consumption)) {
      if (value) result[key as keyof ResourceDelta] = value * modeMultiplier;
    }

    return result;
  }
```

**Step 4: Add import for BUILDING_MODES at top of file**

```typescript
import { BUILDING_MODES } from "../balance/OperationsBalance";
```

**Step 5: Add import for ResourceDelta**

Update the existing import:

```typescript
import type { Building, BuildingDefinition } from "../models/Building";
import type { ResourceDelta } from "../models/Resources";
```

**Step 6: Run tests to verify they pass**

```bash
bun test tests/BuildingModes.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "feat: implement building modes"
```

---

## Task 6: Building Breakdown Tests

**Files:**
- Modify: `tests/BuildingModes.test.ts`

**Step 1: Add breakdown tests**

```typescript
describe("Building Breakdown", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      oxygen: 500,
      water: 500,
      power: 500,
      materials: 500,
    });
  });

  test("breakBuilding sets broken to true", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    buildings.breakBuilding(building!.id);
    expect(buildings.getBuilding(building!.id)?.broken).toBe(true);
  });

  test("broken building produces nothing", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    buildings.breakBuilding(building!.id);
    const prod = buildings.getEffectiveProduction(building!.id);
    expect(prod).toEqual({});
  });

  test("startRepair begins repair process", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);
    buildings.breakBuilding(building!.id);

    const repairCost = buildings.getRepairCost(building!.id);
    expect(repairCost).toBeDefined();
    expect(repairCost!.materials).toBeGreaterThan(0);

    buildings.startRepair(building!.id, resources);
    expect(buildings.getBuilding(building!.id)?.repairProgress).toBeGreaterThan(0);
  });

  test("repair completes after REPAIR_DURATION_SOLS", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);
    buildings.breakBuilding(building!.id);
    buildings.startRepair(building!.id, resources);

    for (let i = 0; i < 3; i++) buildings.tick(resources);

    expect(buildings.getBuilding(building!.id)?.broken).toBe(false);
    expect(buildings.getBuilding(building!.id)?.repairProgress).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/BuildingModes.test.ts
```

Expected: FAIL - `breakBuilding`, `getRepairCost`, `startRepair` not defined

**Step 3: Commit failing tests**

```bash
git add tests/BuildingModes.test.ts
git commit -m "test: add failing building breakdown tests"
```

---

## Task 7: Implement Building Breakdown

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Add import for repair constants**

Update import:

```typescript
import { BUILDING_MODES, REPAIR_COST_MULTIPLIER, REPAIR_DURATION_SOLS } from "../balance/OperationsBalance";
```

**Step 2: Add breakdown and repair methods**

```typescript
  breakBuilding(buildingId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active") return false;

    const def = this.definitions.get(building.definitionId);
    if (!def) return false;

    // Remove production/consumption when broken
    if (def.production) {
      this.removeProductionForBuilding(building);
    }
    if (def.consumption) {
      this.removeConsumptionForBuilding(building);
    }

    building.broken = true;
    building.mode = "normal";
    return true;
  }

  private removeProductionForBuilding(building: Building): void {
    const def = this.definitions.get(building.definitionId);
    if (!def?.production) return;
    // Note: actual removal handled by recalculating totals
  }

  private removeConsumptionForBuilding(building: Building): void {
    const def = this.definitions.get(building.definitionId);
    if (!def?.consumption) return;
    // Note: actual removal handled by recalculating totals
  }

  getRepairCost(buildingId: string): ResourceDelta | undefined {
    const building = this.buildings.get(buildingId);
    if (!building || !building.broken) return undefined;

    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;

    const cost: ResourceDelta = {};
    for (const [key, value] of Object.entries(def.cost)) {
      if (value) cost[key as keyof ResourceDelta] = Math.ceil(value * REPAIR_COST_MULTIPLIER);
    }
    return cost;
  }

  startRepair(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || !building.broken) return false;

    const cost = this.getRepairCost(buildingId);
    if (!cost || !resources.canAfford(cost)) return false;

    resources.deduct(cost);
    building.repairProgress = 0.01; // Mark as repairing
    return true;
  }

  isRepairing(buildingId: string): boolean {
    const building = this.buildings.get(buildingId);
    return building?.broken === true && building.repairProgress > 0;
  }
```

**Step 3: Update tick to handle repairs**

In the `tick` method, add repair logic after construction handling (around line 48):

```typescript
      // Handle repairs
      if (building.broken && building.repairProgress > 0) {
        building.repairProgress += 1;
        if (building.repairProgress >= REPAIR_DURATION_SOLS) {
          building.broken = false;
          building.repairProgress = 0;

          // Re-add production/consumption
          if (def.production) {
            resources.addProduction(def.production);
          }
          if (def.consumption) {
            resources.addConsumption(def.consumption);
          }

          events.push({
            type: "BUILDING_REPAIRED",
            buildingId: building.id,
            buildingName: def.name,
            severity: "info",
            message: `${def.name} repaired!`,
          });
        }
      }
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/BuildingModes.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "feat: implement building breakdown and repair"
```

---

## Task 8: Colony Policies Tests

**Files:**
- Create: `tests/ColonyPolicies.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/ColonyPolicies.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { OperationsManager } from "../src/core/systems/OperationsManager";
import { POLICY_CHANGE_COOLDOWN_SOLS } from "../src/core/balance/OperationsBalance";

describe("Colony Policies", () => {
  let operations: OperationsManager;

  beforeEach(() => {
    operations = new OperationsManager();
  });

  test("initial policies are all standard", () => {
    const policies = operations.getPolicies();
    expect(policies.workIntensity).toBe("standard");
    expect(policies.resourcePriority).toBe("balanced");
    expect(policies.explorationStance).toBe("standard");
  });

  test("can change policy", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    expect(operations.getPolicies().workIntensity).toBe("crunch");
  });

  test("cannot change policy during cooldown", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    const result = operations.setPolicy("workIntensity", "relaxed", 5);
    expect(result).toBe(false);
    expect(operations.getPolicies().workIntensity).toBe("crunch");
  });

  test("can change policy after cooldown", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    const result = operations.setPolicy("workIntensity", "relaxed", POLICY_CHANGE_COOLDOWN_SOLS + 1);
    expect(result).toBe(true);
    expect(operations.getPolicies().workIntensity).toBe("relaxed");
  });

  test("getProductionMultiplier reflects work intensity", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    expect(operations.getProductionMultiplier()).toBe(1.2);

    operations.setPolicy("workIntensity", "relaxed", 20);
    expect(operations.getProductionMultiplier()).toBe(0.8);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/ColonyPolicies.test.ts
```

Expected: FAIL - `OperationsManager` not found

**Step 3: Commit failing tests**

```bash
git add tests/ColonyPolicies.test.ts
git commit -m "test: add failing colony policies tests"
```

---

## Task 9: Implement OperationsManager (Policies)

**Files:**
- Create: `src/core/systems/OperationsManager.ts`

**Step 1: Create OperationsManager with policy support**

```typescript
// src/core/systems/OperationsManager.ts
import type { GameEvent } from "../models/GameEvent";
import type {
  ColonyPolicies,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
  ActiveExpedition,
  ProspectingSite,
} from "../models/Operation";
import {
  POLICY_CHANGE_COOLDOWN_SOLS,
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
} from "../balance/OperationsBalance";

export class OperationsManager {
  private policies: ColonyPolicies = {
    workIntensity: "standard",
    resourcePriority: "balanced",
    explorationStance: "standard",
    lastChangeAt: -POLICY_CHANGE_COOLDOWN_SOLS, // Allow immediate first change
  };

  private expeditions: ActiveExpedition[] = [];
  private sites: ProspectingSite[] = [];
  private expeditionExperience: number = 0;

  getPolicies(): Readonly<ColonyPolicies> {
    return { ...this.policies };
  }

  canChangePolicy(currentSol: number): boolean {
    return currentSol - this.policies.lastChangeAt >= POLICY_CHANGE_COOLDOWN_SOLS;
  }

  getSolsUntilPolicyChange(currentSol: number): number {
    const elapsed = currentSol - this.policies.lastChangeAt;
    return Math.max(0, POLICY_CHANGE_COOLDOWN_SOLS - elapsed);
  }

  setPolicy(
    type: "workIntensity" | "resourcePriority" | "explorationStance",
    value: WorkIntensity | ResourcePriority | ExplorationStance,
    currentSol: number
  ): boolean {
    if (!this.canChangePolicy(currentSol)) return false;

    switch (type) {
      case "workIntensity":
        this.policies.workIntensity = value as WorkIntensity;
        break;
      case "resourcePriority":
        this.policies.resourcePriority = value as ResourcePriority;
        break;
      case "explorationStance":
        this.policies.explorationStance = value as ExplorationStance;
        break;
    }

    this.policies.lastChangeAt = currentSol;
    return true;
  }

  getProductionMultiplier(): number {
    const workMult = WORK_INTENSITY[this.policies.workIntensity].productionMult;
    const resourceMult = RESOURCE_PRIORITY[this.policies.resourcePriority].productionMult;
    return workMult * resourceMult;
  }

  getMoraleEffect(): number {
    return WORK_INTENSITY[this.policies.workIntensity].moralePerSol;
  }

  getHealthEffect(): number {
    const effect = WORK_INTENSITY[this.policies.workIntensity];
    return "healthPerSol" in effect ? effect.healthPerSol : 0;
  }

  getExpeditionCostMultiplier(): number {
    return EXPLORATION_STANCE[this.policies.explorationStance].costMult;
  }

  getExpeditionSuccessModifier(): number {
    return EXPLORATION_STANCE[this.policies.explorationStance].successMod;
  }

  tick(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    // Expedition and prospecting tick logic will be added later
    return events;
  }

  toJSON() {
    return {
      policies: this.policies,
      expeditions: this.expeditions,
      sites: this.sites,
      expeditionExperience: this.expeditionExperience,
    };
  }

  static fromJSON(data: ReturnType<OperationsManager["toJSON"]>): OperationsManager {
    const manager = new OperationsManager();
    manager.policies = data.policies;
    manager.expeditions = data.expeditions || [];
    manager.sites = data.sites || [];
    manager.expeditionExperience = data.expeditionExperience || 0;
    return manager;
  }
}
```

**Step 2: Run tests to verify they pass**

```bash
bun test tests/ColonyPolicies.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/core/systems/OperationsManager.ts
git commit -m "feat: implement OperationsManager with policies"
```

---

## Task 10: Expedition Tests

**Files:**
- Create: `tests/Expeditions.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/Expeditions.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { OperationsManager } from "../src/core/systems/OperationsManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { EXPEDITIONS, MAX_CONCURRENT_EXPEDITIONS } from "../src/core/balance/OperationsBalance";

describe("Expeditions", () => {
  let operations: OperationsManager;
  let resources: ResourceManager;
  let colony: ColonyManager;

  beforeEach(() => {
    operations = new OperationsManager();
    resources = new ResourceManager({
      food: 500, oxygen: 500, water: 500, power: 500, materials: 500,
    });
    colony = new ColonyManager(10);
  });

  test("canStartExpedition checks resources and crew", () => {
    expect(operations.canStartExpedition("survey", resources, colony)).toBe(true);
  });

  test("canStartExpedition fails with insufficient materials", () => {
    resources = new ResourceManager({
      food: 500, oxygen: 500, water: 500, power: 500, materials: 10,
    });
    expect(operations.canStartExpedition("survey", resources, colony)).toBe(false);
  });

  test("startExpedition deducts resources", () => {
    const crewIds = colony.getColonists().slice(0, 2).map(c => c.id);
    operations.startExpedition("survey", crewIds, resources, colony, 0);

    const remaining = resources.getResources();
    expect(remaining.materials).toBe(500 - EXPEDITIONS.survey.materials);
  });

  test("cannot exceed MAX_CONCURRENT_EXPEDITIONS", () => {
    const colonists = colony.getColonists();

    // Start first expedition
    operations.startExpedition("survey", [colonists[0].id, colonists[1].id], resources, colony, 0);

    // Start second expedition
    operations.startExpedition("survey", [colonists[2].id, colonists[3].id], resources, colony, 0);

    // Third should fail
    const result = operations.startExpedition("survey", [colonists[4].id, colonists[5].id], resources, colony, 0);
    expect(result).toBe(false);
  });

  test("expedition resolves after duration", () => {
    const crewIds = colony.getColonists().slice(0, 2).map(c => c.id);
    operations.startExpedition("survey", crewIds, resources, colony, 0);

    // Tick for duration
    for (let sol = 1; sol <= EXPEDITIONS.survey.duration; sol++) {
      operations.tick(sol);
    }

    expect(operations.getActiveExpeditions().length).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/Expeditions.test.ts
```

Expected: FAIL - expedition methods not defined

**Step 3: Commit failing tests**

```bash
git add tests/Expeditions.test.ts
git commit -m "test: add failing expedition tests"
```

---

## Task 11: Implement Expeditions

**Files:**
- Modify: `src/core/systems/OperationsManager.ts`

**Step 1: Add expedition imports**

```typescript
import {
  POLICY_CHANGE_COOLDOWN_SOLS,
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
  EXPEDITIONS,
  MAX_CONCURRENT_EXPEDITIONS,
  EXPEDITION_EXPERIENCE_BONUS,
  EXPEDITION_EXPERIENCE_CAP,
} from "../balance/OperationsBalance";
import type { ResourceManager } from "./ResourceManager";
import type { ColonyManager } from "./ColonyManager";
import type { ExpeditionType, ExpeditionResult } from "../models/Operation";
```

**Step 2: Add expedition methods**

```typescript
  private nextExpeditionId: number = 1;

  getActiveExpeditions(): readonly ActiveExpedition[] {
    return [...this.expeditions];
  }

  canStartExpedition(
    type: ExpeditionType,
    resources: ResourceManager,
    colony: ColonyManager
  ): boolean {
    if (this.expeditions.length >= MAX_CONCURRENT_EXPEDITIONS) return false;

    const config = EXPEDITIONS[type];
    const costMult = this.getExpeditionCostMultiplier();
    const materialCost = Math.ceil(config.materials * costMult);

    if (!resources.canAfford({ materials: materialCost })) return false;

    const availableCrew = this.getAvailableCrewCount(colony);
    if (availableCrew < config.crew) return false;

    return true;
  }

  private getAvailableCrewCount(colony: ColonyManager): number {
    const assignedCrew = new Set(this.expeditions.flatMap(e => e.assignedCrew));
    return colony.getColonists().filter(c => !assignedCrew.has(c.id)).length;
  }

  startExpedition(
    type: ExpeditionType,
    crewIds: string[],
    resources: ResourceManager,
    colony: ColonyManager,
    currentSol: number
  ): boolean {
    if (!this.canStartExpedition(type, resources, colony)) return false;

    const config = EXPEDITIONS[type];
    if (crewIds.length !== config.crew) return false;

    // Verify crew exists and is available
    const assignedCrew = new Set(this.expeditions.flatMap(e => e.assignedCrew));
    for (const id of crewIds) {
      if (!colony.getColonist(id) || assignedCrew.has(id)) return false;
    }

    const costMult = this.getExpeditionCostMultiplier();
    resources.deduct({ materials: Math.ceil(config.materials * costMult) });

    this.expeditions.push({
      id: `expedition_${this.nextExpeditionId++}`,
      type,
      assignedCrew: crewIds,
      startedAt: currentSol,
      solsRemaining: config.duration,
    });

    return true;
  }

  private resolveExpedition(expedition: ActiveExpedition, colony: ColonyManager): ExpeditionResult {
    const config = EXPEDITIONS[expedition.type];
    const successChance = config.baseSuccess + this.getExpeditionSuccessModifier() +
      Math.min(this.expeditionExperience, EXPEDITION_EXPERIENCE_CAP);

    const success = Math.random() < successChance;
    this.expeditionExperience += EXPEDITION_EXPERIENCE_BONUS;

    if (success) {
      return this.getSuccessResult(expedition.type);
    } else {
      return this.getFailureResult(expedition, colony);
    }
  }

  private getSuccessResult(type: ExpeditionType): ExpeditionResult {
    switch (type) {
      case "survey":
        return {
          success: true,
          type,
          rewards: {
            site: this.generateProspectingSite(),
          },
        };
      case "salvage":
        return {
          success: true,
          type,
          rewards: { materials: 50 + Math.floor(Math.random() * 100) },
        };
      case "science":
        return {
          success: true,
          type,
          rewards: { researchBonus: { multiplier: 1.2, expiresAt: 0 } }, // expiresAt set by caller
        };
      case "deep":
        return {
          success: true,
          type,
          rewards: { discovery: "rare_minerals" },
        };
    }
  }

  private getFailureResult(expedition: ActiveExpedition, colony: ColonyManager): ExpeditionResult {
    const type = expedition.type;
    const crewLost: string[] = [];

    if (type === "salvage" || type === "deep") {
      // Lose 1-2 crew on dangerous expeditions
      const lossCount = type === "deep" ? 1 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < lossCount && i < expedition.assignedCrew.length; i++) {
        crewLost.push(expedition.assignedCrew[i]);
      }
    }

    return {
      success: false,
      type,
      losses: { crewLost },
    };
  }

  private generateProspectingSite(): ProspectingSite {
    const types: Array<"water" | "materials" | "research"> = ["water", "materials", "research"];
    const qualities: Array<"poor" | "moderate" | "rich"> = ["poor", "moderate", "rich"];

    return {
      id: `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resourceType: types[Math.floor(Math.random() * types.length)],
      quality: qualities[Math.floor(Math.random() * qualities.length)],
      revealed: false,
      developed: false,
      developmentProgress: 0,
    };
  }
```

**Step 3: Update tick method to handle expeditions**

```typescript
  tick(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];

    // Update expedition timers
    for (const expedition of this.expeditions) {
      expedition.solsRemaining--;
    }

    // Resolve completed expeditions
    const completed = this.expeditions.filter(e => e.solsRemaining <= 0);
    this.expeditions = this.expeditions.filter(e => e.solsRemaining > 0);

    for (const expedition of completed) {
      // Resolution will be handled by GameState which has access to colony
      events.push({
        type: "EXPEDITION_COMPLETE",
        expeditionId: expedition.id,
        expeditionType: expedition.type,
        severity: "info",
        message: `${expedition.type} expedition has returned!`,
      });
    }

    return events;
  }

  resolveCompletedExpeditions(colony: ColonyManager, resources: ResourceManager, currentSol: number): ExpeditionResult[] {
    const results: ExpeditionResult[] = [];
    const completed = this.expeditions.filter(e => e.solsRemaining <= 0);

    for (const expedition of completed) {
      const result = this.resolveExpedition(expedition, colony);

      // Apply results
      if (result.success && result.rewards) {
        if (result.rewards.materials) {
          resources.add({ materials: result.rewards.materials });
        }
        if (result.rewards.site) {
          this.sites.push(result.rewards.site);
        }
        if (result.rewards.researchBonus) {
          result.rewards.researchBonus.expiresAt = currentSol + 50;
        }
      } else if (result.losses) {
        for (const crewId of result.losses.crewLost) {
          colony.removeColonist(crewId);
        }
      }

      results.push(result);
    }

    this.expeditions = this.expeditions.filter(e => e.solsRemaining > 0);
    return results;
  }
```

**Step 4: Run tests**

```bash
bun test tests/Expeditions.test.ts
```

Expected: PASS (may need ColonyManager.getColonist and removeColonist - check if they exist)

**Step 5: Commit**

```bash
git add src/core/systems/OperationsManager.ts
git commit -m "feat: implement expeditions"
```

---

## Task 12: Integrate OperationsManager into GameState

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Add import and property**

```typescript
import { OperationsManager } from "./systems/OperationsManager";

// In class, add after victory: VictoryManager;
operations: OperationsManager;
```

**Step 2: Initialize in constructor**

```typescript
this.operations = new OperationsManager();
```

**Step 3: Add to tick method (after politics, before events)**

```typescript
    // 6.5. Operations tick
    events.push(...this.operations.tick(this.currentSol));
```

**Step 4: Add to toJSON and fromJSON**

In `toJSON`:
```typescript
operations: this.operations.toJSON(),
```

In `fromJSON`:
```typescript
state.operations = OperationsManager.fromJSON(data.operations);
```

**Step 5: Run all tests**

```bash
bun test
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat: integrate OperationsManager into GameState"
```

---

## Task 13: Prospecting Tests and Implementation

**Files:**
- Create: `tests/Prospecting.test.ts`
- Modify: `src/core/systems/OperationsManager.ts`

**Step 1: Write tests**

```typescript
// tests/Prospecting.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { OperationsManager } from "../src/core/systems/OperationsManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { PROSPECTING_REVEAL_COST, MAX_REVEALED_SITES } from "../src/core/balance/OperationsBalance";

describe("Prospecting", () => {
  let operations: OperationsManager;
  let resources: ResourceManager;

  beforeEach(() => {
    operations = new OperationsManager();
    resources = new ResourceManager({
      food: 500, oxygen: 500, water: 500, power: 500, materials: 500,
    });
  });

  test("getSites returns all sites", () => {
    expect(operations.getSites()).toEqual([]);
  });

  test("revealSite costs materials", () => {
    // First add an unrevealed site (normally from expedition)
    operations.addUnrevealedSite();

    operations.revealSite(operations.getSites()[0].id, resources);
    expect(resources.getResources().materials).toBe(500 - PROSPECTING_REVEAL_COST.materials);
  });

  test("revealed site shows quality", () => {
    operations.addUnrevealedSite();
    const site = operations.getSites()[0];

    operations.revealSite(site.id, resources);
    expect(operations.getSites()[0].revealed).toBe(true);
  });

  test("cannot reveal more than MAX_REVEALED_SITES", () => {
    for (let i = 0; i < MAX_REVEALED_SITES + 1; i++) {
      operations.addUnrevealedSite();
    }

    const sites = operations.getSites();
    for (let i = 0; i < MAX_REVEALED_SITES; i++) {
      operations.revealSite(sites[i].id, resources);
    }

    const result = operations.revealSite(sites[MAX_REVEALED_SITES].id, resources);
    expect(result).toBe(false);
  });
});
```

**Step 2: Add prospecting methods to OperationsManager**

```typescript
  getSites(): readonly ProspectingSite[] {
    return [...this.sites];
  }

  addUnrevealedSite(): void {
    this.sites.push(this.generateProspectingSite());
  }

  getRevealedSiteCount(): number {
    return this.sites.filter(s => s.revealed && !s.developed).length;
  }

  revealSite(siteId: string, resources: ResourceManager): boolean {
    if (this.getRevealedSiteCount() >= MAX_REVEALED_SITES) return false;

    const site = this.sites.find(s => s.id === siteId);
    if (!site || site.revealed) return false;

    if (!resources.canAfford({ materials: PROSPECTING_REVEAL_COST.materials })) return false;

    resources.deduct({ materials: PROSPECTING_REVEAL_COST.materials });
    site.revealed = true;
    return true;
  }

  developSite(siteId: string, resources: ResourceManager): boolean {
    const site = this.sites.find(s => s.id === siteId);
    if (!site || !site.revealed || site.developed) return false;

    const cost = PROSPECTING_QUALITY[site.quality].developCost;
    if (!resources.canAfford({ materials: cost })) return false;

    resources.deduct({ materials: cost });
    site.developed = true;
    return true;
  }

  getDevelopedSiteBonus(resourceType: "water" | "materials" | "research"): number {
    return this.sites
      .filter(s => s.developed && s.resourceType === resourceType)
      .reduce((sum, s) => sum + PROSPECTING_QUALITY[s.quality].bonus, 0);
  }

  abandonSite(siteId: string): boolean {
    const index = this.sites.findIndex(s => s.id === siteId);
    if (index === -1) return false;

    const site = this.sites[index];
    if (site.developed) return false; // Can't abandon developed sites

    this.sites.splice(index, 1);
    return true;
  }
```

**Step 3: Add missing imports**

```typescript
import {
  // ... existing imports
  PROSPECTING_REVEAL_COST,
  PROSPECTING_QUALITY,
  MAX_REVEALED_SITES,
  MAX_DEVELOPED_SITES,
} from "../balance/OperationsBalance";
```

**Step 4: Run tests**

```bash
bun test tests/Prospecting.test.ts
```

**Step 5: Commit**

```bash
git add tests/Prospecting.test.ts src/core/systems/OperationsManager.ts
git commit -m "feat: implement prospecting system"
```

---

## Task 14: Update GameService for UI

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Add operations state to GameUIState interface**

```typescript
// Add to interface GameUIState
policies: ColonyPolicies;
policyCooldownRemaining: number;
activeExpeditions: ActiveExpedition[];
prospectingSites: ProspectingSite[];
```

**Step 2: Add imports**

```typescript
import type { ColonyPolicies, ActiveExpedition, ProspectingSite } from "../../core/models/Operation";
```

**Step 3: Update syncState**

```typescript
// Operations
this.state.policies = this.gameState.operations.getPolicies();
this.state.policyCooldownRemaining = this.gameState.operations.getSolsUntilPolicyChange(this.gameState.currentSol);
this.state.activeExpeditions = [...this.gameState.operations.getActiveExpeditions()];
this.state.prospectingSites = [...this.gameState.operations.getSites()];
```

**Step 4: Add action methods**

```typescript
// Operations actions
setPolicy(type: "workIntensity" | "resourcePriority" | "explorationStance", value: string): boolean {
  const result = this.gameState.operations.setPolicy(type, value as never, this.gameState.currentSol);
  this.syncState();
  return result;
}

startExpedition(type: string, crewIds: string[]): boolean {
  const result = this.gameState.operations.startExpedition(
    type as never,
    crewIds,
    this.gameState.resources,
    this.gameState.colony,
    this.gameState.currentSol
  );
  this.syncState();
  return result;
}

revealSite(siteId: string): boolean {
  const result = this.gameState.operations.revealSite(siteId, this.gameState.resources);
  this.syncState();
  return result;
}

developSite(siteId: string): boolean {
  const result = this.gameState.operations.developSite(siteId, this.gameState.resources);
  this.syncState();
  return result;
}

setBuildingMode(buildingId: string, mode: "conservation" | "normal" | "overdrive"): boolean {
  const result = this.gameState.buildings.setBuildingMode(buildingId, mode);
  this.syncState();
  return result;
}
```

**Step 5: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat: add operations support to GameService"
```

---

## Task 15: Create OperationsPanel Component

**Files:**
- Create: `src/renderer/components/OperationsPanel.vue`

This task creates the UI panel with tabs for Policies, Buildings summary, and Missions. The implementation follows the existing panel patterns in the codebase.

**Step 1: Create the component** (full implementation in separate file due to length)

**Step 2: Register in App.vue**

**Step 3: Commit**

```bash
git add src/renderer/components/OperationsPanel.vue src/renderer/App.vue
git commit -m "feat: add OperationsPanel UI component"
```

---

## Task 16: Final Integration Test

**Files:**
- Run all tests

**Step 1: Run full test suite**

```bash
bun test
```

**Step 2: Manual verification**

```bash
bun run dev
```

- Toggle building modes on active buildings
- Change colony policies (verify cooldown)
- Start an expedition
- Wait for expedition to complete
- Reveal and develop a prospecting site

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete operations system implementation"
```

---

Plan complete and saved to `docs/plans/2026-01-20-operations-system.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session in the worktree at `.worktrees/operations`, uses executing-plans skill for batch execution with checkpoints

Which approach?