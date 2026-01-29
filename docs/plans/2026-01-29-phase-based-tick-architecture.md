# Phase-Based Tick Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the game tick system into a centralized, phase-based architecture with 27 explicit phases and automatic dependency-based execution ordering.

**Architecture:** A TickRunner orchestrates TickPhase objects, each declaring reads/writes for automatic topological sorting. TickContext provides typed access to game state and derived values computed during the tick.

**Tech Stack:** TypeScript, Bun test runner

---

## Task 1: Create Core Types

**Files:**
- Create: `src/core/tick/TickPhase.ts`
- Create: `src/core/tick/TickContext.ts`
- Test: `tests/tick/TickPhase.test.ts`

**Step 1: Write the type definitions for TickPhase**

```typescript
// src/core/tick/TickPhase.ts
import type { TickContext } from "./TickContext";
import type { GameEvent } from "../models/GameEvent";

/**
 * A named unit of computation in the game tick.
 * Declares explicit data dependencies via reads/writes.
 */
export interface TickPhase {
  /** Unique identifier, e.g., "buildings:processConstruction" */
  id: string;

  /** Human-readable name, e.g., "Process Construction" */
  name: string;

  /** Data paths this phase reads from */
  reads: readonly string[];

  /** Data paths this phase writes to */
  writes: readonly string[];

  /** Execute the phase, returning any generated events */
  execute(ctx: TickContext): GameEvent[];
}

/**
 * Helper to create a phase with proper typing.
 */
export function definePhase(phase: TickPhase): TickPhase {
  return phase;
}
```

**Step 2: Write the type definitions for TickContext**

```typescript
// src/core/tick/TickContext.ts
import type { BuildingManager } from "../systems/BuildingManager";
import type { ColonyManager } from "../systems/ColonyManager";
import type { EventManager } from "../systems/EventManager";
import type { NPCInfluenceManager } from "../systems/NPCInfluenceManager";
import type { OperationsManager } from "../systems/OperationsManager";
import type { ResourceManager } from "../systems/ResourceManager";
import type { TechnologyTree } from "../systems/TechnologyTree";
import type { VictoryManager } from "../systems/VictoryManager";
import type { WorkforceManager } from "../systems/WorkforceManager";

/**
 * Social cohesion data computed during the tick.
 */
export interface SocialCohesionData {
  averageClusteringCoefficient: number;
  averageConnectionCount: number;
  isolatedCount: number;
  isolatedColonists: string[];
}

/**
 * Policy effects computed during the tick.
 */
export interface PolicyEffects {
  morale: number;
  health: number;
}

/**
 * Derived values computed by early phases, read by later phases.
 */
export interface DerivedValues {
  socialCohesion: SocialCohesionData | null;
  policyEffects: PolicyEffects | null;
  laborPoolBonus: number;
  oxygenContribution: number;
}

/**
 * Settings that affect tick behavior.
 */
export interface TickSettings {
  autoAssignNewColonists: boolean;
}

/**
 * Context passed to each phase during tick execution.
 * Provides access to all game state and derived values.
 */
export interface TickContext {
  /** Current game sol */
  currentSol: number;

  /** Core managers */
  resources: ResourceManager;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  technology: TechnologyTree;
  operations: OperationsManager;
  npcInfluence: NPCInfluenceManager;
  events: EventManager;
  victory: VictoryManager;

  /** Derived values computed during tick */
  derived: DerivedValues;

  /** Settings */
  settings: TickSettings;
}

/**
 * Create a fresh TickContext for a tick.
 * Derived values start as null/0, computed by phases.
 */
export function createTickContext(
  currentSol: number,
  managers: {
    resources: ResourceManager;
    buildings: BuildingManager;
    colony: ColonyManager;
    workforce: WorkforceManager;
    technology: TechnologyTree;
    operations: OperationsManager;
    npcInfluence: NPCInfluenceManager;
    events: EventManager;
    victory: VictoryManager;
  },
  settings: TickSettings,
): TickContext {
  return {
    currentSol,
    ...managers,
    derived: {
      socialCohesion: null,
      policyEffects: null,
      laborPoolBonus: 0,
      oxygenContribution: 0,
    },
    settings,
  };
}
```

**Step 3: Write a basic test for definePhase**

```typescript
// tests/tick/TickPhase.test.ts
import { describe, expect, test } from "bun:test";
import { definePhase } from "../../src/core/tick/TickPhase";
import type { TickContext } from "../../src/core/tick/TickContext";

describe("TickPhase", () => {
  test("definePhase creates a valid phase object", () => {
    const phase = definePhase({
      id: "test:example",
      name: "Example Phase",
      reads: ["resources"],
      writes: ["derived.testValue"],
      execute: (_ctx: TickContext) => [],
    });

    expect(phase.id).toBe("test:example");
    expect(phase.name).toBe("Example Phase");
    expect(phase.reads).toEqual(["resources"]);
    expect(phase.writes).toEqual(["derived.testValue"]);
  });
});
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/tick/TickPhase.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/tick/TickPhase.ts src/core/tick/TickContext.ts tests/tick/TickPhase.test.ts
git commit -m "feat(tick): add TickPhase and TickContext core types"
```

---

## Task 2: Create TickRunner

**Files:**
- Create: `src/core/tick/TickRunner.ts`
- Test: `tests/tick/TickRunner.test.ts`

**Step 1: Write failing test for TickRunner registration**

