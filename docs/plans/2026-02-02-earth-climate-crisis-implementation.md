# Earth Climate Crisis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a doomsday clock mechanic where Earth's climate crisis worsens over time, triggering refugee waves and eventually marking the game as lost if victory isn't achieved.

**Architecture:** Create EarthCrisisManager as a new system manager with typed effect arrays. The manager ticks each sol, increases severity, and triggers threshold effects. Refugees arrive via ColonyManager. VictoryManager checks pointOfNoReturn before allowing victory.

**Tech Stack:** TypeScript, Bun test runner

---

### Task 1: Create EarthCrisis Model Types

**Files:**
- Create: `src/core/models/EarthCrisis.ts`

**Step 1: Create the types file**

```typescript
// src/core/models/EarthCrisis.ts

export interface EarthClimateCrisis {
  severity: number; // 0-100, increases over time
  pointOfNoReturn: boolean; // True when severity hits 100
}

// Flexible effect system - expandable for future effects
export type CrisisEffectType =
  | "refugee_wave"
  | "political_instability"; // Scaffolded, not implemented

export interface CrisisEffect {
  type: CrisisEffectType;
  params: Record<string, unknown>;
}

export interface CrisisThreshold {
  severity: number; // Trigger at this percentage
  effects: CrisisEffect[];
  repeatable: boolean;
  repeatInterval?: number; // Sols between repeats (if repeatable)
}

export interface RefugeeWaveParams {
  count: number;
}
```

**Step 2: Verify file created**

Run: `ls src/core/models/EarthCrisis.ts`
Expected: File exists

**Step 3: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/core/models/EarthCrisis.ts
git commit -m "feat(core): add EarthCrisis model types"
```

---

### Task 2: Create EarthCrisis Balance Constants

**Files:**
- Create: `src/core/balance/EarthCrisisBalance.ts`

**Step 1: Create the balance file**

```typescript
// src/core/balance/EarthCrisisBalance.ts

import type { CrisisThreshold } from "../models/EarthCrisis";

export const EARTH_CRISIS_BALANCE = {
  severityPerSol: 0.15, // ~667 sols to reach 100%
  startingSeverity: 0,
} as const;

export const EARTH_CRISIS_THRESHOLDS: CrisisThreshold[] = [
  {
    severity: 25,
    effects: [{ type: "refugee_wave", params: { count: 2 } }],
    repeatable: true,
    repeatInterval: 100,
  },
  {
    severity: 50,
    effects: [{ type: "refugee_wave", params: { count: 3 } }],
    repeatable: true,
    repeatInterval: 75,
  },
  {
    severity: 75,
    effects: [{ type: "refugee_wave", params: { count: 4 } }],
    repeatable: true,
    repeatInterval: 50,
  },
  {
    severity: 100,
    effects: [], // Earth goes dark - handled specially
    repeatable: false,
  },
];

// Refugee ideology distribution (Earth Loyalist bias)
export const REFUGEE_IDEOLOGY = {
  earthLoyalistWeight: 0.6,
  neutralWeight: 0.25,
  otherWeight: 0.15,
  baseMorale: 0.7, // 70% of normal starting morale
} as const;
```

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/balance/EarthCrisisBalance.ts
git commit -m "feat(balance): add EarthCrisis balance constants"
```

---

### Task 3: Create EarthCrisisManager with Tests (TDD)

**Files:**
- Create: `tests/EarthCrisisManager.test.ts`
- Create: `src/core/systems/EarthCrisisManager.ts`

**Step 1: Write the failing tests**

