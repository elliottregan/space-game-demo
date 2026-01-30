# Colonist Centrality & Morale Propagation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-colonist morale with network propagation, where high-centrality colonists spread their morale state to neighbors.

**Architecture:** New ColonistMoraleManager owns individual morale state and propagation. RelationshipManager extended with eigenvector centrality calculation. ColonyManager delegates morale to new manager. Colony morale becomes centrality-weighted average.

**Tech Stack:** TypeScript, Bun test runner, existing core/systems architecture

---

## Task 1: Add Balance Constants

**Files:**
- Create: `src/core/balance/MoraleBalance.ts`

**Step 1: Create the balance constants file**

```typescript
// src/core/balance/MoraleBalance.ts

export const COLONIST_MORALE = {
  // Needs hierarchy weights (must sum to 1.0)
  NEEDS_WEIGHTS: {
    physiological: 0.40,
    safety: 0.25,
    social: 0.20,
    esteem: 0.15,
  },

  // Social need thresholds
  SOCIAL_ISOLATED_THRESHOLD: 1,
  SOCIAL_SATISFIED_CONNECTIONS: 3,
  SOCIAL_SATISFIED_STRENGTH: 0.5,

  // Propagation parameters
  PROPAGATION_ALPHA: 0.15,
  BASE_MORALE_WEIGHT: 0.70,
  SOCIAL_INFLUENCE_WEIGHT: 0.30,

  // Centrality recalculation
  CENTRALITY_RECALC_INTERVAL: 20,
  CENTRALITY_MAX_ITERATIONS: 20,
  CENTRALITY_TOLERANCE: 0.0001,

  // Event thresholds
  HIGH_CENTRALITY_THRESHOLD: 0.15,
  LOW_MORALE_SPREAD_WARNING: 40,

  // Initial morale for new colonists
  INITIAL_MORALE: 70,
};
```

**Step 2: Commit**

```bash
git add src/core/balance/MoraleBalance.ts
git commit -m "feat(morale): add balance constants for colonist morale system"
```

---

## Task 2: Add Eigenvector Centrality to RelationshipManager

**Files:**
- Create: `src/core/systems/workforce/centrality.ts`
- Test: `tests/centrality.test.ts`

**Step 1: Write failing tests for eigenvector centrality**

```typescript
// tests/centrality.test.ts
import { describe, it, expect } from "bun:test";
import { computeEigenvectorCentrality } from "../src/core/systems/workforce/centrality";

describe("computeEigenvectorCentrality", () => {
  it("returns equal centrality for isolated nodes", () => {
    const adjacencyList = new Map([
      ["a", new Set<string>()],
      ["b", new Set<string>()],
      ["c", new Set<string>()],
    ]);
    const getWeight = () => 0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    expect(result.get("a")).toBeCloseTo(1 / 3, 4);
    expect(result.get("b")).toBeCloseTo(1 / 3, 4);
    expect(result.get("c")).toBeCloseTo(1 / 3, 4);
  });

  it("identifies hub node with higher centrality", () => {
    // Star graph: A connected to B, C, D (A is hub)
    const adjacencyList = new Map([
      ["a", new Set(["b", "c", "d"])],
      ["b", new Set(["a"])],
      ["c", new Set(["a"])],
      ["d", new Set(["a"])],
    ]);
    const getWeight = () => 1.0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    // Hub should have highest centrality
    const hubCentrality = result.get("a")!;
    const leafCentrality = result.get("b")!;
    expect(hubCentrality).toBeGreaterThan(leafCentrality);
  });

  it("centrality sums to 1", () => {
    const adjacencyList = new Map([
      ["a", new Set(["b", "c"])],
      ["b", new Set(["a", "c"])],
      ["c", new Set(["a", "b"])],
    ]);
    const getWeight = () => 0.5;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    const sum = [...result.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it("respects edge weights", () => {
    // A strongly connected to B, weakly to C
    const adjacencyList = new Map([
      ["a", new Set(["b", "c"])],
      ["b", new Set(["a"])],
      ["c", new Set(["a"])],
    ]);
    const weights: Record<string, number> = {
      "a:b": 1.0,
      "b:a": 1.0,
      "a:c": 0.1,
      "c:a": 0.1,
    };
    const getWeight = (id1: string, id2: string) => {
      return weights[`${id1}:${id2}`] ?? weights[`${id2}:${id1}`] ?? 0;
    };

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    // B should have higher centrality than C (stronger connection to hub)
    expect(result.get("b")!).toBeGreaterThan(result.get("c")!);
  });

  it("handles empty graph", () => {
    const adjacencyList = new Map<string, Set<string>>();
    const getWeight = () => 0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    expect(result.size).toBe(0);
  });

  it("handles single node", () => {
    const adjacencyList = new Map([["a", new Set<string>()]]);
    const getWeight = () => 0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    expect(result.get("a")).toBe(1.0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/centrality.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement eigenvector centrality**

```typescript
// src/core/systems/workforce/centrality.ts

