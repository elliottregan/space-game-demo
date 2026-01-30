# Air Quality System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace oxygen stockpile resource with a 0-1 air quality metric calculated from building production vs. colonist consumption.

**Architecture:** New `AirQualityManager` calculates instant equilibrium each tick. Effects (health, morale, efficiency) scale gradually based on comfort zones (0.8+ comfortable, 0.5-0.8 strained, <0.5 critical). Remove oxygen from Resources interface entirely.

**Tech Stack:** TypeScript, Bun test runner, Vue 3 (renderer)

---

## Task 1: Create AirQualityBalance constants

**Files:**
- Create: `src/core/balance/AirQualityBalance.ts`
- Test: `tests/AirQuality.test.ts`

**Step 1: Write the failing test**

Create `tests/AirQuality.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import {
  BASE_OXYGEN_PER_COLONIST,
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  AIR_QUALITY_DEADLY,
} from "../src/core/balance/AirQualityBalance";

describe("AirQualityBalance constants", () => {
  it("should have BASE_OXYGEN_PER_COLONIST defined", () => {
    expect(BASE_OXYGEN_PER_COLONIST).toBeGreaterThan(0);
  });

  it("should have threshold constants in correct order", () => {
    expect(AIR_QUALITY_COMFORTABLE).toBeGreaterThan(AIR_QUALITY_CRITICAL);
    expect(AIR_QUALITY_CRITICAL).toBeGreaterThan(AIR_QUALITY_DEADLY);
  });

  it("should have comfortable threshold at 0.8", () => {
    expect(AIR_QUALITY_COMFORTABLE).toBe(0.8);
  });

  it("should have critical threshold at 0.5", () => {
    expect(AIR_QUALITY_CRITICAL).toBe(0.5);
  });

  it("should have deadly threshold at 0.2", () => {
    expect(AIR_QUALITY_DEADLY).toBe(0.2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - Cannot find module '../src/core/balance/AirQualityBalance'

**Step 3: Write the implementation**

Create `src/core/balance/AirQualityBalance.ts`:

```typescript
// src/core/balance/AirQualityBalance.ts

/** Base oxygen consumption per colonist per tick */
export const BASE_OXYGEN_PER_COLONIST = 1;

/** Air quality threshold: above this is comfortable (no penalties) */
export const AIR_QUALITY_COMFORTABLE = 0.8;

/** Air quality threshold: below this is critical (severe penalties) */
export const AIR_QUALITY_CRITICAL = 0.5;

/** Air quality threshold: below this death risk begins */
export const AIR_QUALITY_DEADLY = 0.2;

/** Maximum health loss per tick at air quality = 0 */
export const AIR_QUALITY_MAX_HEALTH_PENALTY = 10;

/** Maximum morale loss per tick at air quality = 0 */
export const AIR_QUALITY_MAX_MORALE_PENALTY = 5;

/** Maximum efficiency penalty at air quality = 0 (0.5 = 50% reduction) */
export const AIR_QUALITY_MAX_EFFICIENCY_PENALTY = 0.5;
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/balance/AirQualityBalance.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): add balance constants"
```

---

## Task 2: Create AirQualityManager with calculation

**Files:**
- Create: `src/core/systems/AirQualityManager.ts`
- Modify: `tests/AirQuality.test.ts`

**Step 1: Add tests for AirQualityManager**

Add to `tests/AirQuality.test.ts`:

```typescript
import { AirQualityManager } from "../src/core/systems/AirQualityManager";