```typescript
// tests/EarthCrisisManager.test.ts

import { describe, it, expect, beforeEach } from "bun:test";
import { EarthCrisisManager } from "../src/core/systems/EarthCrisisManager";
import { EARTH_CRISIS_BALANCE } from "../src/core/balance/EarthCrisisBalance";

describe("EarthCrisisManager", () => {
  let manager: EarthCrisisManager;

  beforeEach(() => {
    manager = new EarthCrisisManager();
  });

  describe("initialization", () => {
    it("should start at 0% severity", () => {
      const state = manager.getState();
      expect(state.severity).toBe(0);
    });

    it("should not be at point of no return initially", () => {
      const state = manager.getState();
      expect(state.pointOfNoReturn).toBe(false);
    });
  });

  describe("severity progression", () => {
    it("should increase severity each tick", () => {
      manager.tick(1);
      const state = manager.getState();
      expect(state.severity).toBe(EARTH_CRISIS_BALANCE.severityPerSol);
    });

    it("should cap severity at 100%", () => {
      // Tick many times to exceed 100%
      for (let i = 0; i < 1000; i++) {
        manager.tick(i);
      }
      const state = manager.getState();
      expect(state.severity).toBe(100);
    });

    it("should set pointOfNoReturn at 100%", () => {
      for (let i = 0; i < 1000; i++) {
        manager.tick(i);
      }
      const state = manager.getState();
      expect(state.pointOfNoReturn).toBe(true);
    });

    it("should stop increasing severity after pointOfNoReturn", () => {
      for (let i = 0; i < 1000; i++) {
        manager.tick(i);
      }
      const stateBefore = manager.getState();
      manager.tick(1001);
      const stateAfter = manager.getState();
      expect(stateAfter.severity).toBe(stateBefore.severity);
    });
  });

  describe("threshold triggers", () => {
    it("should trigger refugee wave at 25% severity", () => {
      // Tick until we cross 25%
      let effects: ReturnType<typeof manager.tick> = [];
      for (let sol = 1; sol <= 200; sol++) {
        effects = manager.tick(sol);
        if (effects.some((e) => e.type === "refugee_wave")) break;
      }
      expect(effects.some((e) => e.type === "refugee_wave")).toBe(true);
    });

    it("should include refugee count in effect params", () => {
      let effects: ReturnType<typeof manager.tick> = [];
      for (let sol = 1; sol <= 200; sol++) {
        effects = manager.tick(sol);
        if (effects.some((e) => e.type === "refugee_wave")) break;
      }
      const refugeeEffect = effects.find((e) => e.type === "refugee_wave");
      expect(refugeeEffect?.params?.count).toBe(2);
    });

    it("should repeat refugee waves at intervals", () => {
      let refugeeWaveCount = 0;
      for (let sol = 1; sol <= 400; sol++) {
        const effects = manager.tick(sol);
        if (effects.some((e) => e.type === "refugee_wave")) {
          refugeeWaveCount++;
        }
      }
      expect(refugeeWaveCount).toBeGreaterThan(1);
    });

    it("should emit earth_collapse event at 100%", () => {
      let collapseEvent = null;
      for (let sol = 1; sol <= 1000; sol++) {
        const effects = manager.tick(sol);
        const collapse = effects.find((e) => e.type === "earth_collapse");
        if (collapse) {
          collapseEvent = collapse;
          break;
        }
      }
      expect(collapseEvent).not.toBeNull();
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize state", () => {
      for (let i = 0; i < 100; i++) {
        manager.tick(i);
      }
      const json = manager.toJSON();
      const restored = EarthCrisisManager.fromJSON(json);
      expect(restored.getState()).toEqual(manager.getState());
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/EarthCrisisManager.test.ts`
Expected: FAIL - module not found

**Step 3: Create the EarthCrisisManager implementation**