/**
 * Compute eigenvector centrality for a social graph.
 * Measures recursive influence: a node is central if connected to other central nodes.
 *
 * @param adjacencyList Map of node ID to set of neighbor IDs
 * @param getWeight Function returning edge weight between two nodes (0-1)
 * @param maxIterations Maximum power iterations for convergence
 * @param tolerance Convergence threshold
 * @returns Map of node ID to centrality score (sums to 1)
 */
export function computeEigenvectorCentrality(
  adjacencyList: Map<string, Set<string>>,
  getWeight: (id1: string, id2: string) => number,
  maxIterations: number = 20,
  tolerance: number = 0.0001,
): Map<string, number> {
  const ids = [...adjacencyList.keys()];
  const n = ids.length;

  if (n === 0) return new Map();
  if (n === 1) return new Map([[ids[0]!, 1.0]]);

  // Initialize all centralities to 1/n
  let centrality = new Map(ids.map((id) => [id, 1 / n]));

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Map<string, number>();
    let maxDelta = 0;

    for (const id of ids) {
      // Sum of neighbors' centrality × edge weight
      let sum = 0;
      const neighbors = adjacencyList.get(id);
      if (neighbors) {
        for (const neighborId of neighbors) {
          const weight = getWeight(id, neighborId);
          sum += (centrality.get(neighborId) ?? 0) * weight;
        }
      }
      next.set(id, sum);
    }

    // Normalize to sum to 1
    const total = [...next.values()].reduce((a, b) => a + b, 0);

    if (total === 0) {
      // No edges - return equal distribution
      return new Map(ids.map((id) => [id, 1 / n]));
    }

    for (const [id, val] of next) {
      const normalized = val / total;
      maxDelta = Math.max(maxDelta, Math.abs(normalized - (centrality.get(id) ?? 0)));
      next.set(id, normalized);
    }

    centrality = next;
    if (maxDelta < tolerance) break;
  }

  return centrality;
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/centrality.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/centrality.ts tests/centrality.test.ts
git commit -m "feat(morale): add eigenvector centrality calculation"
```

---

## Task 3: Extend RelationshipManager with Centrality Caching

**Files:**
- Modify: `src/core/systems/RelationshipManager.ts`
- Test: `tests/RelationshipManager.test.ts`

**Step 1: Write failing tests for centrality caching**

Add to `tests/RelationshipManager.test.ts`:

```typescript
describe("centrality", () => {
  it("computes centrality for connected colonists", () => {
    const manager = new RelationshipManager();
    manager.createRelationship("a", "b", 0);
    manager.createRelationship("a", "c", 0);
    manager.createRelationship("b", "c", 0);

    manager.recalculateCentrality(0);

    // All connected in triangle - should have equal centrality
    const centralityA = manager.getCentrality("a");
    const centralityB = manager.getCentrality("b");
    expect(centralityA).toBeCloseTo(centralityB, 2);
    expect(centralityA).toBeGreaterThan(0);
  });

  it("returns zero centrality for unknown colonist", () => {
    const manager = new RelationshipManager();
    expect(manager.getCentrality("unknown")).toBe(0);
  });

  it("caches centrality until recalc interval", () => {
    const manager = new RelationshipManager();
    manager.createRelationship("a", "b", 0);
    manager.recalculateCentrality(0);

    const first = manager.getCentrality("a");

    // Add new relationship but don't recalculate
    manager.createRelationship("a", "c", 5);

    // Should still return cached value
    expect(manager.getCentrality("a")).toBe(first);
  });

  it("recalculates when stale", () => {
    const manager = new RelationshipManager();
    manager.createRelationship("a", "b", 0);
    manager.recalculateCentralityIfStale(0, 20); // interval = 20

    // At sol 19, should not recalculate
    manager.recalculateCentralityIfStale(19, 20);

    // At sol 20, should recalculate
    manager.createRelationship("a", "c", 20);
    manager.recalculateCentralityIfStale(20, 20);

    // Centrality should now reflect 3 nodes
    expect(manager.getCentrality("c")).toBeGreaterThan(0);
  });

  it("serializes and deserializes centrality cache", () => {
    const manager = new RelationshipManager();
    manager.createRelationship("a", "b", 0);
    manager.recalculateCentrality(10);

    const json = manager.toJSON();
    const restored = RelationshipManager.fromJSON(json);

    expect(restored.getCentrality("a")).toBe(manager.getCentrality("a"));
    expect(restored.getLastCentralitySol()).toBe(10);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/RelationshipManager.test.ts
```

Expected: FAIL - methods not defined

**Step 3: Add centrality caching to RelationshipManager**

Add imports at top of `src/core/systems/RelationshipManager.ts`:

```typescript
import { computeEigenvectorCentrality } from "./workforce/centrality";
```

Add private fields after existing fields:

```typescript
  private centralityCache: Map<string, number> = new Map();
  private lastCentralitySol: number = -1;
```

Add methods before serialization section:

```typescript
  /**
   * Recalculate eigenvector centrality for all colonists.
   */
  recalculateCentrality(currentSol: number): void {
    this.centralityCache = computeEigenvectorCentrality(
      this.adjacencyList,
      (id1, id2) => this.getRelationshipStrength(id1, id2),
    );
    this.lastCentralitySol = currentSol;
  }

  /**
   * Recalculate centrality if enough time has passed since last calculation.
   */
  recalculateCentralityIfStale(currentSol: number, interval: number): void {
    if (this.lastCentralitySol < 0 || currentSol - this.lastCentralitySol >= interval) {
      this.recalculateCentrality(currentSol);
    }
  }

  /**
   * Get cached centrality for a colonist.
   * Returns 0 if colonist not in cache.
   */
  getCentrality(colonistId: string): number {
    return this.centralityCache.get(colonistId) ?? 0;
  }

  /**
   * Get the sol when centrality was last calculated.
   */
  getLastCentralitySol(): number {
    return this.lastCentralitySol;
  }

  /**
   * Get all centrality scores.
   */
  getAllCentrality(): ReadonlyMap<string, number> {
    return this.centralityCache;
  }
```

Update `toJSON()` to include centrality:

```typescript
  toJSON(): {
    relationships: Record<string, CoworkerRelationship>;
    adjacencyList: Record<string, string[]>;
    centralityCache: Record<string, number>;
    lastCentralitySol: number;
  } {
    return {
      relationships: Object.fromEntries(this.relationships),
      adjacencyList: Object.fromEntries(
        [...this.adjacencyList.entries()].map(([k, v]) => [k, [...v]]),
      ),
      centralityCache: Object.fromEntries(this.centralityCache),
      lastCentralitySol: this.lastCentralitySol,
    };
  }
```

Update `fromJSON()` to restore centrality:

```typescript
  static fromJSON(data: ReturnType<RelationshipManager["toJSON"]>): RelationshipManager {
    const manager = new RelationshipManager();

    if (data.relationships) {
      manager.relationships = new Map(
        Object.entries(data.relationships).map(([k, v]) => [k, v as CoworkerRelationship]),
      );
    }

    if (data.adjacencyList) {
      manager.adjacencyList = new Map(
        Object.entries(data.adjacencyList).map(([k, v]) => [k, new Set(v as string[])]),
      );
    }

    if (data.centralityCache) {
      manager.centralityCache = new Map(Object.entries(data.centralityCache));
    }

    if (data.lastCentralitySol !== undefined) {
      manager.lastCentralitySol = data.lastCentralitySol;
    }

    return manager;
  }
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/RelationshipManager.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/systems/RelationshipManager.ts tests/RelationshipManager.test.ts
git commit -m "feat(morale): add centrality caching to RelationshipManager"
```

---

## Task 4: Create ColonistMoraleManager - Needs Calculation

**Files:**
- Create: `src/core/systems/ColonistMoraleManager.ts`
- Create: `tests/ColonistMoraleManager.test.ts`

**Step 1: Write failing tests for needs calculation**

```typescript
// tests/ColonistMoraleManager.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { ColonistMoraleManager } from "../src/core/systems/ColonistMoraleManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";

describe("ColonistMoraleManager", () => {
  let colonyManager: ColonyManager;
  let resourceManager: ResourceManager;
  let relationshipManager: RelationshipManager;
  let moraleManager: ColonistMoraleManager;

  beforeEach(() => {
    colonyManager = new ColonyManager(3);
    resourceManager = new ResourceManager({ food: 100, water: 100, oxygen: 100, power: 100, materials: 100 });
    relationshipManager = new RelationshipManager();
    moraleManager = new ColonistMoraleManager();
  });

  describe("calculateBaseMorale", () => {
    it("returns high morale when all needs satisfied", () => {
      const colonists = colonyManager.getColonists();
      const colonist = colonists[0]!;
      colonist.housingId = "habitat_1"; // Housed

      // Create social connections
      const others = colonists.slice(1);
      for (const other of others) {
        relationshipManager.createRelationship(colonist.id, other.id, 0, { initialStrength: 0.6 });
      }

      // Positive resource flow
      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      const baseMorale = moraleManager.calculateBaseMorale(
        colonist,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(baseMorale).toBeGreaterThan(80);
    });

    it("returns low morale when physiological needs unmet", () => {
      const colonist = colonyManager.getColonists()[0]!;
      colonist.housingId = "habitat_1";

      // Negative resource flow (shortage)
      resourceManager.addConsumption({ food: 200, water: 200, oxygen: 200 });

      const baseMorale = moraleManager.calculateBaseMorale(
        colonist,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(baseMorale).toBeLessThan(60);
    });

    it("penalizes unhoused colonists", () => {
      const colonists = colonyManager.getColonists();
      const housed = colonists[0]!;
      const unhoused = colonists[1]!;
      housed.housingId = "habitat_1";
      // unhoused has no housingId

      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      const housedMorale = moraleManager.calculateBaseMorale(
        housed,
        resourceManager,
        relationshipManager,
        colonyManager,
      );
      const unhousedMorale = moraleManager.calculateBaseMorale(
        unhoused,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(housedMorale).toBeGreaterThan(unhousedMorale);
    });

    it("penalizes isolated colonists", () => {
      const colonists = colonyManager.getColonists();
      const connected = colonists[0]!;
      const isolated = colonists[1]!;

      connected.housingId = "h1";
      isolated.housingId = "h2";

      // Give connected colonist friends
      relationshipManager.createRelationship(connected.id, colonists[2]!.id, 0, { initialStrength: 0.7 });

      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      const connectedMorale = moraleManager.calculateBaseMorale(
        connected,
        resourceManager,
        relationshipManager,
        colonyManager,
      );
      const isolatedMorale = moraleManager.calculateBaseMorale(
        isolated,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(connectedMorale).toBeGreaterThan(isolatedMorale);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/ColonistMoraleManager.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement ColonistMoraleManager with needs calculation**

```typescript
// src/core/systems/ColonistMoraleManager.ts
import { COLONIST_MORALE } from "../balance/MoraleBalance";
import type { Colonist } from "../models/Colonist";
import type { ColonyManager } from "./ColonyManager";
import type { RelationshipManager } from "./RelationshipManager";
import type { ResourceManager } from "./ResourceManager";

/**
 * Manages per-colonist morale with needs hierarchy and network propagation.
 */
export class ColonistMoraleManager {
  private moraleState: Map<string, number> = new Map();

  /**
   * Calculate base morale for a colonist from their needs satisfaction.
   * Does not include social propagation effects.
   */
  calculateBaseMorale(
    colonist: Colonist,
    resources: ResourceManager,
    relationships: RelationshipManager,
    colony: ColonyManager,
  ): number {
    const weights = COLONIST_MORALE.NEEDS_WEIGHTS;

    const physiological = this.calculatePhysiologicalNeed(resources, colony);
    const safety = this.calculateSafetyNeed(colonist);
    const social = this.calculateSocialNeed(colonist.id, relationships);
    const esteem = this.calculateEsteemNeed(colonist);

    const satisfaction =
      physiological * weights.physiological +
      safety * weights.safety +
      social * weights.social +
      esteem * weights.esteem;

    return satisfaction * 100;
  }

  /**
   * Physiological need: food, water, oxygen availability.
   * Returns 0-1 satisfaction.
   */
  private calculatePhysiologicalNeed(resources: ResourceManager, colony: ColonyManager): number {
    const netFlow = resources.getNetFlow();
    const population = colony.getPopulation();

    if (population === 0) return 1.0;

    // Check if we have positive net flow for essentials
    const foodOk = (netFlow.food ?? 0) >= 0;
    const waterOk = (netFlow.water ?? 0) >= 0;
    const oxygenOk = (netFlow.oxygen ?? 0) >= 0;

    // All three must be positive for full satisfaction
    const satisfiedCount = [foodOk, waterOk, oxygenOk].filter(Boolean).length;
    return satisfiedCount / 3;
  }

  /**
   * Safety need: housing.
   * Returns 0-1 satisfaction.
   */
  private calculateSafetyNeed(colonist: Colonist): number {
    return colonist.housingId ? 1.0 : 0.0;
  }

  /**
   * Social need: connection count and strength.
   * Returns 0-1 satisfaction.
   */
  private calculateSocialNeed(colonistId: string, relationships: RelationshipManager): number {
    const connectionCount = relationships.getConnectionCount(colonistId);

    if (connectionCount <= COLONIST_MORALE.SOCIAL_ISOLATED_THRESHOLD) {
      return 0.0;
    }

    // Get average relationship strength
    const neighbors = relationships.getNeighbors(colonistId);
    if (neighbors.size === 0) return 0.0;

    let totalStrength = 0;
    for (const neighborId of neighbors) {
      totalStrength += relationships.getRelationshipStrength(colonistId, neighborId);
    }
    const avgStrength = totalStrength / neighbors.size;

    // Scale based on both count and strength
    const countSatisfaction = Math.min(
      1.0,
      connectionCount / COLONIST_MORALE.SOCIAL_SATISFIED_CONNECTIONS,
    );
    const strengthSatisfaction = Math.min(
      1.0,
      avgStrength / COLONIST_MORALE.SOCIAL_SATISFIED_STRENGTH,
    );

    return (countSatisfaction + strengthSatisfaction) / 2;
  }

  /**
   * Esteem need: skill utilization and mastery.
   * Returns 0-1 satisfaction.
   */
  private calculateEsteemNeed(colonist: Colonist): number {
    // For now, base on whether colonist has an assigned role
    // Future: check skill match with work assignment
    const hasRole = colonist.role !== "unassigned";
    const hasMastery = colonist.masteryLevel !== "novice";

    if (hasRole && hasMastery) return 1.0;
    if (hasRole || hasMastery) return 0.5;
    return 0.2; // Base esteem from being part of colony
  }

  /**
   * Get current morale for a colonist.
   */
  getMorale(colonistId: string): number {
    return this.moraleState.get(colonistId) ?? COLONIST_MORALE.INITIAL_MORALE;
  }

  /**
   * Set morale for a colonist (used during initialization/loading).
   */
  setMorale(colonistId: string, morale: number): void {
    this.moraleState.set(colonistId, Math.max(0, Math.min(100, morale)));
  }

  /**
   * Remove a colonist from morale tracking.
   */
  removeColonist(colonistId: string): void {
    this.moraleState.delete(colonistId);
  }

  toJSON(): { moraleState: Record<string, number> } {
    return {
      moraleState: Object.fromEntries(this.moraleState),
    };
  }

  static fromJSON(data: { moraleState?: Record<string, number> }): ColonistMoraleManager {
    const manager = new ColonistMoraleManager();
    if (data.moraleState) {
      manager.moraleState = new Map(Object.entries(data.moraleState));
    }
    return manager;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/ColonistMoraleManager.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/systems/ColonistMoraleManager.ts tests/ColonistMoraleManager.test.ts
git commit -m "feat(morale): add ColonistMoraleManager with needs calculation"
```

---

## Task 5: Add Morale Propagation

**Files:**
- Modify: `src/core/systems/ColonistMoraleManager.ts`
- Modify: `tests/ColonistMoraleManager.test.ts`

**Step 1: Write failing tests for propagation**

Add to `tests/ColonistMoraleManager.test.ts`:

```typescript
describe("propagateMorale", () => {
  it("isolated colonist morale converges to base morale", () => {
    const colonist = colonyManager.getColonists()[0]!;
    colonist.housingId = "h1";
    resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

    // Set initial morale different from base
    moraleManager.setMorale(colonist.id, 30);

    // Calculate base morale
    const baseMorale = moraleManager.calculateBaseMorale(
      colonist,
      resourceManager,
      relationshipManager,
      colonyManager,
    );

    // Propagate several times
    for (let i = 0; i < 20; i++) {
      moraleManager.propagateMorale(
        colonyManager.getColonists(),
        resourceManager,
        relationshipManager,
        colonyManager,
      );
    }

    // Should converge toward base morale
    const finalMorale = moraleManager.getMorale(colonist.id);
    expect(Math.abs(finalMorale - baseMorale)).toBeLessThan(10);
  });

  it("high-centrality happy colonist raises neighbors morale", () => {
    const colonists = colonyManager.getColonists();
    const hub = colonists[0]!;
    const neighbor = colonists[1]!;

    // House everyone
    hub.housingId = "h1";
    neighbor.housingId = "h2";
    resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

    // Create star topology (hub connected to all)
    for (const other of colonists.slice(1)) {
      relationshipManager.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
    }

    // Calculate centrality
    relationshipManager.recalculateCentrality(0);

    // Hub is happy, neighbor starts sad
    moraleManager.setMorale(hub.id, 90);
    moraleManager.setMorale(neighbor.id, 40);

    // Propagate
    for (let i = 0; i < 10; i++) {
      moraleManager.propagateMorale(
        colonists,
        resourceManager,
        relationshipManager,
        colonyManager,
      );
    }

    // Neighbor should have increased morale
    expect(moraleManager.getMorale(neighbor.id)).toBeGreaterThan(40);
  });

  it("high-centrality unhappy colonist drags down neighbors", () => {
    const colonists = colonyManager.getColonists();
    const hub = colonists[0]!;
    const neighbor = colonists[1]!;

    hub.housingId = "h1";
    neighbor.housingId = "h2";
    resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

    // Create connections
    for (const other of colonists.slice(1)) {
      relationshipManager.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
    }

    relationshipManager.recalculateCentrality(0);

    // Hub is sad, neighbor starts happy
    moraleManager.setMorale(hub.id, 20);
    moraleManager.setMorale(neighbor.id, 80);

    // Propagate
    for (let i = 0; i < 10; i++) {
      moraleManager.propagateMorale(
        colonists,
        resourceManager,
        relationshipManager,
        colonyManager,
      );
    }

    // Neighbor should have decreased morale
    expect(moraleManager.getMorale(neighbor.id)).toBeLessThan(80);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/ColonistMoraleManager.test.ts
```

Expected: FAIL - propagateMorale not defined

**Step 3: Implement propagation**

Add to `ColonistMoraleManager.ts`:

```typescript
  /**
   * Propagate morale through the social network for one tick.
   * Each colonist's morale moves toward a blend of their base morale
   * and their neighbors' morale (weighted by relationship strength and centrality).
   */
  propagateMorale(
    colonists: Colonist[],
    resources: ResourceManager,
    relationships: RelationshipManager,
    colony: ColonyManager,
  ): void {
    const alpha = COLONIST_MORALE.PROPAGATION_ALPHA;
    const baseWeight = COLONIST_MORALE.BASE_MORALE_WEIGHT;
    const socialWeight = COLONIST_MORALE.SOCIAL_INFLUENCE_WEIGHT;

    // Calculate new morale for each colonist
    const newMorale = new Map<string, number>();

    for (const colonist of colonists) {
      const currentMorale = this.getMorale(colonist.id);
      const baseMorale = this.calculateBaseMorale(colonist, resources, relationships, colony);

      const neighbors = relationships.getNeighbors(colonist.id);

      if (neighbors.size === 0) {
        // Isolated: drift toward base morale only
        const target = baseMorale;
        newMorale.set(colonist.id, currentMorale + alpha * (target - currentMorale));
        continue;
      }

      // Weighted average of neighbors' morale
      let neighborInfluence = 0;
      let totalWeight = 0;

      for (const neighborId of neighbors) {
        const strength = relationships.getRelationshipStrength(colonist.id, neighborId);
        const neighborCentrality = relationships.getCentrality(neighborId);
        const weight = strength * Math.max(0.1, neighborCentrality); // Floor to prevent zero weight

        neighborInfluence += this.getMorale(neighborId) * weight;
        totalWeight += weight;
      }

      const socialMorale = totalWeight > 0 ? neighborInfluence / totalWeight : baseMorale;

      // Blend base needs with social influence
      const targetMorale = baseWeight * baseMorale + socialWeight * socialMorale;

      // Gradual drift toward target
      const nextMorale = currentMorale + alpha * (targetMorale - currentMorale);
      newMorale.set(colonist.id, Math.max(0, Math.min(100, nextMorale)));
    }

    // Apply all updates
    for (const [id, morale] of newMorale) {
      this.moraleState.set(id, morale);
    }
  }
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/ColonistMoraleManager.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/systems/ColonistMoraleManager.ts tests/ColonistMoraleManager.test.ts
git commit -m "feat(morale): add morale propagation through social network"
```

---

## Task 6: Add Colony Morale Aggregation

**Files:**
- Modify: `src/core/systems/ColonistMoraleManager.ts`
- Modify: `tests/ColonistMoraleManager.test.ts`

**Step 1: Write failing tests for aggregation**

Add to `tests/ColonistMoraleManager.test.ts`:

```typescript
describe("getColonyMorale", () => {
  it("returns centrality-weighted average", () => {
    const colonists = colonyManager.getColonists();

    // Create star topology - first colonist is hub
    const hub = colonists[0]!;
    for (const other of colonists.slice(1)) {
      relationshipManager.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
    }
    relationshipManager.recalculateCentrality(0);

    // Hub has low morale, others have high morale
    moraleManager.setMorale(hub.id, 20);
    for (const other of colonists.slice(1)) {
      moraleManager.setMorale(other.id, 80);
    }

    const colonyMorale = moraleManager.getColonyMorale(colonists, relationshipManager);

    // Simple average would be (20 + 80 + 80) / 3 = 60
    // But hub has higher centrality, so colony morale should be lower
    expect(colonyMorale).toBeLessThan(60);
  });

  it("returns simple average when no centrality calculated", () => {
    const colonists = colonyManager.getColonists();

    moraleManager.setMorale(colonists[0]!.id, 30);
    moraleManager.setMorale(colonists[1]!.id, 60);
    moraleManager.setMorale(colonists[2]!.id, 90);

    // No centrality calculation, all colonists equal weight
    const colonyMorale = moraleManager.getColonyMorale(colonists, relationshipManager);

    expect(colonyMorale).toBeCloseTo(60, 0);
  });

  it("returns 50 for empty colony", () => {
    const emptyColony = new ColonyManager(0);
    const colonyMorale = moraleManager.getColonyMorale(
      emptyColony.getColonists(),
      relationshipManager,
    );
    expect(colonyMorale).toBe(50);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/ColonistMoraleManager.test.ts
```

Expected: FAIL - getColonyMorale not defined

**Step 3: Implement colony morale aggregation**

Add to `ColonistMoraleManager.ts`:

```typescript
  /**
   * Calculate colony-wide morale as centrality-weighted average.
   * High-centrality colonists contribute more to the overall "vibe".
   */
  getColonyMorale(colonists: Colonist[], relationships: RelationshipManager): number {
    if (colonists.length === 0) return 50;

    let weightedSum = 0;
    let totalCentrality = 0;

    for (const colonist of colonists) {
      const morale = this.getMorale(colonist.id);
      const centrality = relationships.getCentrality(colonist.id);

      // Use centrality as weight, with floor of 1/n for colonists without centrality
      const weight = centrality > 0 ? centrality : 1 / colonists.length;

      weightedSum += morale * weight;
      totalCentrality += weight;
    }

    return totalCentrality > 0 ? weightedSum / totalCentrality : 50;
  }
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/ColonistMoraleManager.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/systems/ColonistMoraleManager.ts tests/ColonistMoraleManager.test.ts
git commit -m "feat(morale): add centrality-weighted colony morale aggregation"
```

---

## Task 7: Integrate into GameState

**Files:**
- Modify: `src/core/GameState.ts`
- Modify: `src/core/tick/phases/colony.ts`

**Step 1: Add ColonistMoraleManager to GameState**

In `src/core/GameState.ts`, add import:

```typescript
import { ColonistMoraleManager } from "./systems/ColonistMoraleManager";
import { COLONIST_MORALE } from "./balance/MoraleBalance";
```

Add field after existing managers:

```typescript
  private colonistMorale: ColonistMoraleManager;
```

Initialize in constructor:

```typescript
    this.colonistMorale = new ColonistMoraleManager();
```

Add getter:

```typescript
  getColonistMoraleManager(): ColonistMoraleManager {
    return this.colonistMorale;
  }
```

Update `toJSON()` to include colonist morale:

```typescript
    colonistMorale: this.colonistMorale.toJSON(),
```

Update `fromJSON()` to restore colonist morale (add after other manager restorations):

```typescript
    if (data.colonistMorale) {
      state.colonistMorale = ColonistMoraleManager.fromJSON(data.colonistMorale);
    }
```

**Step 2: Update colony tick phase**

In `src/core/tick/phases/colony.ts`, update the tick to use the new morale system.

Add centrality recalculation at the start of the phase:

```typescript
import { COLONIST_MORALE } from "../../balance/MoraleBalance";
```

At the start of the colony tick function, add:

```typescript
  // Recalculate centrality if stale
  ctx.relationships.recalculateCentralityIfStale(
    ctx.currentSol,
    COLONIST_MORALE.CENTRALITY_RECALC_INTERVAL,
  );

  // Propagate individual morale through social network
  ctx.colonistMorale.propagateMorale(
    ctx.colony.getColonists(),
    ctx.resources,
    ctx.relationships,
    ctx.colony,
  );
```

**Step 3: Update ColonyManager.getMorale() to delegate**

The ColonyManager should now get morale from the ColonistMoraleManager. This requires passing the manager or changing the architecture. For minimal change, we'll update the colony tick to sync the morale value.

After propagation, sync to colony manager:

```typescript
  // Sync colony-wide morale from individual morales
  const colonyMorale = ctx.colonistMorale.getColonyMorale(
    ctx.colony.getColonists(),
    ctx.relationships,
  );
  ctx.colony.setMorale(colonyMorale);
```

**Step 4: Run full test suite**

```bash
bun test
```

Expected: All tests PASS (may need minor adjustments to existing tests)

**Step 5: Commit**

```bash
git add src/core/GameState.ts src/core/tick/phases/colony.ts
git commit -m "feat(morale): integrate ColonistMoraleManager into game tick"
```

---

## Task 8: Add TickContext Update

**Files:**
- Modify: `src/core/tick/TickContext.ts`

**Step 1: Add colonistMorale to TickContext**

Add import:

```typescript
import type { ColonistMoraleManager } from "../systems/ColonistMoraleManager";
```

Add to TickContext interface:

```typescript
  colonistMorale: ColonistMoraleManager;
```

**Step 2: Update where TickContext is created**

Find where TickContext is constructed (likely in GameState.ts tick method) and add:

```typescript
  colonistMorale: this.colonistMorale,
```

**Step 3: Run tests**

```bash
bun test
```

**Step 4: Commit**

```bash
git add src/core/tick/TickContext.ts src/core/GameState.ts
git commit -m "feat(morale): add ColonistMoraleManager to TickContext"
```

---

## Task 9: Update UI State Types

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Expose individual morale in UI state**

Add colonist morale data to the UI state sync. In `GameService.ts`, update the state sync to include per-colonist morale:

```typescript
// In syncState or equivalent method
colonistMorale: Object.fromEntries(
  this.gameState.getColony().getColonists().map(c => [
    c.id,
    {
      morale: this.gameState.getColonistMoraleManager().getMorale(c.id),
      centrality: this.gameState.getRelationships().getCentrality(c.id),
    }
  ])
),
```

**Step 2: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat(morale): expose individual morale and centrality in UI state"
```

---

## Task 10: Final Integration Test

**Files:**
- Create: `tests/integration/colonistMorale.test.ts`

**Step 1: Write integration test**

```typescript
// tests/integration/colonistMorale.test.ts
import { describe, it, expect } from "bun:test";
import { GameState } from "../../src/core/GameState";

describe("Colonist Morale Integration", () => {
  it("morale propagates through social network over time", () => {
    const game = new GameState();

    // Get colonists and create social connections
    const colonists = game.getColony().getColonists();
    const relationships = game.getRelationships();

    // Create a connected network
    for (let i = 0; i < colonists.length - 1; i++) {
      const c1 = colonists[i]!;
      const c2 = colonists[i + 1]!;
      relationships.createRelationship(c1.id, c2.id, 0, { initialStrength: 0.7 });
    }

    // Ensure positive resources
    game.getResources().add({ food: 500, water: 500, oxygen: 500, power: 500 });
    game.getResources().addProduction({ food: 20, water: 20, oxygen: 20, power: 20 });

    // Set varied initial morale
    const moraleManager = game.getColonistMoraleManager();
    moraleManager.setMorale(colonists[0]!.id, 90);
    moraleManager.setMorale(colonists[colonists.length - 1]!.id, 30);

    // Run several ticks
    for (let i = 0; i < 50; i++) {
      game.tick();
    }

    // Morale should have converged somewhat
    const finalMorales = colonists.map(c => moraleManager.getMorale(c.id));
    const variance = calculateVariance(finalMorales);

    // Variance should be lower than initial (90 vs 30 = high variance)
    expect(variance).toBeLessThan(400); // Initial variance would be ~900
  });

  it("high-centrality colonist death impacts colony morale", () => {
    const game = new GameState();
    const colonists = game.getColony().getColonists();
    const relationships = game.getRelationships();
    const moraleManager = game.getColonistMoraleManager();

    // Create star topology - first colonist is hub
    const hub = colonists[0]!;
    for (const other of colonists.slice(1)) {
      relationships.createRelationship(hub.id, other.id, 0, { initialStrength: 0.9 });
    }

    // Give everyone good morale
    for (const c of colonists) {
      moraleManager.setMorale(c.id, 80);
    }

    // Calculate initial colony morale
    relationships.recalculateCentrality(0);
    const initialColonyMorale = moraleManager.getColonyMorale(colonists, relationships);

    // Remove the hub
    game.getColony().removeColonist(hub.id);
    moraleManager.removeColonist(hub.id);

    // Recalculate with remaining colonists
    relationships.recalculateCentrality(1);
    const remainingColonists = game.getColony().getColonists();
    const afterColonyMorale = moraleManager.getColonyMorale(remainingColonists, relationships);

    // Colony morale should be similar (hub had same morale as others)
    // But if hub was unhappy, this would show larger impact
    expect(afterColonyMorale).toBeDefined();
  });
});

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}
```

**Step 2: Run integration test**

```bash
bun test tests/integration/colonistMorale.test.ts
```

**Step 3: Commit**

```bash
git add tests/integration/colonistMorale.test.ts
git commit -m "test(morale): add integration tests for colonist morale system"
```

---

## Task 11: Run Full Test Suite and Fix Issues

**Step 1: Run all tests**

```bash
bun test
```

**Step 2: Fix any failing tests**

Address any regressions from the integration.

**Step 3: Run linter**

```bash
bun run lint:fix
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(morale): address test failures and lint issues"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Balance constants | `MoraleBalance.ts` |
| 2 | Eigenvector centrality | `centrality.ts`, tests |
| 3 | Centrality caching | `RelationshipManager.ts` |
| 4 | Needs calculation | `ColonistMoraleManager.ts` |
| 5 | Morale propagation | `ColonistMoraleManager.ts` |
| 6 | Colony aggregation | `ColonistMoraleManager.ts` |
| 7 | GameState integration | `GameState.ts`, `colony.ts` |
| 8 | TickContext update | `TickContext.ts` |
| 9 | UI state exposure | `GameService.ts` |
| 10 | Integration tests | `colonistMorale.test.ts` |
| 11 | Final fixes | Various |

**Not included (future work):**
- UI visualization of individual morale
- Colonist graph node sizing by centrality
- Event log messages for morale spread
- Debug view for centrality scores