describe("AirQualityManager", () => {
  describe("calculate", () => {
    it("should return 1.0 when production exceeds consumption", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(10, 5); // production=10, consumption=5
      expect(airQuality).toBe(1);
    });

    it("should return ratio when production is less than consumption", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(5, 10); // production=5, consumption=10
      expect(airQuality).toBe(0.5);
    });

    it("should return 0 when production is 0", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(0, 10);
      expect(airQuality).toBe(0);
    });

    it("should return 1 when consumption is 0", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(10, 0);
      expect(airQuality).toBe(1);
    });

    it("should clamp to 0-1 range", () => {
      const manager = new AirQualityManager();
      expect(manager.calculate(100, 10)).toBe(1);
      expect(manager.calculate(-5, 10)).toBe(0);
    });
  });

  describe("getAirQuality", () => {
    it("should return current air quality value", () => {
      const manager = new AirQualityManager();
      manager.calculate(8, 10);
      expect(manager.getAirQuality()).toBe(0.8);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - Cannot find module '../src/core/systems/AirQualityManager'

**Step 3: Write the implementation**

Create `src/core/systems/AirQualityManager.ts`:

```typescript
// src/core/systems/AirQualityManager.ts

export class AirQualityManager {
  private airQuality: number = 1;

  /**
   * Calculate air quality as production/consumption ratio.
   * Updates internal state and returns the new value.
   */
  calculate(production: number, consumption: number): number {
    if (consumption <= 0) {
      this.airQuality = 1;
      return this.airQuality;
    }

    if (production <= 0) {
      this.airQuality = 0;
      return this.airQuality;
    }

    this.airQuality = Math.max(0, Math.min(1, production / consumption));
    return this.airQuality;
  }

  getAirQuality(): number {
    return this.airQuality;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/AirQualityManager.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): add AirQualityManager with calculation"
```

---

## Task 3: Add effect calculations to AirQualityManager

**Files:**
- Modify: `src/core/systems/AirQualityManager.ts`
- Modify: `tests/AirQuality.test.ts`

**Step 1: Add tests for effect methods**

Add to `tests/AirQuality.test.ts`:

```typescript
describe("AirQualityManager effects", () => {
  describe("getHealthEffect", () => {
    it("should return 0 when comfortable (>=0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(10, 10); // 1.0
      expect(manager.getHealthEffect()).toBe(0);

      manager.calculate(8, 10); // 0.8
      expect(manager.getHealthEffect()).toBe(0);
    });

    it("should return negative value when strained (0.5-0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(6, 10); // 0.6
      expect(manager.getHealthEffect()).toBeLessThan(0);
    });

    it("should return larger negative value when critical (<0.5)", () => {
      const manager = new AirQualityManager();
      manager.calculate(3, 10); // 0.3
      const criticalEffect = manager.getHealthEffect();

      manager.calculate(6, 10); // 0.6
      const strainedEffect = manager.getHealthEffect();

      expect(criticalEffect).toBeLessThan(strainedEffect);
    });
  });

  describe("getMoraleEffect", () => {
    it("should return 0 when comfortable (>=0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(10, 10);
      expect(manager.getMoraleEffect()).toBe(0);
    });

    it("should return negative value when strained", () => {
      const manager = new AirQualityManager();
      manager.calculate(6, 10);
      expect(manager.getMoraleEffect()).toBeLessThan(0);
    });
  });

  describe("getEfficiencyMultiplier", () => {
    it("should return 1 when comfortable (>=0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(10, 10);
      expect(manager.getEfficiencyMultiplier()).toBe(1);
    });

    it("should return 1 when strained (0.5-0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(6, 10); // 0.6
      expect(manager.getEfficiencyMultiplier()).toBe(1);
    });

    it("should return <1 when critical (<0.5)", () => {
      const manager = new AirQualityManager();
      manager.calculate(3, 10); // 0.3
      expect(manager.getEfficiencyMultiplier()).toBeLessThan(1);
      expect(manager.getEfficiencyMultiplier()).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - getHealthEffect is not a function

**Step 3: Write the implementation**

Update `src/core/systems/AirQualityManager.ts`:

```typescript
// src/core/systems/AirQualityManager.ts

import {
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  AIR_QUALITY_MAX_EFFICIENCY_PENALTY,
  AIR_QUALITY_MAX_HEALTH_PENALTY,
  AIR_QUALITY_MAX_MORALE_PENALTY,
} from "../balance/AirQualityBalance";

export class AirQualityManager {
  private airQuality: number = 1;

  /**
   * Calculate air quality as production/consumption ratio.
   * Updates internal state and returns the new value.
   */
  calculate(production: number, consumption: number): number {
    if (consumption <= 0) {
      this.airQuality = 1;
      return this.airQuality;
    }

    if (production <= 0) {
      this.airQuality = 0;
      return this.airQuality;
    }

    this.airQuality = Math.max(0, Math.min(1, production / consumption));
    return this.airQuality;
  }

  getAirQuality(): number {
    return this.airQuality;
  }

  /**
   * Get health effect based on current air quality.
   * Returns 0 when comfortable, negative when strained/critical.
   */
  getHealthEffect(): number {
    if (this.airQuality >= AIR_QUALITY_COMFORTABLE) {
      return 0;
    }

    // Scale from 0 at comfortable to -MAX at 0
    const severity = 1 - this.airQuality / AIR_QUALITY_COMFORTABLE;
    return -severity * AIR_QUALITY_MAX_HEALTH_PENALTY;
  }

  /**
   * Get morale effect based on current air quality.
   * Returns 0 when comfortable, negative when strained/critical.
   */
  getMoraleEffect(): number {
    if (this.airQuality >= AIR_QUALITY_COMFORTABLE) {
      return 0;
    }

    const severity = 1 - this.airQuality / AIR_QUALITY_COMFORTABLE;
    return -severity * AIR_QUALITY_MAX_MORALE_PENALTY;
  }

  /**
   * Get efficiency multiplier based on current air quality.
   * Returns 1 when comfortable or strained, <1 when critical.
   */
  getEfficiencyMultiplier(): number {
    if (this.airQuality >= AIR_QUALITY_CRITICAL) {
      return 1;
    }

    // Scale from 1 at critical threshold to (1 - MAX_PENALTY) at 0
    const severity = 1 - this.airQuality / AIR_QUALITY_CRITICAL;
    return 1 - severity * AIR_QUALITY_MAX_EFFICIENCY_PENALTY;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/AirQualityManager.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): add health, morale, and efficiency effects"
```

---

## Task 4: Add serialization to AirQualityManager

**Files:**
- Modify: `src/core/systems/AirQualityManager.ts`
- Modify: `tests/AirQuality.test.ts`

**Step 1: Add tests for serialization**

Add to `tests/AirQuality.test.ts`:

```typescript
describe("AirQualityManager serialization", () => {
  it("should serialize to JSON", () => {
    const manager = new AirQualityManager();
    manager.calculate(6, 10);
    const json = manager.toJSON();
    expect(json.airQuality).toBe(0.6);
  });

  it("should deserialize from JSON", () => {
    const manager = AirQualityManager.fromJSON({ airQuality: 0.7 });
    expect(manager.getAirQuality()).toBe(0.7);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - toJSON is not a function

**Step 3: Write the implementation**

Add to `src/core/systems/AirQualityManager.ts`:

```typescript
  toJSON() {
    return {
      airQuality: this.airQuality,
    };
  }

  static fromJSON(data: { airQuality: number }): AirQualityManager {
    const manager = new AirQualityManager();
    manager.airQuality = data.airQuality;
    return manager;
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/AirQualityManager.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): add serialization support"
```

---

## Task 5: Remove oxygen from Resources interface

**Files:**
- Modify: `src/core/models/Resources.ts`
- Modify: `tests/AirQuality.test.ts`

**Step 1: Add test for Resources without oxygen**

Add to `tests/AirQuality.test.ts`:

```typescript
import { RESOURCE_KEYS } from "../src/core/models/Resources";

describe("Resources without oxygen", () => {
  it("should not include oxygen in RESOURCE_KEYS", () => {
    expect(RESOURCE_KEYS).not.toContain("oxygen");
  });

  it("should have exactly 4 resource keys", () => {
    expect(RESOURCE_KEYS).toEqual(["food", "water", "power", "materials"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - RESOURCE_KEYS contains "oxygen"

**Step 3: Modify Resources.ts**

Update `src/core/models/Resources.ts`:

```typescript
export interface Resources {
  food: number;
  water: number;
  power: number;
  materials: number;
}

export interface ResourceDelta {
  food?: number;
  water?: number;
  power?: number;
  materials?: number;
}

export const RESOURCE_KEYS: (keyof Resources)[] = ["food", "water", "power", "materials"];
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/Resources.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): remove oxygen from Resources interface"
```

---

## Task 6: Fix compilation errors from oxygen removal

This task fixes all TypeScript errors caused by removing oxygen. Run `bun run build` after each sub-step to find errors.

**Files to modify (in order):**
- `src/core/balance/EconomyBaseline.ts`
- `src/core/data/buildings.ts`
- `src/core/systems/ColonyManager.ts`
- `src/core/tick/phases/pretick.ts`
- `src/renderer/services/GameService.ts`
- `src/renderer/components/*.vue` (any components referencing oxygen)
- `src/simulation/*.ts` (any simulation files referencing oxygen)

**Step 1: Fix EconomyBaseline.ts**

Remove oxygen from STARTING_RESOURCES and COLONIST_NEEDS:

```typescript
export const COLONIST_NEEDS = {
  food: 0.5,
  water: 0.2,
  power: 0.1,
} as const;

export const STARTING_RESOURCES: Resources = {
  food: 280,
  water: 100,
  power: 500,
  materials: 500,
};

// Remove OXYGEN_MULTIPLIER and OXYGEN_HEALTH_PENALTY from SHORTAGE_THRESHOLDS
export const SHORTAGE_THRESHOLDS = {
  FOOD_MULTIPLIER: 2,
  FOOD_MORALE_PENALTY: 2,
  FOOD_HEALTH_PENALTY: 1,
} as const;
```

**Step 2: Fix buildings.ts**

Remove any `oxygen` in `production` or `consumption` fields. Keep `oxygenContribution`.

Search for `oxygen:` in the file and remove those lines from production/consumption objects.

**Step 3: Fix ColonyManager.ts**

Remove oxygen shortage check from `applyResourceShortageEffects`:

```typescript
private applyResourceShortageEffects(resources: ResourceManager): void {
  const resourceState = resources.getResources();
  const population = this.colonists.size;

  if (resourceState.food < population * SHORTAGE_THRESHOLDS.FOOD_MULTIPLIER) {
    this.morale = Math.max(0, this.morale - SHORTAGE_THRESHOLDS.FOOD_MORALE_PENALTY);
    this.health = Math.max(0, this.health - SHORTAGE_THRESHOLDS.FOOD_HEALTH_PENALTY);
  }
  // Remove oxygen shortage check entirely
}
```

Remove oxygen from `updateConsumption`:

```typescript
private updateConsumption(resources: ResourceManager): void {
  const population = this.colonists.size;

  resources.removeConsumption({
    food: resources.getConsumption().food || 0,
    water: resources.getConsumption().water || 0,
    power: resources.getConsumption().power || 0,
  });

  resources.addConsumption({
    food: population * COLONIST_NEEDS.food,
    water: population * COLONIST_NEEDS.water,
    power: population * COLONIST_NEEDS.power,
  });
}
```

**Step 4: Fix pretick.ts**

Remove the `applyOxygenContribution` phase entirely - we'll replace it with air quality calculation.

Update `src/core/tick/phases/pretick.ts`:

```typescript
import {
  LABOR_POOL_BONUS_CAP,
  LABOR_POOL_BONUS_PER_COLONIST,
} from "../../balance/WorkforceBalance";
import { definePhase } from "../TickPhase";

export const updateLaborPoolBonus = definePhase({
  id: "pretick:updateLaborPoolBonus",
  name: "Update Labor Pool Bonus",
  reads: ["colony", "buildings"],
  writes: ["buildings", "derived.laborPoolBonus"],
  execute(ctx) {
    const colonists = ctx.colony.getColonists();
    const assignedIds = new Set<string>();

    for (const building of ctx.buildings.getBuildings()) {
      for (const id of building.assignedWorkers) {
        assignedIds.add(id);
      }
    }

    const unassignedCount = colonists.filter((c) => !assignedIds.has(c.id)).length;
    const bonus = Math.min(unassignedCount * LABOR_POOL_BONUS_PER_COLONIST, LABOR_POOL_BONUS_CAP);

    ctx.buildings.setConstructionSpeedBonus(bonus);
    ctx.derived.laborPoolBonus = bonus;

    return [];
  },
});

// applyOxygenContribution removed - replaced by air quality system
```

**Step 5: Fix GameService.ts**

Update `createInitialState` to remove oxygen:

```typescript
resources: { food: 0, water: 0, power: 0, materials: 0 },
```

**Step 6: Run build to find remaining errors**

Run: `bun run build`

Fix any remaining TypeScript errors by removing oxygen references.

**Step 7: Run all tests**

Run: `bun test`

Fix any failing tests by updating expectations.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(air-quality): remove oxygen from resource system"
```

---

## Task 7: Add AirQualityManager to GameState

**Files:**
- Modify: `src/core/GameState.ts`
- Modify: `tests/AirQuality.test.ts`

**Step 1: Add test for GameState integration**

Add to `tests/AirQuality.test.ts`:

```typescript
import { GameState } from "../src/core/GameState";

describe("GameState air quality integration", () => {
  it("should have airQuality manager", () => {
    const gameState = new GameState();
    expect(gameState.airQuality).toBeDefined();
  });

  it("should serialize and deserialize airQuality", () => {
    const gameState = new GameState();
    // Simulate some ticks to change air quality
    for (let i = 0; i < 5; i++) {
      gameState.tick();
    }

    const json = gameState.toJSON();
    expect(json.airQuality).toBeDefined();

    const restored = GameState.fromJSON(json);
    expect(restored.airQuality.getAirQuality()).toBe(gameState.airQuality.getAirQuality());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - airQuality is not defined

**Step 3: Add AirQualityManager to GameState**

Modify `src/core/GameState.ts`:

1. Import AirQualityManager:
```typescript
import { AirQualityManager } from "./systems/AirQualityManager";
```

2. Add property:
```typescript
airQuality: AirQualityManager;
```

3. Initialize in constructor:
```typescript
this.airQuality = new AirQualityManager();
```

4. Add to toJSON:
```typescript
airQuality: this.airQuality.toJSON(),
```

5. Add to fromJSON:
```typescript
if (data.airQuality) {
  state.airQuality = AirQualityManager.fromJSON(data.airQuality);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/GameState.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): add AirQualityManager to GameState"
```

---

## Task 8: Create air quality tick phase

**Files:**
- Create: `src/core/tick/phases/airQuality.ts`
- Modify: `src/core/tick/phases/index.ts`
- Modify: `src/core/tick/TickContext.ts`

**Step 1: Update TickContext for air quality**

Add to `DerivedValues` in `src/core/tick/TickContext.ts`:

```typescript
export interface DerivedValues {
  socialCohesion: SocialCohesionData | null;
  policyEffects: PolicyEffects | null;
  laborPoolBonus: number;
  oxygenContribution: number;
  airQuality: number;
  airQualityEffects: { health: number; morale: number; efficiency: number } | null;
}
```

Update `createTickContext` to initialize:

```typescript
derived: {
  socialCohesion: null,
  policyEffects: null,
  laborPoolBonus: 0,
  oxygenContribution: 0,
  airQuality: 1,
  airQualityEffects: null,
},
```

**Step 2: Create air quality phase**

Create `src/core/tick/phases/airQuality.ts`:

```typescript
import { BASE_OXYGEN_PER_COLONIST } from "../../balance/AirQualityBalance";
import type { GameEvent } from "../../models/GameEvent";
import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";

/**
 * Calculate Air Quality Phase
 *
 * Computes air quality from building oxygen contributions vs. population consumption.
 * Populates derived.airQuality and derived.airQualityEffects for use by later phases.
 */
export const calculateAirQuality = definePhase({
  id: "airQuality:calculate",
  name: "Calculate Air Quality",
  reads: ["buildings", "colony"],
  writes: ["derived.airQuality", "derived.airQualityEffects"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    // Get oxygen production from buildings
    const production = ctx.buildings.getTotalOxygenContribution();

    // Get oxygen consumption from population
    const population = ctx.colony.getPopulation();
    const consumption = population * BASE_OXYGEN_PER_COLONIST;

    // Calculate air quality (need to access the manager through gameState)
    // For now, calculate directly in the phase
    let airQuality: number;
    if (consumption <= 0) {
      airQuality = 1;
    } else if (production <= 0) {
      airQuality = 0;
    } else {
      airQuality = Math.max(0, Math.min(1, production / consumption));
    }

    ctx.derived.airQuality = airQuality;

    // Calculate effects based on thresholds
    const comfortable = 0.8;
    const critical = 0.5;
    const maxHealthPenalty = 10;
    const maxMoralePenalty = 5;
    const maxEfficiencyPenalty = 0.5;

    let health = 0;
    let morale = 0;
    let efficiency = 1;

    if (airQuality < comfortable) {
      const severity = 1 - airQuality / comfortable;
      health = -severity * maxHealthPenalty;
      morale = -severity * maxMoralePenalty;
    }

    if (airQuality < critical) {
      const severity = 1 - airQuality / critical;
      efficiency = 1 - severity * maxEfficiencyPenalty;
    }

    ctx.derived.airQualityEffects = { health, morale, efficiency };

    // Generate warning events
    if (airQuality < 0.5) {
      events.push({
        type: "AIR_QUALITY_CRITICAL",
        airQuality,
        severity: "critical",
        message: `Air quality critical: ${Math.round(airQuality * 100)}%`,
      });
    } else if (airQuality < 0.8) {
      events.push({
        type: "AIR_QUALITY_LOW",
        airQuality,
        severity: "warning",
        message: `Air quality strained: ${Math.round(airQuality * 100)}%`,
      });
    }

    return events;
  },
});
```

**Step 3: Register phase in index.ts**

Update `src/core/tick/phases/index.ts`:

1. Import the new phase:
```typescript
import { calculateAirQuality } from "./airQuality";
```

2. Remove applyOxygenContribution from imports and exports

3. Add export:
```typescript
export { calculateAirQuality } from "./airQuality";
```

4. Register in createStandardTickRunner after updateLaborPoolBonus:
```typescript
// 1. Pre-tick phases
runner.register(updateLaborPoolBonus);
runner.register(calculateAirQuality);
```

**Step 4: Run tests**

Run: `bun test`
Expected: PASS (or fix any issues)

**Step 5: Commit**

```bash
git add src/core/tick/phases/airQuality.ts src/core/tick/phases/index.ts src/core/tick/phases/pretick.ts src/core/tick/TickContext.ts
git commit -m "feat(air-quality): add air quality calculation tick phase"
```

---

## Task 9: Apply air quality effects in colony phase

**Files:**
- Modify: `src/core/tick/phases/colony.ts`

**Step 1: Update processColonyTick to use air quality effects**

Modify the `processColonyTick` phase in `src/core/tick/phases/colony.ts`:

```typescript
export const processColonyTick = definePhase({
  id: "colony:processColonyTick",
  name: "Process Colony Tick",
  reads: ["colony", "resources", "buildings", "derived.socialCohesion", "derived.policyEffects", "derived.airQualityEffects"],
  writes: ["colony", "resources", "events"],
  execute(ctx: TickContext): GameEvent[] {
    // Convert SocialCohesionData to the format ColonyManager.tick expects
    const socialCohesionForColony = ctx.derived.socialCohesion
      ? {
          cohesion: ctx.derived.socialCohesion.averageClusteringCoefficient,
          isolatedColonists: ctx.derived.socialCohesion.isolatedColonists,
        }
      : { cohesion: 0, isolatedColonists: [] };

    // Combine policy effects with air quality effects
    const policyEffects = ctx.derived.policyEffects ?? { morale: 0, health: 0 };
    const airQualityEffects = ctx.derived.airQualityEffects ?? { health: 0, morale: 0 };

    const combinedEffects = {
      morale: policyEffects.morale + airQualityEffects.morale,
      health: policyEffects.health + airQualityEffects.health,
    };

    return ctx.colony.tick(
      ctx.resources,
      ctx.buildings,
      combinedEffects,
      socialCohesionForColony,
    );
  },
});
```

**Step 2: Run tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/tick/phases/colony.ts
git commit -m "feat(air-quality): apply air quality effects in colony tick"
```

---

## Task 10: Apply efficiency multiplier in BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/AirQuality.test.ts`

**Step 1: Add test for efficiency penalty**

Add to `tests/AirQuality.test.ts`:

```typescript
describe("Building efficiency with air quality", () => {
  it("should apply efficiency penalty when air quality is critical", () => {
    const gameState = new GameState();
    gameState.resources.add({ materials: 1000 });

    // Build a basic farm (produces food)
    gameState.buildings.startBuilding(BuildingId.BASIC_FARM, gameState.resources, gameState.technology);

    // Complete construction
    for (let i = 0; i < 15; i++) {
      gameState.tick();
    }

    const farms = gameState.buildings.getActiveBuildings()
      .filter(b => b.definitionId === BuildingId.BASIC_FARM);

    // Set air quality efficiency multiplier low
    gameState.buildings.setAirQualityEfficiency(0.5);

    const effectiveProd = gameState.buildings.getEffectiveProduction(farms[0].id);

    // Base production is 10 food, with 50% penalty should be 5
    expect(effectiveProd.food).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/AirQuality.test.ts`
Expected: FAIL - setAirQualityEfficiency is not a function

**Step 3: Add air quality efficiency to BuildingManager**

Modify `src/core/systems/BuildingManager.ts`:

1. Add property:
```typescript
private airQualityEfficiency: number = 1;
```

2. Add setter:
```typescript
setAirQualityEfficiency(multiplier: number): void {
  this.airQualityEfficiency = Math.max(0, Math.min(1, multiplier));
}
```

3. Remove or replace `getOxygenDeficitMultiplier` with air quality efficiency in `getEffectiveProduction`:
```typescript
getEffectiveProduction(buildingId: string, overrideCondition?: number): ResourceDelta {
  const building = this.buildings.get(buildingId);
  if (!building || building.status !== "active" || building.broken) return {};

  const def = this.definitions.get(building.definitionId);
  if (!def?.production) return {};

  const modeMultiplier = BUILDING_MODES[building.mode].production;
  const condition = overrideCondition ?? building.condition;
  const conditionMultiplier = this.getConditionMultiplier(condition);
  const staffingMultiplier = this.getStaffingMultiplier(buildingId);
  const workerEfficiency = this.getWorkerEfficiencyMultiplier(buildingId);

  // Use air quality efficiency instead of oxygen deficit
  const combinedMultiplier = combineMultipliers(
    modeMultiplier,
    conditionMultiplier,
    staffingMultiplier,
    workerEfficiency,
    this.airQualityEfficiency,
  );

  return applyMultiplier(def.production, combinedMultiplier);
}
```

4. Remove the `getOxygenDeficitMultiplier` method entirely.

5. Remove the import of `OXYGEN_DEFICIT_EFFICIENCY_PENALTY` from BuildingBalance.

**Step 4: Run test to verify it passes**

Run: `bun test tests/AirQuality.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/AirQuality.test.ts
git commit -m "feat(air-quality): apply efficiency multiplier from air quality"
```

---

## Task 11: Update tick phases to set air quality efficiency

**Files:**
- Modify: `src/core/tick/phases/airQuality.ts`

**Step 1: Set efficiency on buildings in air quality phase**

Update `src/core/tick/phases/airQuality.ts` to set efficiency:

```typescript
export const calculateAirQuality = definePhase({
  id: "airQuality:calculate",
  name: "Calculate Air Quality",
  reads: ["buildings", "colony"],
  writes: ["buildings", "derived.airQuality", "derived.airQualityEffects"],
  execute(ctx: TickContext): GameEvent[] {
    // ... existing calculation code ...

    // Apply efficiency to buildings
    ctx.buildings.setAirQualityEfficiency(efficiency);

    // ... rest of the code ...
  },
});
```

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/tick/phases/airQuality.ts
git commit -m "feat(air-quality): set building efficiency from air quality phase"
```

---

## Task 12: Expose air quality in facade and GameService

**Files:**
- Create: `src/facade/types/airQuality.ts`
- Create: `src/facade/domains/AirQualityFacade.ts`
- Modify: `src/facade/GameAPI.ts`
- Modify: `src/facade/types/index.ts`
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Create facade types**

Create `src/facade/types/airQuality.ts`:

```typescript
export interface AirQualitySnapshot {
  readonly airQuality: number;
  readonly production: number;
  readonly consumption: number;
  readonly healthEffect: number;
  readonly moraleEffect: number;
  readonly efficiencyMultiplier: number;
}
```

**Step 2: Create facade**

Create `src/facade/domains/AirQualityFacade.ts`:

```typescript
import type { GameState } from "../../core/GameState";
import { BASE_OXYGEN_PER_COLONIST } from "../../core/balance/AirQualityBalance";
import type { Queryable } from "../types/common";
import type { AirQualitySnapshot } from "../types/airQuality";

export class AirQualityFacade implements Queryable<AirQualitySnapshot> {
  constructor(private gameState: GameState) {}

  snapshot(): AirQualitySnapshot {
    const production = this.gameState.buildings.getTotalOxygenContribution();
    const consumption = this.gameState.colony.getPopulation() * BASE_OXYGEN_PER_COLONIST;
    const airQuality = this.gameState.airQuality.getAirQuality();

    return {
      airQuality,
      production,
      consumption,
      healthEffect: this.gameState.airQuality.getHealthEffect(),
      moraleEffect: this.gameState.airQuality.getMoraleEffect(),
      efficiencyMultiplier: this.gameState.airQuality.getEfficiencyMultiplier(),
    };
  }
}
```

**Step 3: Update GameAPI**

Add to `src/facade/GameAPI.ts`:

```typescript
import { AirQualityFacade } from "./domains/AirQualityFacade";

// In class:
readonly airQuality: AirQualityFacade;

// In constructor:
this.airQuality = new AirQualityFacade(this.gameState);
```

**Step 4: Update facade types index**

Add to `src/facade/types/index.ts`:

```typescript
export * from "./airQuality";
```

**Step 5: Update GameService**

Add to GameUIState interface in `src/renderer/services/GameService.ts`:

```typescript
airQuality: number;
airQualityProduction: number;
airQualityConsumption: number;
```

Add to createInitialState:

```typescript
airQuality: 1,
airQualityProduction: 0,
airQualityConsumption: 0,
```

Add to syncState:

```typescript
// Air Quality
const airQualityData = this.facade.airQuality.snapshot();
this.state.airQuality = airQualityData.airQuality;
this.state.airQualityProduction = airQualityData.production;
this.state.airQualityConsumption = airQualityData.consumption;
```

**Step 6: Run all tests**

Run: `bun test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/facade/types/airQuality.ts src/facade/domains/AirQualityFacade.ts src/facade/GameAPI.ts src/facade/types/index.ts src/renderer/services/GameService.ts
git commit -m "feat(air-quality): expose air quality via facade and GameService"
```

---

## Task 13: Remove OXYGEN_DEFICIT_EFFICIENCY_PENALTY constant

**Files:**
- Modify: `src/core/balance/BuildingBalance.ts`

**Step 1: Remove the constant**

Remove this line from `src/core/balance/BuildingBalance.ts`:

```typescript
/** Efficiency penalty when colony oxygen contribution is negative (0.5 = -50%) */
export const OXYGEN_DEFICIT_EFFICIENCY_PENALTY = 0.5;
```

**Step 2: Run build to verify no remaining references**

Run: `bun run build`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add src/core/balance/BuildingBalance.ts
git commit -m "refactor(air-quality): remove obsolete OXYGEN_DEFICIT_EFFICIENCY_PENALTY"
```

---

## Task 14: Update simulation and fix remaining tests

**Files:**
- Various files in `src/simulation/`
- Various test files

**Step 1: Run full test suite**

Run: `bun test`

**Step 2: Fix any failing tests**

Common fixes needed:
- Remove oxygen from test resource assertions
- Update tests that check for oxygen shortage effects
- Update simulation metrics that track oxygen

**Step 3: Run simulation**

Run: `bun run simulate --runs 5 --verbose`

Verify simulations complete without errors.

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(air-quality): update tests and simulation for air quality system"
```

---

## Task 15: Update BuildingSnapshot facade type

**Files:**
- Modify: `src/facade/types/buildings.ts`

**Step 1: Remove totalOxygenContribution from BuildingSnapshot**

The oxygen contribution is now accessed through the AirQualityFacade. Update `src/facade/types/buildings.ts`:

```typescript
export interface BuildingSnapshot {
  readonly active: readonly Readonly<Building>[];
  readonly pending: readonly Readonly<Building>[];
  readonly definitions: readonly Readonly<BuildingDefinition>[];
  readonly moraleBoost: number;
  // totalOxygenContribution removed - use airQuality facade instead
}
```

**Step 2: Update BuildingsFacade.snapshot()**

Remove totalOxygenContribution from the return value in `src/facade/domains/BuildingsFacade.ts`.

**Step 3: Update GameService.syncState()**

Remove the line that syncs totalOxygenContribution from buildings.

**Step 4: Run tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/facade/types/buildings.ts src/facade/domains/BuildingsFacade.ts src/renderer/services/GameService.ts
git commit -m "refactor(air-quality): move oxygen contribution to airQuality facade"
```

---

## Task 16: Final verification

**Step 1: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 2: Run formatter**

Run: `bun run format`

**Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 4: Run build**

Run: `bun run build`
Expected: Build succeeds

**Step 5: Run simulation**

Run: `bun run simulate --runs 10`
Expected: Simulations complete, win rate reasonable

**Step 6: Manual testing**

Run: `bun run dev`

Verify:
1. Resource bar shows food, water, power, materials (no oxygen)
2. Game starts and runs without errors
3. Building farms/habitats affects air quality
4. Low air quality shows warnings and affects colony

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat(air-quality): complete air quality system implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Balance constants | AirQualityBalance.ts |
| 2 | AirQualityManager calculation | AirQualityManager.ts |
| 3 | Effect calculations | AirQualityManager.ts |
| 4 | Serialization | AirQualityManager.ts |
| 5 | Remove oxygen from Resources | Resources.ts |
| 6 | Fix compilation errors | Multiple files |
| 7 | Add to GameState | GameState.ts |
| 8 | Create tick phase | airQuality.ts, index.ts |
| 9 | Apply effects in colony | colony.ts |
| 10 | Building efficiency | BuildingManager.ts |
| 11 | Set efficiency in phase | airQuality.ts |
| 12 | Facade and GameService | Multiple facade files |
| 13 | Remove old constant | BuildingBalance.ts |
| 14 | Fix tests/simulation | Various |
| 15 | Update BuildingSnapshot | buildings.ts |
| 16 | Final verification | - |

**Total estimated commits:** 15-17