```typescript
// src/core/systems/EarthCrisisManager.ts

import type {
  EarthClimateCrisis,
  CrisisEffect,
  CrisisThreshold,
} from "../models/EarthCrisis";
import {
  EARTH_CRISIS_BALANCE,
  EARTH_CRISIS_THRESHOLDS,
} from "../balance/EarthCrisisBalance";
import type { GameEvent } from "../models/GameEvent";

export interface EarthCrisisEffect extends GameEvent {
  type: "refugee_wave" | "earth_collapse";
  params?: Record<string, unknown>;
}

export class EarthCrisisManager {
  private state: EarthClimateCrisis;
  private triggeredThresholds: Set<number> = new Set();
  private lastRepeatSol: Map<number, number> = new Map();

  constructor() {
    this.state = {
      severity: EARTH_CRISIS_BALANCE.startingSeverity,
      pointOfNoReturn: false,
    };
  }

  tick(currentSol: number): EarthCrisisEffect[] {
    if (this.state.pointOfNoReturn) return [];

    const effects: EarthCrisisEffect[] = [];

    // Increase severity
    this.state.severity = Math.min(
      100,
      this.state.severity + EARTH_CRISIS_BALANCE.severityPerSol
    );

    // Check thresholds and apply effects
    for (const threshold of EARTH_CRISIS_THRESHOLDS) {
      if (this.shouldTrigger(threshold, currentSol)) {
        effects.push(...this.applyEffects(threshold.effects));
        this.markTriggered(threshold, currentSol);
      }
    }

    // Check point of no return
    if (this.state.severity >= 100 && !this.state.pointOfNoReturn) {
      this.state.pointOfNoReturn = true;
      effects.push({
        type: "earth_collapse",
        severity: "critical",
        message: "Earth's climate has collapsed. Victory is no longer possible.",
      });
    }

    return effects;
  }

  private shouldTrigger(threshold: CrisisThreshold, currentSol: number): boolean {
    // Haven't reached this severity yet
    if (this.state.severity < threshold.severity) return false;

    // Non-repeatable and already triggered
    if (!threshold.repeatable && this.triggeredThresholds.has(threshold.severity)) {
      return false;
    }

    // Repeatable - check interval
    if (threshold.repeatable) {
      const lastSol = this.lastRepeatSol.get(threshold.severity);
      if (lastSol !== undefined) {
        const interval = threshold.repeatInterval ?? 100;
        if (currentSol - lastSol < interval) return false;
      }
    }

    return true;
  }

  private markTriggered(threshold: CrisisThreshold, currentSol: number): void {
    this.triggeredThresholds.add(threshold.severity);
    if (threshold.repeatable) {
      this.lastRepeatSol.set(threshold.severity, currentSol);
    }
  }

  private applyEffects(effects: CrisisEffect[]): EarthCrisisEffect[] {
    const result: EarthCrisisEffect[] = [];

    for (const effect of effects) {
      if (effect.type === "refugee_wave") {
        result.push({
          type: "refugee_wave",
          severity: "info",
          message: `Climate refugees arriving from Earth`,
          params: effect.params,
        });
      }
      // political_instability scaffolded but not implemented
    }

    return result;
  }

  getState(): EarthClimateCrisis {
    return { ...this.state };
  }

  isPointOfNoReturn(): boolean {
    return this.state.pointOfNoReturn;
  }

  getSeverity(): number {
    return this.state.severity;
  }

  toJSON() {
    return {
      severity: this.state.severity,
      pointOfNoReturn: this.state.pointOfNoReturn,
      triggeredThresholds: Array.from(this.triggeredThresholds),
      lastRepeatSol: Object.fromEntries(this.lastRepeatSol),
    };
  }

  static fromJSON(data: {
    severity: number;
    pointOfNoReturn: boolean;
    triggeredThresholds: number[];
    lastRepeatSol: Record<number, number>;
  }): EarthCrisisManager {
    const manager = new EarthCrisisManager();
    manager.state.severity = data.severity;
    manager.state.pointOfNoReturn = data.pointOfNoReturn;
    manager.triggeredThresholds = new Set(data.triggeredThresholds);
    manager.lastRepeatSol = new Map(
      Object.entries(data.lastRepeatSol).map(([k, v]) => [Number(k), v])
    );
    return manager;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/EarthCrisisManager.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add tests/EarthCrisisManager.test.ts src/core/systems/EarthCrisisManager.ts
git commit -m "feat(core): add EarthCrisisManager with threshold effects"
```