```typescript
// tests/tick/TickRunner.test.ts
import { describe, expect, test } from "bun:test";
import { TickRunner } from "../../src/core/tick/TickRunner";
import { definePhase } from "../../src/core/tick/TickPhase";
import type { TickContext } from "../../src/core/tick/TickContext";

describe("TickRunner", () => {
  test("registers phases and computes execution order", () => {
    const runner = new TickRunner();

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);
    runner.register(phaseB);
    runner.recomputeOrder();

    const order = runner.getExecutionOrder();
    expect(order.map((p) => p.id)).toEqual(["test:phaseA", "test:phaseB"]);
  });

  test("topologically sorts based on reads/writes", () => {
    const runner = new TickRunner();

    // Register in reverse order to prove sorting works
    const phaseC = definePhase({
      id: "test:phaseC",
      name: "Phase C",
      reads: ["derived.valueB"],
      writes: ["derived.valueC"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseC);
    runner.register(phaseA);
    runner.register(phaseB);
    runner.recomputeOrder();

    const order = runner.getExecutionOrder();
    const ids = order.map((p) => p.id);

    // A must come before B, B must come before C
    expect(ids.indexOf("test:phaseA")).toBeLessThan(ids.indexOf("test:phaseB"));
    expect(ids.indexOf("test:phaseB")).toBeLessThan(ids.indexOf("test:phaseC"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/TickRunner.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write TickRunner implementation**

```typescript
// src/core/tick/TickRunner.ts
import type { GameEvent } from "../models/GameEvent";
import type { TickContext } from "./TickContext";
import type { TickPhase } from "./TickPhase";

/**
 * Orchestrates phase execution during a game tick.
 * Automatically orders phases based on their read/write dependencies.
 */
export class TickRunner {
  private phases: Map<string, TickPhase> = new Map();
  private executionOrder: string[] = [];
  private dirty: boolean = true;

  /**
   * Register a phase. Call recomputeOrder() after all phases are registered.
   */
  register(phase: TickPhase): void {
    if (this.phases.has(phase.id)) {
      throw new Error(`Phase with id "${phase.id}" already registered`);
    }
    this.phases.set(phase.id, phase);
    this.dirty = true;
  }