---

### Task 4: Add Refugee Arrival to ColonyManager

**Files:**
- Modify: `src/core/systems/ColonyManager.ts`
- Create: `tests/RefugeeArrival.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/RefugeeArrival.test.ts

import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { REFUGEE_IDEOLOGY } from "../src/core/balance/EarthCrisisBalance";
import { FactionId } from "../src/core/models/NPCInfluence";

describe("RefugeeArrival", () => {
  let colony: ColonyManager;

  beforeEach(() => {
    colony = new ColonyManager(0); // Start with 0 population
  });

  describe("addRefugees", () => {
    it("should add the specified number of refugees", () => {
      const events = colony.addRefugees(5);
      expect(colony.getPopulation()).toBe(5);
    });

    it("should return colonist_arrived events for each refugee", () => {
      const events = colony.addRefugees(3);
      expect(events.filter((e) => e.type === "COLONIST_ARRIVED").length).toBe(3);
    });

    it("should give refugees reduced morale", () => {
      colony.addRefugees(5);
      const colonists = colony.getColonists();
      for (const colonist of colonists) {
        // Refugees should have lower morale than default (50)
        expect(colonist.morale).toBeLessThan(50);
      }
    });

    it("should bias refugee ideology toward Earth Loyalist", () => {
      // Add many refugees to get statistical distribution
      colony.addRefugees(50);
      const colonists = colony.getColonists();

      let earthLoyalistCount = 0;
      for (const colonist of colonists) {
        // Check if Earth Loyalist is the highest faction
        const ideology = colonist.ideology;
        if (
          ideology.factionAffinities[FactionId.EARTH_FIRST] >
          ideology.factionAffinities[FactionId.MARS_INDEPENDENCE] &&
          ideology.factionAffinities[FactionId.EARTH_FIRST] >
          ideology.factionAffinities[FactionId.CORPORATE]
        ) {
          earthLoyalistCount++;
        }
      }

      // At least 40% should lean Earth Loyalist (60% weight with variance)
      expect(earthLoyalistCount / colonists.length).toBeGreaterThan(0.4);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/RefugeeArrival.test.ts`
Expected: FAIL - addRefugees not defined

**Step 3: Add addRefugees method to ColonyManager**

In `src/core/systems/ColonyManager.ts`, add import at top:

```typescript
import { REFUGEE_IDEOLOGY } from "../balance/EarthCrisisBalance";
import { FactionId } from "../models/NPCInfluence";
```

Add method after `addColonist`:

```typescript
  /**
   * Add climate refugees from Earth.
   * Refugees have Earth-leaning ideology and reduced morale.
   */
  addRefugees(count: number): GameEvent[] {
    const events: GameEvent[] = [];

    for (let i = 0; i < count; i++) {
      const ideology = this.generateRefugeeIdeology();
      const colonist = this.addColonist(undefined, ideology);

      // Set reduced morale for refugees (trauma of displacement)
      colonist.morale = Math.round(50 * REFUGEE_IDEOLOGY.baseMorale);

      events.push({
        type: "COLONIST_ARRIVED",
        severity: "info",
        message: `Climate refugee ${colonist.name} arrived from Earth`,
        colonistId: colonist.id,
      });
    }

    return events;
  }

  private generateRefugeeIdeology(): ColonistIdeology {
    const roll = rng.random();

    if (roll < REFUGEE_IDEOLOGY.earthLoyalistWeight) {
      // Earth Loyalist leaning
      return {
        factionAffinities: {
          [FactionId.EARTH_FIRST]: 0.6 + rng.random() * 0.3,
          [FactionId.MARS_INDEPENDENCE]: rng.random() * 0.3,
          [FactionId.CORPORATE]: rng.random() * 0.3,
        },
        conviction: 0.4 + rng.random() * 0.3,
      };
    } else if (roll < REFUGEE_IDEOLOGY.earthLoyalistWeight + REFUGEE_IDEOLOGY.neutralWeight) {
      // Neutral
      return IdeologyManager.createNeutralIdeology();
    } else {
      // Other (Mars Independence or Corporate)
      const isMars = rng.random() > 0.5;
      return {
        factionAffinities: {
          [FactionId.EARTH_FIRST]: rng.random() * 0.3,
          [FactionId.MARS_INDEPENDENCE]: isMars ? 0.5 + rng.random() * 0.3 : rng.random() * 0.3,
          [FactionId.CORPORATE]: isMars ? rng.random() * 0.3 : 0.5 + rng.random() * 0.3,
        },
        conviction: 0.3 + rng.random() * 0.3,
      };
    }
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/RefugeeArrival.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/core/systems/ColonyManager.ts tests/RefugeeArrival.test.ts
git commit -m "feat(colony): add refugee arrival with Earth-biased ideology"
```

---

### Task 5: Integrate EarthCrisisManager into GameState

**Files:**
- Modify: `src/core/GameState.ts`
- Create: `src/core/tick/phases/earthCrisis.ts`
- Modify: `src/core/tick/phases/index.ts`

**Step 1: Add manager to GameState**

In `src/core/GameState.ts`, add import:

```typescript
import { EarthCrisisManager } from "./systems/EarthCrisisManager";
```

Add property after other managers (around line 38):

```typescript
earthCrisis: EarthCrisisManager;
```

In constructor, after other manager initializations:

```typescript
this.earthCrisis = new EarthCrisisManager();
```

**Step 2: Create earth crisis tick phase**

```typescript
// src/core/tick/phases/earthCrisis.ts

import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Process Earth Crisis Phase
 *
 * Increases crisis severity, triggers refugee waves, checks for point of no return.
 */
export const processEarthCrisis = definePhase({
  id: "earthCrisis:process",
  name: "Process Earth Crisis",
  reads: ["earthCrisis", "currentSol"],
  writes: ["earthCrisis", "colony", "events"],
  execute(ctx: TickContext): GameEvent[] {
    const effects = ctx.earthCrisis.tick(ctx.currentSol);
    const events: GameEvent[] = [];

    for (const effect of effects) {
      if (effect.type === "refugee_wave" && effect.params?.count) {
        const count = effect.params.count as number;
        const refugeeEvents = ctx.colony.addRefugees(count);
        events.push({
          type: "REFUGEE_WAVE",
          severity: "info",
          message: `${count} climate refugees arrived from Earth`,
        });
        events.push(...refugeeEvents);
      } else if (effect.type === "earth_collapse") {
        events.push({
          type: "EARTH_COLLAPSE",
          severity: "critical",
          message: effect.message || "Earth's climate has collapsed",
        });
      }
    }

    return events;
  },
});
```

**Step 3: Register phase in index.ts**

In `src/core/tick/phases/index.ts`, add import:

```typescript
import { processEarthCrisis } from "./earthCrisis";
```

Add export:

```typescript
export { processEarthCrisis } from "./earthCrisis";
```

In `createStandardTickRunner()`, add before Events phase (around line 118):

```typescript
  // 8b. Earth Crisis phases
  runner.register(processEarthCrisis);
```

**Step 4: Add earthCrisis to TickContext**

In `src/core/tick/TickContext.ts`, add to the interface:

```typescript
earthCrisis: EarthCrisisManager;
```

In `src/core/tick/index.ts` `createTickContext`, add:

```typescript
earthCrisis: state.earthCrisis,
```

**Step 5: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/core/GameState.ts src/core/tick/phases/earthCrisis.ts src/core/tick/phases/index.ts src/core/tick/TickContext.ts src/core/tick/index.ts
git commit -m "feat(core): integrate EarthCrisisManager into game loop"
```

---

### Task 6: Block Victory After Point of No Return

**Files:**
- Modify: `src/core/systems/VictoryManager.ts`
- Add test: `tests/EarthCrisisVictory.test.ts`

**Step 1: Write failing test**

```typescript
// tests/EarthCrisisVictory.test.ts