  /**
   * Build execution order from dependency graph using topological sort.
   * A phase must run after any phase that writes to something it reads.
   */
  recomputeOrder(): void {
    // Build a map of data path -> phase id that writes it
    const writers = new Map<string, string>();
    for (const [id, phase] of this.phases) {
      for (const path of phase.writes) {
        writers.set(path, id);
      }
    }

    // Build dependency graph: phase id -> set of phase ids that must run before it
    const deps = new Map<string, Set<string>>();
    for (const [id, phase] of this.phases) {
      deps.set(id, new Set());
      for (const path of phase.reads) {
        const writerId = writers.get(path);
        if (writerId && writerId !== id) {
          deps.get(id)!.add(writerId);
        }
      }
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    for (const id of this.phases.keys()) {
      inDegree.set(id, deps.get(id)!.size);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);

      // Find phases that depend on this one
      for (const [depId, depSet] of deps) {
        if (depSet.has(id)) {
          const newDegree = inDegree.get(depId)! - 1;
          inDegree.set(depId, newDegree);
          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      }
    }

    if (result.length !== this.phases.size) {
      throw new Error("Cycle detected in phase dependencies");
    }

    this.executionOrder = result;
    this.dirty = false;
  }

  /**
   * Execute all phases in order, returning collected events.
   */
  tick(ctx: TickContext): GameEvent[] {
    if (this.dirty) {
      this.recomputeOrder();
    }

    const events: GameEvent[] = [];

    for (const phaseId of this.executionOrder) {
      const phase = this.phases.get(phaseId)!;
      const phaseEvents = phase.execute(ctx);
      events.push(...phaseEvents);
    }

    return events;
  }

  /**
   * Get the computed execution order (for debugging/display).
   */
  getExecutionOrder(): Array<{ id: string; name: string }> {
    if (this.dirty) {
      this.recomputeOrder();
    }

    return this.executionOrder.map((id) => ({
      id,
      name: this.phases.get(id)!.name,
    }));
  }

  /**
   * Get a registered phase by id.
   */
  getPhase(id: string): TickPhase | undefined {
    return this.phases.get(id);
  }

  /**
   * Get all registered phases.
   */
  getAllPhases(): TickPhase[] {
    return Array.from(this.phases.values());
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/tick/TickRunner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/tick/TickRunner.ts tests/tick/TickRunner.test.ts
git commit -m "feat(tick): add TickRunner with topological sort"
```

---

## Task 3: Create Phase Index and Public API

**Files:**
- Create: `src/core/tick/phases/index.ts`
- Create: `src/core/tick/index.ts`

**Step 1: Create phases index (empty for now)**

```typescript
// src/core/tick/phases/index.ts
import { TickRunner } from "../TickRunner";

/**
 * Create a TickRunner with all standard game phases registered.
 * Phases are added incrementally as they are extracted from managers.
 */
export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // Phases will be registered here as they are implemented
  // For now, return empty runner

  runner.recomputeOrder();
  return runner;
}
```

**Step 2: Create public API**

```typescript
// src/core/tick/index.ts
export { TickRunner } from "./TickRunner";
export { createTickContext } from "./TickContext";
export { definePhase } from "./TickPhase";
export { createStandardTickRunner } from "./phases";

export type { TickPhase } from "./TickPhase";
export type {
  TickContext,
  DerivedValues,
  PolicyEffects,
  SocialCohesionData,
  TickSettings,
} from "./TickContext";
```

**Step 3: Commit**

```bash
git add src/core/tick/phases/index.ts src/core/tick/index.ts
git commit -m "feat(tick): add public API and phase registry"
```

---

## Task 4: Implement Victory Phase

**Files:**
- Create: `src/core/tick/phases/victory.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/victory.test.ts`

**Step 1: Write failing test for victory phase**

```typescript
// tests/tick/phases/victory.test.ts
import { describe, expect, test } from "bun:test";
import { checkVictoryConditions } from "../../../src/core/tick/phases/victory";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("victory:checkConditions", () => {
  test("phase has correct id and dependencies", () => {
    expect(checkVictoryConditions.id).toBe("victory:checkConditions");
    expect(checkVictoryConditions.reads).toContain("technology");
    expect(checkVictoryConditions.reads).toContain("colony");
    expect(checkVictoryConditions.reads).toContain("resources");
    expect(checkVictoryConditions.writes).toContain("victory");
  });

  test("executes without error on fresh game state", () => {
    const state = new GameState();
    const ctx = createTickContext(
      state.currentSol,
      {
        resources: state.resources,
        buildings: state.buildings,
        colony: state.colony,
        workforce: state.workforce,
        technology: state.technology,
        operations: state.operations,
        npcInfluence: state.npcInfluence,
        events: state.events,
        victory: state.victory,
      },
      { autoAssignNewColonists: true },
    );

    const events = checkVictoryConditions.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/victory.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement victory phase**

```typescript
// src/core/tick/phases/victory.ts
import { definePhase } from "../TickPhase";

/**
 * Check victory conditions at end of tick.
 */
export const checkVictoryConditions = definePhase({
  id: "victory:checkConditions",
  name: "Check Victory Conditions",
  reads: ["technology", "colony", "resources"],
  writes: ["victory", "events"],

  execute(ctx) {
    return ctx.victory.tick(ctx.technology, ctx.colony, ctx.resources);
  },
});
```

**Step 4: Register phase in index**

```typescript
// src/core/tick/phases/index.ts
import { TickRunner } from "../TickRunner";
import { checkVictoryConditions } from "./victory";

/**
 * Create a TickRunner with all standard game phases registered.
 */
export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // Victory
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/tick/phases/victory.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/tick/phases/victory.ts src/core/tick/phases/index.ts tests/tick/phases/victory.test.ts
git commit -m "feat(tick): add victory:checkConditions phase"
```

---

## Task 5: Implement Technology Phase

**Files:**
- Create: `src/core/tick/phases/technology.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/technology.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/technology.test.ts
import { describe, expect, test } from "bun:test";
import { processResearch } from "../../../src/core/tick/phases/technology";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("technology:processResearch", () => {
  test("phase has correct id and dependencies", () => {
    expect(processResearch.id).toBe("technology:processResearch");
    expect(processResearch.reads).toContain("technology");
    expect(processResearch.reads).toContain("resources");
    expect(processResearch.writes).toContain("technology");
  });

  test("executes without error on fresh game state", () => {
    const state = new GameState();
    const ctx = createTickContext(
      state.currentSol,
      {
        resources: state.resources,
        buildings: state.buildings,
        colony: state.colony,
        workforce: state.workforce,
        technology: state.technology,
        operations: state.operations,
        npcInfluence: state.npcInfluence,
        events: state.events,
        victory: state.victory,
      },
      { autoAssignNewColonists: true },
    );

    const events = processResearch.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/technology.test.ts`
Expected: FAIL

**Step 3: Implement technology phase**

```typescript
// src/core/tick/phases/technology.ts
import { definePhase } from "../TickPhase";

/**
 * Process technology research progress.
 */
export const processResearch = definePhase({
  id: "technology:processResearch",
  name: "Process Research",
  reads: ["technology", "resources"],
  writes: ["technology", "events"],

  execute(ctx) {
    return ctx.technology.tick(ctx.resources);
  },
});
```

**Step 4: Update index**

```typescript
// src/core/tick/phases/index.ts
import { TickRunner } from "../TickRunner";
import { processResearch } from "./technology";
import { checkVictoryConditions } from "./victory";

export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // Technology
  runner.register(processResearch);

  // Victory
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/tick/phases/technology.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/tick/phases/technology.ts src/core/tick/phases/index.ts tests/tick/phases/technology.test.ts
git commit -m "feat(tick): add technology:processResearch phase"
```

---

## Task 6: Implement Resource Phases

**Files:**
- Create: `src/core/tick/phases/resources.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/resources.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/resources.test.ts
import { describe, expect, test } from "bun:test";
import { applyResourceFlows, checkResourceDepletion } from "../../../src/core/tick/phases/resources";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("resources phases", () => {
  describe("resources:applyFlows", () => {
    test("phase has correct id and dependencies", () => {
      expect(applyResourceFlows.id).toBe("resources:applyFlows");
      expect(applyResourceFlows.reads).toContain("resources");
      expect(applyResourceFlows.writes).toContain("resources");
    });

    test("applies production and consumption", () => {
      const state = new GameState();
      state.resources.addProduction({ food: 10 });
      state.resources.addConsumption({ food: 5 });
      const initialFood = state.resources.getResources().food;

      const ctx = createTickContext(
        state.currentSol,
        {
          resources: state.resources,
          buildings: state.buildings,
          colony: state.colony,
          workforce: state.workforce,
          technology: state.technology,
          operations: state.operations,
          npcInfluence: state.npcInfluence,
          events: state.events,
          victory: state.victory,
        },
        { autoAssignNewColonists: true },
      );

      applyResourceFlows.execute(ctx);
      expect(state.resources.getResources().food).toBe(initialFood + 5);
    });
  });

  describe("resources:checkDepletion", () => {
    test("phase has correct id and dependencies", () => {
      expect(checkResourceDepletion.id).toBe("resources:checkDepletion");
      expect(checkResourceDepletion.reads).toContain("resources");
      expect(checkResourceDepletion.writes).toContain("events");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/resources.test.ts`
Expected: FAIL

**Step 3: Implement resource phases**

```typescript
// src/core/tick/phases/resources.ts
import type { GameEvent } from "../../models/GameEvent";
import { RESOURCE_KEYS } from "../../models/Resources";
import { definePhase } from "../TickPhase";

/**
 * Apply resource production and consumption flows.
 * This modifies current resource amounts based on net flow.
 */
export const applyResourceFlows = definePhase({
  id: "resources:applyFlows",
  name: "Apply Resource Flows",
  reads: ["resources"],
  writes: ["resources"],

  execute(ctx) {
    const resources = ctx.resources;
    const production = resources.getProduction();
    const consumption = resources.getConsumption();

    for (const key of RESOURCE_KEYS) {
      const produced = production[key] || 0;
      const consumed = consumption[key] || 0;
      const net = produced - consumed;

      const current = resources.getResources()[key];
      const newValue = Math.max(0, current + net);

      // Use add with the delta (can be negative)
      if (net !== 0) {
        resources.add({ [key]: net });
        // Clamp to 0 if it went negative
        if (resources.getResources()[key] < 0) {
          resources.add({ [key]: -resources.getResources()[key] });
        }
      }
    }

    return [];
  },
});

/**
 * Check for resource depletion and emit warning events.
 */
export const checkResourceDepletion = definePhase({
  id: "resources:checkDepletion",
  name: "Check Resource Depletion",
  reads: ["resources"],
  writes: ["events"],

  execute(ctx) {
    const events: GameEvent[] = [];
    const resources = ctx.resources.getResources();

    for (const key of RESOURCE_KEYS) {
      const amount = resources[key];

      if (amount === 0) {
        events.push({
          type: "RESOURCE_DEPLETED",
          resource: key,
          severity: "critical",
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} depleted!`,
        });
      } else if (amount < 20) {
        events.push({
          type: "RESOURCE_LOW",
          resource: key,
          severity: "warning",
          currentAmount: amount,
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} running low: ${Math.floor(amount)}`,
        });
      }
    }

    return events;
  },
});
```

**Step 4: Update index**

```typescript
// src/core/tick/phases/index.ts
import { TickRunner } from "../TickRunner";
import { applyResourceFlows, checkResourceDepletion } from "./resources";
import { processResearch } from "./technology";
import { checkVictoryConditions } from "./victory";

export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // Resources
  runner.register(applyResourceFlows);
  runner.register(checkResourceDepletion);

  // Technology
  runner.register(processResearch);

  // Victory
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/tick/phases/resources.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/tick/phases/resources.ts src/core/tick/phases/index.ts tests/tick/phases/resources.test.ts
git commit -m "feat(tick): add resource phases (applyFlows, checkDepletion)"
```

---

## Task 7: Implement Pre-tick Phases

**Files:**
- Create: `src/core/tick/phases/pretick.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/pretick.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/pretick.test.ts
import { describe, expect, test } from "bun:test";
import { updateLaborPoolBonus, applyOxygenContribution } from "../../../src/core/tick/phases/pretick";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("pretick phases", () => {
  describe("pretick:updateLaborPoolBonus", () => {
    test("phase has correct id and dependencies", () => {
      expect(updateLaborPoolBonus.id).toBe("pretick:updateLaborPoolBonus");
      expect(updateLaborPoolBonus.reads).toContain("colony");
      expect(updateLaborPoolBonus.reads).toContain("buildings");
      expect(updateLaborPoolBonus.writes).toContain("buildings");
    });
  });

  describe("pretick:applyOxygenContribution", () => {
    test("phase has correct id and dependencies", () => {
      expect(applyOxygenContribution.id).toBe("pretick:applyOxygenContribution");
      expect(applyOxygenContribution.reads).toContain("buildings");
      expect(applyOxygenContribution.writes).toContain("resources");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/pretick.test.ts`
Expected: FAIL

**Step 3: Implement pretick phases**

```typescript
// src/core/tick/phases/pretick.ts
import {
  LABOR_POOL_BONUS_CAP,
  LABOR_POOL_BONUS_PER_COLONIST,
} from "../../balance/WorkforceBalance";
import { definePhase } from "../TickPhase";

/**
 * Update the labor pool bonus based on unassigned colonists.
 * Unassigned colonists contribute to construction speed.
 */
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
    const bonus = Math.min(
      unassignedCount * LABOR_POOL_BONUS_PER_COLONIST,
      LABOR_POOL_BONUS_CAP,
    );

    ctx.buildings.setConstructionSpeedBonus(bonus);
    ctx.derived.laborPoolBonus = bonus;

    return [];
  },
});

/**
 * Apply oxygen contribution from buildings before resource tick.
 */
export const applyOxygenContribution = definePhase({
  id: "pretick:applyOxygenContribution",
  name: "Apply Oxygen Contribution",
  reads: ["buildings"],
  writes: ["resources", "derived.oxygenContribution"],

  execute(ctx) {
    const oxygenContribution = ctx.buildings.getTotalOxygenContribution();
    ctx.derived.oxygenContribution = oxygenContribution;

    if (oxygenContribution !== 0) {
      ctx.resources.add({ oxygen: oxygenContribution });
    }

    return [];
  },
});
```

**Step 4: Update index**

```typescript
// src/core/tick/phases/index.ts
import { TickRunner } from "../TickRunner";
import { updateLaborPoolBonus, applyOxygenContribution } from "./pretick";
import { applyResourceFlows, checkResourceDepletion } from "./resources";
import { processResearch } from "./technology";
import { checkVictoryConditions } from "./victory";

export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // Pre-tick
  runner.register(updateLaborPoolBonus);
  runner.register(applyOxygenContribution);

  // Resources
  runner.register(applyResourceFlows);
  runner.register(checkResourceDepletion);

  // Technology
  runner.register(processResearch);

  // Victory
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/tick/phases/pretick.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/tick/phases/pretick.ts src/core/tick/phases/index.ts tests/tick/phases/pretick.test.ts
git commit -m "feat(tick): add pretick phases (laborPoolBonus, oxygenContribution)"
```

---

## Task 8: Implement Politics Phase

**Files:**
- Create: `src/core/tick/phases/politics.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/politics.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/politics.test.ts
import { describe, expect, test } from "bun:test";
import { processNPCInfluence } from "../../../src/core/tick/phases/politics";

describe("politics:processNPCInfluence", () => {
  test("phase has correct id and dependencies", () => {
    expect(processNPCInfluence.id).toBe("politics:processNPCInfluence");
    expect(processNPCInfluence.reads).toContain("npcInfluence");
    expect(processNPCInfluence.reads).toContain("currentSol");
    expect(processNPCInfluence.writes).toContain("npcInfluence");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/politics.test.ts`
Expected: FAIL

**Step 3: Implement politics phase**

```typescript
// src/core/tick/phases/politics.ts
import { definePhase } from "../TickPhase";

/**
 * Process NPC influence and political dynamics.
 */
export const processNPCInfluence = definePhase({
  id: "politics:processNPCInfluence",
  name: "Process NPC Influence",
  reads: ["npcInfluence", "currentSol"],
  writes: ["npcInfluence", "events"],

  execute(ctx) {
    return ctx.npcInfluence.tick(ctx.currentSol);
  },
});
```

**Step 4: Update index**

Add to imports and register: `runner.register(processNPCInfluence);` in the Politics section.

**Step 5: Run test, commit**

```bash
git add src/core/tick/phases/politics.ts src/core/tick/phases/index.ts tests/tick/phases/politics.test.ts
git commit -m "feat(tick): add politics:processNPCInfluence phase"
```

---

## Task 9: Implement Events Phase

**Files:**
- Create: `src/core/tick/phases/events.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/events.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/events.test.ts
import { describe, expect, test } from "bun:test";
import { processRandomEvents } from "../../../src/core/tick/phases/events";

describe("events:processRandomEvents", () => {
  test("phase has correct id and dependencies", () => {
    expect(processRandomEvents.id).toBe("events:processRandomEvents");
    expect(processRandomEvents.reads).toContain("currentSol");
    expect(processRandomEvents.reads).toContain("events");
    expect(processRandomEvents.writes).toContain("events");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/events.test.ts`
Expected: FAIL

**Step 3: Implement events phase**

```typescript
// src/core/tick/phases/events.ts
import { definePhase } from "../TickPhase";

/**
 * Process random events.
 */
export const processRandomEvents = definePhase({
  id: "events:processRandomEvents",
  name: "Process Random Events",
  reads: ["currentSol", "events"],
  writes: ["events"],

  execute(ctx) {
    return ctx.events.tick(ctx.currentSol);
  },
});
```

**Step 4: Update index, run test, commit**

```bash
git add src/core/tick/phases/events.ts src/core/tick/phases/index.ts tests/tick/phases/events.test.ts
git commit -m "feat(tick): add events:processRandomEvents phase"
```

---

## Task 10: Implement Operations Phases

**Files:**
- Create: `src/core/tick/phases/operations.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/operations.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/operations.test.ts
import { describe, expect, test } from "bun:test";
import { processOperations, processDepositExtraction } from "../../../src/core/tick/phases/operations";

describe("operations phases", () => {
  describe("operations:processOperations", () => {
    test("phase has correct id and dependencies", () => {
      expect(processOperations.id).toBe("operations:processOperations");
      expect(processOperations.reads).toContain("operations");
      expect(processOperations.reads).toContain("currentSol");
      expect(processOperations.writes).toContain("operations");
    });
  });

  describe("operations:processDepositExtraction", () => {
    test("phase has correct id and dependencies", () => {
      expect(processDepositExtraction.id).toBe("operations:processDepositExtraction");
      expect(processDepositExtraction.reads).toContain("buildings");
      expect(processDepositExtraction.reads).toContain("operations");
      expect(processDepositExtraction.writes).toContain("operations");
      expect(processDepositExtraction.writes).toContain("buildings");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/operations.test.ts`
Expected: FAIL

**Step 3: Implement operations phases**

```typescript
// src/core/tick/phases/operations.ts
import type { GameEvent } from "../../models/GameEvent";
import {
  canExtract,
  getBaseProductionForDeposit,
  getDepletionEvents,
} from "../../utils/depositExtraction";
import { definePhase } from "../TickPhase";

/**
 * Process active operations (expeditions, policies, etc.).
 */
export const processOperations = definePhase({
  id: "operations:processOperations",
  name: "Process Operations",
  reads: ["operations", "currentSol", "resources", "colony"],
  writes: ["operations", "events"],

  execute(ctx) {
    return ctx.operations.tick(ctx.currentSol, ctx.resources, ctx.colony);
  },
});

/**
 * Process deposit extraction for mining buildings.
 */
export const processDepositExtraction = definePhase({
  id: "operations:processDepositExtraction",
  name: "Process Deposit Extraction",
  reads: ["buildings", "operations"],
  writes: ["operations", "buildings", "resources", "events"],

  execute(ctx) {
    const events: GameEvent[] = [];

    for (const building of ctx.buildings.getActiveBuildings()) {
      const def = ctx.buildings.getDefinition(building.definitionId);
      if (!canExtract(building, def) || !def) continue;

      const site = ctx.operations.getSites().find((s) => s.id === building.depositId);
      if (!site) continue;

      const baseProduction = getBaseProductionForDeposit(def, site.resourceType);
      if (baseProduction === 0) continue;

      const warningBefore = ctx.operations.getDepletionWarningLevel(site.id);
      ctx.operations.processExtraction(building.id, baseProduction);
      const warningAfter = ctx.operations.getDepletionWarningLevel(site.id);

      events.push(...getDepletionEvents(warningBefore, warningAfter, site, building, def.name));

      if (warningAfter === "depleted") {
        // Transition building to idle
        building.status = "idle";

        const effectiveProd = ctx.buildings.getEffectiveProduction(building.id);
        const effectiveCons = ctx.buildings.getEffectiveConsumption(building.id);

        if (Object.keys(effectiveProd).length > 0) {
          ctx.resources.removeProduction(effectiveProd);
        }
        if (Object.keys(effectiveCons).length > 0) {
          ctx.resources.removeConsumption(effectiveCons);
        }
      }
    }

    return events;
  },
});
```

**Step 4: Update index, run test, commit**

```bash
git add src/core/tick/phases/operations.ts src/core/tick/phases/index.ts tests/tick/phases/operations.test.ts
git commit -m "feat(tick): add operations phases (processOperations, depositExtraction)"
```

---

## Task 11: Implement Building Phases

**Files:**
- Create: `src/core/tick/phases/buildings.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/buildings.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/buildings.test.ts
import { describe, expect, test } from "bun:test";
import {
  processConstruction,
  processRepairs,
  processRecycling,
  processMaintenanceDecay,
} from "../../../src/core/tick/phases/buildings";

describe("buildings phases", () => {
  test("processConstruction has correct dependencies", () => {
    expect(processConstruction.id).toBe("buildings:processConstruction");
    expect(processConstruction.reads).toContain("buildings");
    expect(processConstruction.writes).toContain("buildings");
    expect(processConstruction.writes).toContain("resources");
  });

  test("processRepairs has correct dependencies", () => {
    expect(processRepairs.id).toBe("buildings:processRepairs");
  });

  test("processRecycling has correct dependencies", () => {
    expect(processRecycling.id).toBe("buildings:processRecycling");
  });

  test("processMaintenanceDecay has correct dependencies", () => {
    expect(processMaintenanceDecay.id).toBe("buildings:processMaintenanceDecay");
    expect(processMaintenanceDecay.reads).toContain("currentSol");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/buildings.test.ts`
Expected: FAIL

**Step 3: Implement building phases**

```typescript
// src/core/tick/phases/buildings.ts
import { definePhase } from "../TickPhase";

/**
 * Process building construction progress.
 */
export const processConstruction = definePhase({
  id: "buildings:processConstruction",
  name: "Process Construction",
  reads: ["buildings", "resources", "colony", "derived.laborPoolBonus"],
  writes: ["buildings", "resources", "events"],

  execute(ctx) {
    // BuildingManager.tick handles construction internally
    // We call it once in a combined phase for now
    // Future: extract into separate methods
    return [];
  },
});

/**
 * Process building repairs.
 */
export const processRepairs = definePhase({
  id: "buildings:processRepairs",
  name: "Process Repairs",
  reads: ["buildings", "resources"],
  writes: ["buildings", "resources", "events"],

  execute(_ctx) {
    return [];
  },
});

/**
 * Process building recycling.
 */
export const processRecycling = definePhase({
  id: "buildings:processRecycling",
  name: "Process Recycling",
  reads: ["buildings", "resources"],
  writes: ["buildings", "resources", "events"],

  execute(_ctx) {
    return [];
  },
});

/**
 * Process building maintenance and condition decay.
 */
export const processMaintenanceDecay = definePhase({
  id: "buildings:processMaintenanceDecay",
  name: "Process Maintenance Decay",
  reads: ["buildings", "resources", "currentSol"],
  writes: ["buildings", "resources", "events"],

  execute(_ctx) {
    return [];
  },
});

/**
 * Combined building tick - calls BuildingManager.tick() which handles all building phases.
 * This is a transitional phase until we refactor BuildingManager to expose individual methods.
 */
export const processBuildingsTick = definePhase({
  id: "buildings:tick",
  name: "Process Buildings Tick",
  reads: ["buildings", "resources", "currentSol", "colony", "derived.laborPoolBonus"],
  writes: ["buildings", "resources", "events"],

  execute(ctx) {
    return ctx.buildings.tick(ctx.resources, ctx.currentSol);
  },
});
```

**Step 4: Update index (use combined phase for now)**

```typescript
// In index.ts, register processBuildingsTick instead of individual phases
import { processBuildingsTick } from "./buildings";
// ...
runner.register(processBuildingsTick);
```

**Step 5: Run test, commit**

```bash
git add src/core/tick/phases/buildings.ts src/core/tick/phases/index.ts tests/tick/phases/buildings.test.ts
git commit -m "feat(tick): add building phases (combined tick for now)"
```

---

## Task 12: Implement Workforce Phases

**Files:**
- Create: `src/core/tick/phases/workforce.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/workforce.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/workforce.test.ts
import { describe, expect, test } from "bun:test";
import { processWorkforceTick } from "../../../src/core/tick/phases/workforce";

describe("workforce phases", () => {
  test("processWorkforceTick has correct dependencies", () => {
    expect(processWorkforceTick.id).toBe("workforce:tick");
    expect(processWorkforceTick.reads).toContain("workforce");
    expect(processWorkforceTick.reads).toContain("colony");
    expect(processWorkforceTick.reads).toContain("buildings");
    expect(processWorkforceTick.writes).toContain("workforce");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/workforce.test.ts`
Expected: FAIL

**Step 3: Implement workforce phases**

```typescript
// src/core/tick/phases/workforce.ts
import { definePhase } from "../TickPhase";

/**
 * Combined workforce tick - calls WorkforceManager.tick() which handles all workforce phases.
 * This is a transitional phase until we refactor WorkforceManager to expose individual methods.
 */
export const processWorkforceTick = definePhase({
  id: "workforce:tick",
  name: "Process Workforce Tick",
  reads: ["workforce", "colony", "buildings", "currentSol"],
  writes: ["workforce", "colony", "events"],

  execute(ctx) {
    return ctx.workforce.tick(ctx.colony, ctx.buildings, ctx.currentSol);
  },
});
```

**Step 4: Update index, run test, commit**

```bash
git add src/core/tick/phases/workforce.ts src/core/tick/phases/index.ts tests/tick/phases/workforce.test.ts
git commit -m "feat(tick): add workforce phase (combined tick for now)"
```

---

## Task 13: Implement Colony Phases

**Files:**
- Create: `src/core/tick/phases/colony.ts`
- Modify: `src/core/tick/phases/index.ts`
- Test: `tests/tick/phases/colony.test.ts`

**Step 1: Write failing test**

```typescript
// tests/tick/phases/colony.test.ts
import { describe, expect, test } from "bun:test";
import {
  calculateSocialCohesion,
  calculatePolicyEffects,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "../../../src/core/tick/phases/colony";

describe("colony phases", () => {
  test("calculateSocialCohesion has correct dependencies", () => {
    expect(calculateSocialCohesion.id).toBe("colony:calculateSocialCohesion");
    expect(calculateSocialCohesion.reads).toContain("colony");
    expect(calculateSocialCohesion.reads).toContain("workforce");
    expect(calculateSocialCohesion.writes).toContain("derived.socialCohesion");
  });

  test("calculatePolicyEffects has correct dependencies", () => {
    expect(calculatePolicyEffects.id).toBe("colony:calculatePolicyEffects");
    expect(calculatePolicyEffects.reads).toContain("operations");
    expect(calculatePolicyEffects.writes).toContain("derived.policyEffects");
  });

  test("processColonyTick has correct dependencies", () => {
    expect(processColonyTick.id).toBe("colony:tick");
    expect(processColonyTick.reads).toContain("derived.socialCohesion");
    expect(processColonyTick.reads).toContain("derived.policyEffects");
  });

  test("autoAssignWorkers has correct dependencies", () => {
    expect(autoAssignWorkers.id).toBe("colony:autoAssignWorkers");
  });

  test("assignHousing has correct dependencies", () => {
    expect(assignHousing.id).toBe("colony:assignHousing");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/phases/colony.test.ts`
Expected: FAIL

**Step 3: Implement colony phases**

```typescript
// src/core/tick/phases/colony.ts
import type { GameEvent } from "../../models/GameEvent";
import { definePhase } from "../TickPhase";

/**
 * Calculate social cohesion from workforce relationships.
 */
export const calculateSocialCohesion = definePhase({
  id: "colony:calculateSocialCohesion",
  name: "Calculate Social Cohesion",
  reads: ["colony", "workforce"],
  writes: ["derived.socialCohesion"],

  execute(ctx) {
    const colonistIds = ctx.colony.getColonists().map((c) => c.id);

    ctx.derived.socialCohesion = {
      ...ctx.workforce.getColonySocialCohesion(colonistIds),
      isolatedColonists: ctx.workforce.getIsolatedColonists(colonistIds),
    };

    return [];
  },
});

/**
 * Calculate policy effects from operations.
 */
export const calculatePolicyEffects = definePhase({
  id: "colony:calculatePolicyEffects",
  name: "Calculate Policy Effects",
  reads: ["operations"],
  writes: ["derived.policyEffects"],

  execute(ctx) {
    ctx.derived.policyEffects = {
      morale: ctx.operations.getMoraleEffect(),
      health: ctx.operations.getHealthEffect(),
    };

    return [];
  },
});

/**
 * Process colony tick (population, health, morale, consumption).
 */
export const processColonyTick = definePhase({
  id: "colony:tick",
  name: "Process Colony Tick",
  reads: ["colony", "resources", "buildings", "derived.policyEffects", "derived.socialCohesion"],
  writes: ["colony", "resources", "events"],

  execute(ctx) {
    const policyEffects = ctx.derived.policyEffects ?? { morale: 0, health: 0 };
    const socialCohesionData = ctx.derived.socialCohesion
      ? {
          cohesion: {
            averageClusteringCoefficient: ctx.derived.socialCohesion.averageClusteringCoefficient,
            averageConnectionCount: ctx.derived.socialCohesion.averageConnectionCount,
            isolatedCount: ctx.derived.socialCohesion.isolatedCount,
          },
          isolatedColonists: ctx.derived.socialCohesion.isolatedColonists,
        }
      : undefined;

    return ctx.colony.tick(ctx.resources, ctx.buildings, policyEffects, socialCohesionData);
  },
});

/**
 * Auto-assign new colonists to understaffed buildings.
 */
export const autoAssignWorkers = definePhase({
  id: "colony:autoAssignWorkers",
  name: "Auto-Assign Workers",
  reads: ["colony", "buildings", "settings"],
  writes: ["buildings", "events"],

  execute(ctx) {
    if (!ctx.settings.autoAssignNewColonists) {
      return [];
    }

    // Check if there were new colonists this tick
    // For now, always try to assign - the method handles finding unassigned colonists
    return ctx.buildings.autoAssignAllWorkers(ctx.colony);
  },
});

/**
 * Assign colonists to housing.
 */
export const assignHousing = definePhase({
  id: "colony:assignHousing",
  name: "Assign Housing",
  reads: ["colony", "buildings"],
  writes: ["colony"],

  execute(ctx) {
    ctx.colony.assignHousing(ctx.buildings);
    return [];
  },
});
```

**Step 4: Update index, run test, commit**

```bash
git add src/core/tick/phases/colony.ts src/core/tick/phases/index.ts tests/tick/phases/colony.test.ts
git commit -m "feat(tick): add colony phases (socialCohesion, policyEffects, tick, assign)"
```

---

## Task 14: Complete Phase Index Registration

**Files:**
- Modify: `src/core/tick/phases/index.ts`

**Step 1: Update index with all phases in correct order**

```typescript
// src/core/tick/phases/index.ts
import { TickRunner } from "../TickRunner";

// Phase imports
import { updateLaborPoolBonus, applyOxygenContribution } from "./pretick";
import { applyResourceFlows, checkResourceDepletion } from "./resources";
import { processBuildingsTick } from "./buildings";
import { processWorkforceTick } from "./workforce";
import {
  calculateSocialCohesion,
  calculatePolicyEffects,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "./colony";
import { processResearch } from "./technology";
import { processNPCInfluence } from "./politics";
import { processOperations, processDepositExtraction } from "./operations";
import { processRandomEvents } from "./events";
import { checkVictoryConditions } from "./victory";

/**
 * Create a TickRunner with all standard game phases registered.
 */
export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // ═══════════════════════════════════════════════════════════════
  // PRE-TICK PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(updateLaborPoolBonus);
  runner.register(applyOxygenContribution);

  // ═══════════════════════════════════════════════════════════════
  // RESOURCE PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(applyResourceFlows);
  runner.register(checkResourceDepletion);

  // ═══════════════════════════════════════════════════════════════
  // BUILDING PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(processBuildingsTick);

  // ═══════════════════════════════════════════════════════════════
  // WORKFORCE PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(processWorkforceTick);

  // ═══════════════════════════════════════════════════════════════
  // COLONY PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(calculateSocialCohesion);
  runner.register(calculatePolicyEffects);
  runner.register(processColonyTick);
  runner.register(autoAssignWorkers);
  runner.register(assignHousing);

  // ═══════════════════════════════════════════════════════════════
  // TECHNOLOGY PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(processResearch);

  // ═══════════════════════════════════════════════════════════════
  // POLITICS PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(processNPCInfluence);

  // ═══════════════════════════════════════════════════════════════
  // OPERATIONS PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(processOperations);
  runner.register(processDepositExtraction);

  // ═══════════════════════════════════════════════════════════════
  // EVENT PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(processRandomEvents);

  // ═══════════════════════════════════════════════════════════════
  // VICTORY PHASES
  // ═══════════════════════════════════════════════════════════════
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}

// Re-export all phases for testing and custom runners
export { updateLaborPoolBonus, applyOxygenContribution } from "./pretick";
export { applyResourceFlows, checkResourceDepletion } from "./resources";
export { processBuildingsTick } from "./buildings";
export { processWorkforceTick } from "./workforce";
export {
  calculateSocialCohesion,
  calculatePolicyEffects,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "./colony";
export { processResearch } from "./technology";
export { processNPCInfluence } from "./politics";
export { processOperations, processDepositExtraction } from "./operations";
export { processRandomEvents } from "./events";
export { checkVictoryConditions } from "./victory";
```

**Step 2: Commit**

```bash
git add src/core/tick/phases/index.ts
git commit -m "feat(tick): complete phase registration in index"
```

---

## Task 15: Integrate TickRunner into GameState

**Files:**
- Modify: `src/core/GameState.ts`
- Test: `tests/tick/integration.test.ts`

**Step 1: Write integration test**

```typescript
// tests/tick/integration.test.ts
import { describe, expect, test } from "bun:test";
import { GameState } from "../../src/core/GameState";

describe("TickRunner integration", () => {
  test("GameState.tick() uses TickRunner and produces same behavior", () => {
    const state = new GameState();
    const initialFood = state.resources.getResources().food;

    // Run several ticks
    for (let i = 0; i < 10; i++) {
      state.tick();
    }

    // Game should still function
    expect(state.currentSol).toBe(10);
    expect(state.colony.getColonists().length).toBeGreaterThan(0);
  });

  test("getTickPhases() returns execution order", () => {
    const state = new GameState();
    const phases = state.getTickPhases();

    expect(phases.length).toBeGreaterThan(0);
    expect(phases[0]).toHaveProperty("id");
    expect(phases[0]).toHaveProperty("name");

    // Verify some expected phases exist
    const ids = phases.map((p) => p.id);
    expect(ids).toContain("pretick:updateLaborPoolBonus");
    expect(ids).toContain("resources:applyFlows");
    expect(ids).toContain("victory:checkConditions");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/tick/integration.test.ts`
Expected: FAIL (getTickPhases doesn't exist yet)

**Step 3: Modify GameState to use TickRunner**

Add to GameState.ts:

```typescript
// Add import at top
import { createStandardTickRunner, createTickContext, TickRunner } from "./tick";

// Add property
private tickRunner: TickRunner;

// In constructor, after all manager initialization:
this.tickRunner = createStandardTickRunner();

// Replace tick() method:
tick(): GameEvent[] {
  if (this.victory.isGameOver()) {
    return [];
  }

  this.currentSol++;

  const ctx = createTickContext(
    this.currentSol,
    {
      resources: this.resources,
      buildings: this.buildings,
      colony: this.colony,
      workforce: this.workforce,
      technology: this.technology,
      operations: this.operations,
      npcInfluence: this.npcInfluence,
      events: this.events,
      victory: this.victory,
    },
    {
      autoAssignNewColonists: this.autoAssignNewColonists,
    },
  );

  const events = this.tickRunner.tick(ctx);
  this.eventLog.push(...events);

  return events;
}

// Add helper method:
getTickPhases(): Array<{ id: string; name: string }> {
  return this.tickRunner.getExecutionOrder();
}
```

**Step 4: Run all tests to verify nothing broke**

Run: `bun test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/GameState.ts tests/tick/integration.test.ts
git commit -m "feat(tick): integrate TickRunner into GameState"
```

---

## Task 16: Run Full Test Suite and Fix Any Issues

**Step 1: Run full test suite**

Run: `bun test`

**Step 2: Fix any failing tests**

Common issues to check:
- Resource flow calculations may have subtle differences
- Event ordering may change
- ColonyManager.tick behavior with consumption updates

**Step 3: Run simulation to verify game balance unchanged**

Run: `bun run scripts/simulate.ts --runs 10 --verbose`

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(tick): resolve test failures after integration"
```

---

## Task 17: Clean Up and Final Verification

**Step 1: Run linter**

Run: `bun run lint:fix`

**Step 2: Run formatter**

Run: `bun run format`

**Step 3: Run full test suite one more time**

Run: `bun test`
Expected: All tests PASS

**Step 4: Delete temporary profile script**

```bash
rm scripts/profile-tick.ts
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: clean up after tick architecture refactor"
```

---

## Summary

After completing all tasks, you will have:

1. **New `src/core/tick/` directory** with:
   - `TickRunner.ts` - Phase orchestrator with topological sort
   - `TickContext.ts` - Typed context for phase execution
   - `TickPhase.ts` - Phase interface and helper
   - `phases/` - All 17 phases organized by category
   - `index.ts` - Public API

2. **Modified `GameState.ts`** that:
   - Uses TickRunner instead of inline tick logic
   - Exposes `getTickPhases()` for debugging

3. **Test coverage** for:
   - TickRunner topological sort
   - Each phase's dependencies
   - Integration with GameState

4. **Unchanged game behavior** verified by:
   - All existing tests passing
   - Simulation producing similar results