import { describe, it, expect } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Earth Crisis Victory Blocking", () => {
  it("should mark game as defeat when Earth collapses", () => {
    const game = new GameState();

    // Fast forward until Earth collapses
    for (let i = 0; i < 1000; i++) {
      game.tick();
      if (game.earthCrisis.isPointOfNoReturn()) break;
    }

    expect(game.earthCrisis.isPointOfNoReturn()).toBe(true);
    expect(game.victory.getState().status).toBe("defeat");
  });

  it("should prevent victory after Earth collapses", () => {
    const game = new GameState();

    // Fast forward until Earth collapses
    for (let i = 0; i < 1000; i++) {
      game.tick();
      if (game.earthCrisis.isPointOfNoReturn()) break;
    }

    // Try to trigger victory (would normally work)
    const victoryEvent = game.victory.checkBuildingVictory("generation_ship" as any);
    expect(victoryEvent).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/EarthCrisisVictory.test.ts`
Expected: FAIL

**Step 3: Modify VictoryManager to check Earth crisis**

In `src/core/systems/VictoryManager.ts`, add to `tick` method (after existing defeat checks, before return):

```typescript
    // Check Earth crisis point of no return
    // Note: This is called from tick phase which passes earthCrisis state
```

Add new method to be called from tick phase:

```typescript
  /**
   * Mark game as defeat due to Earth collapse.
   * Called when Earth crisis reaches point of no return.
   */
  markEarthCollapse(): GameEvent | null {
    if (this.status !== "playing") return null;

    this.status = "defeat";
    this.reason = "Earth's climate has collapsed. The colony survives, but victory is no longer possible.";

    return {
      type: "DEFEAT",
      reason: this.reason,
      severity: "critical",
      message: this.reason,
    };
  }

  /**
   * Check if victory is still possible.
   * Returns false if Earth has collapsed.
   */
  canAchieveVictory(earthCrisisPointOfNoReturn: boolean): boolean {
    return this.status === "playing" && !earthCrisisPointOfNoReturn;
  }
```

Modify `checkBuildingVictory` to accept optional earthCrisis flag:

```typescript
  checkBuildingVictory(buildingId: BuildingId, earthCollapsed: boolean = false): GameEvent | null {
    if (earthCollapsed) return null; // Can't win if Earth collapsed

    const def = BUILDINGS.find((b) => b.id === buildingId);
    // ... rest unchanged
  }
```

**Step 4: Update earth crisis tick phase to mark defeat**

In `src/core/tick/phases/earthCrisis.ts`, update the earth_collapse handling:

```typescript
      } else if (effect.type === "earth_collapse") {
        const defeatEvent = ctx.victory.markEarthCollapse();
        if (defeatEvent) {
          events.push(defeatEvent);
        }
        events.push({
          type: "EARTH_COLLAPSE",
          severity: "critical",
          message: effect.message || "Earth's climate has collapsed",
        });
      }
```

Add victory to reads/writes:

```typescript
  reads: ["earthCrisis", "currentSol", "victory"],
  writes: ["earthCrisis", "colony", "victory", "events"],
```

**Step 5: Run tests**

Run: `bun test tests/EarthCrisisVictory.test.ts`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/core/systems/VictoryManager.ts src/core/tick/phases/earthCrisis.ts tests/EarthCrisisVictory.test.ts
git commit -m "feat(victory): block victory after Earth collapse"
```

---

### Task 7: Add UI Display for Crisis Severity

**Files:**
- Modify: `src/renderer/services/GameService.ts` (add earthCrisis to state sync)
- Create: `src/renderer/components/ResourceBar/EarthCrisisIndicator.vue`
- Modify: `src/renderer/components/ResourceBar/ResourceBar.vue`

**Step 1: Add earthCrisis to GameUIState**

In `src/renderer/services/GameService.ts`, add to `GameUIState` interface:

```typescript
earthCrisis: {
  severity: number;
  pointOfNoReturn: boolean;
};
```

In `syncState()`, add:

```typescript
this.state.earthCrisis = {
  severity: this.game.earthCrisis.getSeverity(),
  pointOfNoReturn: this.game.earthCrisis.isPointOfNoReturn(),
};
```

**Step 2: Create EarthCrisisIndicator component**

```vue
<!-- src/renderer/components/ResourceBar/EarthCrisisIndicator.vue -->
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  severity: number;
  pointOfNoReturn: boolean;
}>();

const severityColor = computed(() => {
  if (props.pointOfNoReturn) return "var(--g-color-negative)";
  if (props.severity >= 75) return "var(--g-color-danger)";
  if (props.severity >= 50) return "var(--g-color-warning)";
  if (props.severity >= 25) return "#F57C00"; // orange
  return "var(--g-color-positive)";
});

const statusText = computed(() => {
  if (props.pointOfNoReturn) return "Earth Collapsed";
  if (props.severity >= 75) return "Critical";
  if (props.severity >= 50) return "Severe";
  if (props.severity >= 25) return "Worsening";
  return "Stable";
});

const tooltipText = computed(() => {
  if (props.pointOfNoReturn) {
    return "Earth's climate has collapsed. Victory is no longer possible.";
  }
  return `Earth Climate Crisis: ${props.severity.toFixed(1)}% - ${statusText.value}`;
});
</script>

<template>
  <div class="earth-crisis-indicator" :title="tooltipText">
    <span class="label">Earth</span>
    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{
          width: `${severity}%`,
          backgroundColor: severityColor,
        }"
      />
    </div>
    <span class="status" :style="{ color: severityColor }">
      {{ pointOfNoReturn ? "COLLAPSED" : `${severity.toFixed(0)}%` }}
    </span>
  </div>
</template>

<style scoped>
.earth-crisis-indicator {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border-radius: var(--g-radius-sm);
}

.label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.progress-bar {
  width: 60px;
  height: 8px;
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.status {
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  min-width: 50px;
  text-align: right;
}
</style>
```

**Step 3: Add to ResourceBar**

In `src/renderer/components/ResourceBar/ResourceBar.vue`, import and add the component.

**Step 4: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 5: Commit**

```bash
git add src/renderer/services/GameService.ts src/renderer/components/ResourceBar/EarthCrisisIndicator.vue src/renderer/components/ResourceBar/ResourceBar.vue
git commit -m "feat(ui): add Earth crisis severity indicator"
```

---

### Task 8: Update Simulation to Track Earth Crisis

**Files:**
- Modify: `src/simulation/MetricsCollector.ts`
- Modify: `src/simulation/SimulationRunner.ts`

**Step 1: Add earth crisis tracking to MetricsCollector**

Add to metrics interface and collection:

```typescript
earthCollapseLosses: number;
avgSeverityAtVictory: number;
```

Track in the appropriate methods.

**Step 2: Update defeat reason handling**

Ensure "earth_collapse" is tracked as a defeat reason.

**Step 3: Run simulation to verify**

Run: `bun run simulate --runs 5 --log silent`
Expected: Simulation completes (may show earth collapse defeats depending on balance)

**Step 4: Commit**

```bash
git add src/simulation/MetricsCollector.ts src/simulation/SimulationRunner.ts
git commit -m "feat(simulation): track Earth crisis metrics"
```

---

### Task 9: Run Full Test Suite and Simulation

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run simulation**

Run: `bun run simulate --runs 50 --log silent`
Expected: Shows win/loss distribution with some Earth collapse losses

**Step 3: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 4: Final commit if needed**

```bash
git status
# If any uncommitted changes, commit them
```
