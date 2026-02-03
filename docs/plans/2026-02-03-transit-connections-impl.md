# Transit Connections Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add building connectivity clusters where colonists can only work at buildings connected to their housing through adjacency chains or rover depots.

**Architecture:** GridManager tracks cluster membership via flood-fill from habitat roots. BuildingManager validates cluster membership on worker assignment. Rover Depot building extends connectivity via range. UI shows connections on hover and warns on disconnection.

**Tech Stack:** TypeScript core logic, Bun test runner, Vue 3 renderer with D3 for grid visualization.

**Design Doc:** `docs/plans/2026-02-03-transit-connections-design.md`

---

## Task 1: Add Cluster Tracking Data Structures

**Files:**
- Modify: `src/core/models/Grid.ts`

**Step 1: Add cluster fields to BuildingPlacement interface**

In `src/core/models/Grid.ts`, add to the `BuildingPlacement` interface:

```typescript
export interface BuildingPlacement {
  buildingId: string;
  position: GridPosition;
  powerSourceId?: string;
  distanceToPower: number;
  batteryLevel: number;
  powerState: PowerState;
  // Transit connectivity
  clusterId?: string;
}
```

**Step 2: Add Cluster interface**

Add after the `BuildingPlacement` interface:

```typescript
export interface Cluster {
  id: string;
  rootHabitatId: string;
  buildingIds: Set<string>;
}
```

**Step 3: Commit**

```bash
git add src/core/models/Grid.ts
git commit -m "feat(grid): add cluster tracking types to BuildingPlacement"
```

---

## Task 2: Add Transit Balance Constants

**Files:**
- Modify: `src/core/balance/GridBalance.ts`

**Step 1: Add depot range constants**

Add to `src/core/balance/GridBalance.ts`:

```typescript
// Transit connectivity
export const DEPOT_RANGE_BASE = 3;

export function calculateDepotRange(hasTechBonus: boolean): number {
  const techBonus = hasTechBonus ? 1 : 0;
  return DEPOT_RANGE_BASE + techBonus;
}
```

**Step 2: Commit**

```bash
git add src/core/balance/GridBalance.ts
git commit -m "feat(balance): add depot range constants"
```

---

## Task 3: Add Rover Depot Building Definition

**Files:**
- Modify: `src/core/models/Building.ts`
- Modify: `src/core/data/buildings.ts`

**Step 1: Add ROVER_DEPOT to BuildingId enum**

In `src/core/models/Building.ts`, add to the `BuildingId` enum:

```typescript
export enum BuildingId {
  // ... existing entries ...
  ROVER_DEPOT = "rover_depot",
  // Victory megastructures
  GENERATION_SHIP = "generation_ship",
  // ...
}
```

**Step 2: Add depotRange to BuildingDefinition**

In `src/core/models/Building.ts`, add to the `BuildingDefinition` interface:

```typescript
export interface BuildingDefinition {
  // ... existing fields ...
  /** Transit connectivity range for depot buildings */
  depotRange?: number;
}
```

**Step 3: Add Rover Depot definition to buildings.ts**

In `src/core/data/buildings.ts`, add the building definition:

```typescript
[BuildingId.ROVER_DEPOT]: {
  id: BuildingId.ROVER_DEPOT,
  name: "Rover Depot",
  description: "Extends transit connectivity to distant buildings, allowing colonists to commute across gaps in the base layout.",
  cost: {
    materials: -200,
    power: -5,
  },
  constructionTime: 8,
  powerConsumption: 5,
  depotRange: 3,
  purpose: BuildingPurpose.Industrial,
},
```

**Step 4: Commit**

```bash
git add src/core/models/Building.ts src/core/data/buildings.ts
git commit -m "feat(buildings): add Rover Depot building definition"
```

---

## Task 4: Implement Core Cluster Logic in GridManager

**Files:**
- Modify: `src/core/systems/GridManager.ts`
- Create: `tests/GridConnectivity.test.ts`

**Step 1: Write failing tests for adjacency**

Create `tests/GridConnectivity.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { GridManager } from "../src/core/systems/GridManager";
import { BuildingId } from "../src/core/models/Building";

describe("GridManager - Transit Connectivity", () => {
  let manager: GridManager;

  beforeEach(() => {
    manager = new GridManager();
  });

  describe("getAdjacentPositions", () => {
    it("returns 4 cardinal neighbors for center position", () => {
      const adjacent = manager.getAdjacentPositions({ x: 5, y: 5 });
      expect(adjacent).toHaveLength(4);
      expect(adjacent).toContainEqual({ x: 4, y: 5 });
      expect(adjacent).toContainEqual({ x: 6, y: 5 });
      expect(adjacent).toContainEqual({ x: 5, y: 4 });
      expect(adjacent).toContainEqual({ x: 5, y: 6 });
    });

    it("excludes positions outside grid bounds", () => {
      const corner = manager.getAdjacentPositions({ x: 0, y: 0 });
      expect(corner).toHaveLength(2);
      expect(corner).toContainEqual({ x: 1, y: 0 });
      expect(corner).toContainEqual({ x: 0, y: 1 });
    });
  });

  describe("cluster formation", () => {
    it("habitat forms its own cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.updateClusters(new Map([["hab-1", BuildingId.HABITAT]]), new Map());

      const clusterId = manager.getBuildingClusterId("hab-1");
      expect(clusterId).toBeDefined();
    });

    it("building adjacent to habitat joins its cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.placeBuilding("farm-1", { x: 5, y: 6 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map()
      );

      const habCluster = manager.getBuildingClusterId("hab-1");
      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(habCluster).toBe(farmCluster);
    });

    it("building not adjacent to habitat has no cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.placeBuilding("farm-1", { x: 8, y: 8 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map()
      );

      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(farmCluster).toBeUndefined();
    });

    it("chain of buildings connects to habitat cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.placeBuilding("solar-1", { x: 5, y: 6 });
      manager.placeBuilding("farm-1", { x: 5, y: 7 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["solar-1", BuildingId.SOLAR_PANEL],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map()
      );

      const habCluster = manager.getBuildingClusterId("hab-1");
      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(habCluster).toBe(farmCluster);
    });

    it("two separate habitats form separate clusters", () => {
      manager.placeBuilding("hab-1", { x: 2, y: 2 });
      manager.placeBuilding("hab-2", { x: 8, y: 8 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["hab-2", BuildingId.ADVANCED_HABITAT],
        ]),
        new Map()
      );

      const cluster1 = manager.getBuildingClusterId("hab-1");
      const cluster2 = manager.getBuildingClusterId("hab-2");
      expect(cluster1).toBeDefined();
      expect(cluster2).toBeDefined();
      expect(cluster1).not.toBe(cluster2);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/GridConnectivity.test.ts
```

Expected: FAIL - methods don't exist yet.

**Step 3: Implement adjacency and cluster methods in GridManager**

Add these imports and properties to `src/core/systems/GridManager.ts`:

```typescript
import type { Cluster } from "../models/Grid";
```

Add to class properties:

```typescript
private clusters: Map<string, Cluster> = new Map();
private buildingToCluster: Map<string, string> = new Map();
```

Add these methods:

```typescript
getAdjacentPositions(pos: GridPosition): GridPosition[] {
  const deltas = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];
  return deltas
    .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter((p) => p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE);
}

getBuildingClusterId(buildingId: string): string | undefined {
  return this.buildingToCluster.get(buildingId);
}

getCluster(clusterId: string): Cluster | undefined {
  return this.clusters.get(clusterId);
}

updateClusters(
  buildingDefinitions: Map<string, BuildingId>,
  depotRanges: Map<string, number>
): void {
  // Clear existing clusters
  this.clusters.clear();
  this.buildingToCluster.clear();

  // Clear cluster IDs on placements
  for (const placement of this.placements.values()) {
    placement.clusterId = undefined;
  }

  // Find all habitats (cluster roots)
  const habitats: string[] = [];
  for (const [buildingId, defId] of buildingDefinitions) {
    if (defId === BuildingId.HABITAT || defId === BuildingId.ADVANCED_HABITAT) {
      if (this.placements.has(buildingId)) {
        habitats.push(buildingId);
      }
    }
  }

  // Build clusters via flood-fill from each habitat
  for (const habitatId of habitats) {
    const clusterId = `cluster-${habitatId}`;
    const cluster: Cluster = {
      id: clusterId,
      rootHabitatId: habitatId,
      buildingIds: new Set(),
    };

    // BFS flood-fill
    const visited = new Set<string>();
    const queue: string[] = [habitatId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      if (this.buildingToCluster.has(currentId)) continue; // Already in another cluster
      visited.add(currentId);

      const placement = this.placements.get(currentId);
      if (!placement) continue;

      // Add to cluster
      cluster.buildingIds.add(currentId);
      this.buildingToCluster.set(currentId, clusterId);
      placement.clusterId = clusterId;

      // Find adjacent buildings
      const adjacentPositions = this.getAdjacentPositions(placement.position);
      for (const adjPos of adjacentPositions) {
        const cell = this.grid[adjPos.y][adjPos.x];
        if (cell.buildingId && !visited.has(cell.buildingId)) {
          queue.push(cell.buildingId);
        }
      }
    }

    this.clusters.set(clusterId, cluster);
  }

  // Second pass: depot range connections
  for (const [depotId, range] of depotRanges) {
    const depotPlacement = this.placements.get(depotId);
    if (!depotPlacement || !depotPlacement.clusterId) continue;

    const depotClusterId = depotPlacement.clusterId;
    const depotCluster = this.clusters.get(depotClusterId);
    if (!depotCluster) continue;

    // Find buildings within depot range
    for (const [buildingId, placement] of this.placements) {
      if (placement.clusterId) continue; // Already in a cluster

      const distance = this.calculateDistance(depotPlacement.position, placement.position);
      if (distance <= range) {
        // Add to depot's cluster
        depotCluster.buildingIds.add(buildingId);
        this.buildingToCluster.set(buildingId, depotClusterId);
        placement.clusterId = depotClusterId;
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
bun test tests/GridConnectivity.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridConnectivity.test.ts
git commit -m "feat(grid): implement cluster tracking with adjacency flood-fill"
```

---

## Task 5: Add Depot Range Tests

**Files:**
- Modify: `tests/GridConnectivity.test.ts`

**Step 1: Add depot connectivity tests**

Add to `tests/GridConnectivity.test.ts`:

```typescript
describe("depot connectivity", () => {
  it("depot bridges disconnected building within range", () => {
    manager.placeBuilding("hab-1", { x: 2, y: 2 });
    manager.placeBuilding("depot-1", { x: 2, y: 3 });
    manager.placeBuilding("farm-1", { x: 2, y: 6 }); // 3 cells from depot

    manager.updateClusters(
      new Map([
        ["hab-1", BuildingId.HABITAT],
        ["depot-1", BuildingId.ROVER_DEPOT],
        ["farm-1", BuildingId.BASIC_FARM],
      ]),
      new Map([["depot-1", 3]])
    );

    const habCluster = manager.getBuildingClusterId("hab-1");
    const farmCluster = manager.getBuildingClusterId("farm-1");
    expect(farmCluster).toBe(habCluster);
  });

  it("depot does not bridge building outside range", () => {
    manager.placeBuilding("hab-1", { x: 2, y: 2 });
    manager.placeBuilding("depot-1", { x: 2, y: 3 });
    manager.placeBuilding("farm-1", { x: 2, y: 8 }); // 5 cells from depot

    manager.updateClusters(
      new Map([
        ["hab-1", BuildingId.HABITAT],
        ["depot-1", BuildingId.ROVER_DEPOT],
        ["farm-1", BuildingId.BASIC_FARM],
      ]),
      new Map([["depot-1", 3]])
    );

    const farmCluster = manager.getBuildingClusterId("farm-1");
    expect(farmCluster).toBeUndefined();
  });

  it("depot must be in a cluster to bridge", () => {
    manager.placeBuilding("hab-1", { x: 1, y: 1 });
    manager.placeBuilding("depot-1", { x: 5, y: 5 }); // Not adjacent to habitat
    manager.placeBuilding("farm-1", { x: 5, y: 6 }); // Adjacent to depot but not habitat

    manager.updateClusters(
      new Map([
        ["hab-1", BuildingId.HABITAT],
        ["depot-1", BuildingId.ROVER_DEPOT],
        ["farm-1", BuildingId.BASIC_FARM],
      ]),
      new Map([["depot-1", 3]])
    );

    const farmCluster = manager.getBuildingClusterId("farm-1");
    expect(farmCluster).toBeUndefined();
  });
});
```

**Step 2: Run tests**

```bash
bun test tests/GridConnectivity.test.ts
```

Expected: PASS (implementation from Task 4 handles depots)

**Step 3: Commit**

```bash
git add tests/GridConnectivity.test.ts
git commit -m "test(grid): add depot range connectivity tests"
```

---

## Task 6: Integrate Cluster Updates into BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Add method to get depot ranges**

Add to `BuildingManager`:

```typescript
getDepotRanges(): Map<string, number> {
  const ranges = new Map<string, number>();
  for (const [id, building] of this.buildings) {
    if (building.status !== "active") continue;
    const def = buildingDefinitions[building.definitionId];
    if (def.depotRange) {
      ranges.set(id, def.depotRange);
    }
  }
  return ranges;
}

getBuildingDefinitions(): Map<string, BuildingId> {
  const defs = new Map<string, BuildingId>();
  for (const [id, building] of this.buildings) {
    defs.set(id, building.definitionId);
  }
  return defs;
}
```

**Step 2: Update triggerClusterUpdate to use GridManager**

Add a reference to GridManager if not present, and add cluster update trigger:

```typescript
triggerClusterUpdate(): void {
  if (!this.gridManager) return;
  this.gridManager.updateClusters(
    this.getBuildingDefinitions(),
    this.getDepotRanges()
  );
}
```

**Step 3: Call triggerClusterUpdate after building changes**

In `completeConstruction`, after setting status to "active":

```typescript
this.triggerClusterUpdate();
```

In `removeBuilding`:

```typescript
this.triggerClusterUpdate();
```

In `setStatus` when status changes to/from "active":

```typescript
this.triggerClusterUpdate();
```

**Step 4: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "feat(buildings): integrate cluster updates on building changes"
```

---

## Task 7: Validate Cluster on Worker Assignment

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Create: `tests/TransitWorkerAssignment.test.ts`

**Step 1: Write failing test**

Create `tests/TransitWorkerAssignment.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { GridManager } from "../src/core/systems/GridManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BuildingId } from "../src/core/models/Building";
import { ColonistRole } from "../src/core/models/Colonist";

describe("Transit Worker Assignment", () => {
  let buildingManager: BuildingManager;
  let gridManager: GridManager;
  let colonyManager: ColonyManager;

  beforeEach(() => {
    gridManager = new GridManager();
    buildingManager = new BuildingManager();
    colonyManager = new ColonyManager();
    buildingManager.setGridManager(gridManager);
    buildingManager.setColonyManager(colonyManager);
  });

  function setupColonist(id: string, housingId: string) {
    colonyManager.addColonist({
      id,
      name: "Test",
      role: ColonistRole.FARMING,
      morale: 70,
      moraleFactors: {},
      health: 100,
      skills: { engineering: 50, farming: 80, research: 30, civilScience: 40 },
      arrivalSol: 1,
      housingId,
    });
  }

  it("allows assignment when colonist housing and workplace are in same cluster", () => {
    // Setup: habitat and farm adjacent
    gridManager.placeBuilding("hab-1", { x: 5, y: 5 });
    gridManager.placeBuilding("farm-1", { x: 5, y: 6 });

    buildingManager.createBuilding(BuildingId.HABITAT, "hab-1");
    buildingManager.createBuilding(BuildingId.BASIC_FARM, "farm-1");
    buildingManager.completeConstruction("hab-1");
    buildingManager.completeConstruction("farm-1");

    setupColonist("colonist-1", "hab-1");

    const result = buildingManager.assignWorker("farm-1", "colonist-1");
    expect(result).toBe(true);
  });

  it("rejects assignment when colonist housing and workplace are in different clusters", () => {
    // Setup: habitat and farm not connected
    gridManager.placeBuilding("hab-1", { x: 2, y: 2 });
    gridManager.placeBuilding("farm-1", { x: 8, y: 8 });

    buildingManager.createBuilding(BuildingId.HABITAT, "hab-1");
    buildingManager.createBuilding(BuildingId.BASIC_FARM, "farm-1");
    buildingManager.completeConstruction("hab-1");
    buildingManager.completeConstruction("farm-1");

    setupColonist("colonist-1", "hab-1");

    const result = buildingManager.assignWorker("farm-1", "colonist-1");
    expect(result).toBe(false);
  });

  it("allows assignment when depot bridges the gap", () => {
    // Setup: habitat, depot adjacent, farm within depot range
    gridManager.placeBuilding("hab-1", { x: 2, y: 2 });
    gridManager.placeBuilding("depot-1", { x: 2, y: 3 });
    gridManager.placeBuilding("farm-1", { x: 2, y: 6 });

    buildingManager.createBuilding(BuildingId.HABITAT, "hab-1");
    buildingManager.createBuilding(BuildingId.ROVER_DEPOT, "depot-1");
    buildingManager.createBuilding(BuildingId.BASIC_FARM, "farm-1");
    buildingManager.completeConstruction("hab-1");
    buildingManager.completeConstruction("depot-1");
    buildingManager.completeConstruction("farm-1");

    setupColonist("colonist-1", "hab-1");

    const result = buildingManager.assignWorker("farm-1", "colonist-1");
    expect(result).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/TransitWorkerAssignment.test.ts
```

Expected: FAIL - cluster validation not implemented yet.

**Step 3: Modify assignWorker to validate cluster**

In `BuildingManager.assignWorker()`, add cluster validation:

```typescript
assignWorker(buildingId: string, colonistId: string): boolean {
  const result = this.getBuildingWithDef(buildingId);
  if (!result || result.building.status !== "active") return false;
  const { building, def } = result;

  if (!def.workerSlots || building.assignedWorkers.length >= def.workerSlots) return false;
  if (building.assignedWorkers.includes(colonistId)) return false;

  // Check colonist not already assigned elsewhere
  for (const b of this.buildings.values()) {
    if (b.assignedWorkers.includes(colonistId)) return false;
  }

  // Validate transit connectivity
  if (this.gridManager && this.colonyManager) {
    const colonist = this.colonyManager.getColonist(colonistId);
    if (colonist?.housingId) {
      const housingCluster = this.gridManager.getBuildingClusterId(colonist.housingId);
      const workplaceCluster = this.gridManager.getBuildingClusterId(buildingId);
      if (housingCluster !== workplaceCluster) {
        return false;
      }
    }
  }

  building.assignedWorkers.push(colonistId);
  return true;
}
```

**Step 4: Run tests**

```bash
bun test tests/TransitWorkerAssignment.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/TransitWorkerAssignment.test.ts
git commit -m "feat(buildings): validate cluster connectivity on worker assignment"
```

---

## Task 8: Handle Disconnection - Unassign Workers

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Modify: `tests/TransitWorkerAssignment.test.ts`

**Step 1: Write failing test for disconnection**

Add to `tests/TransitWorkerAssignment.test.ts`:

```typescript
describe("disconnection handling", () => {
  it("unassigns workers when building becomes disconnected", () => {
    // Setup: chain of 3 buildings
    gridManager.placeBuilding("hab-1", { x: 5, y: 5 });
    gridManager.placeBuilding("solar-1", { x: 5, y: 6 });
    gridManager.placeBuilding("farm-1", { x: 5, y: 7 });

    buildingManager.createBuilding(BuildingId.HABITAT, "hab-1");
    buildingManager.createBuilding(BuildingId.SOLAR_PANEL, "solar-1");
    buildingManager.createBuilding(BuildingId.BASIC_FARM, "farm-1");
    buildingManager.completeConstruction("hab-1");
    buildingManager.completeConstruction("solar-1");
    buildingManager.completeConstruction("farm-1");

    setupColonist("colonist-1", "hab-1");
    buildingManager.assignWorker("farm-1", "colonist-1");

    // Verify assigned
    const farmBefore = buildingManager.getBuilding("farm-1");
    expect(farmBefore?.assignedWorkers).toContain("colonist-1");

    // Remove middle building, breaking the chain
    gridManager.removeBuilding({ x: 5, y: 6 });
    buildingManager.removeBuilding("solar-1");

    // Worker should be unassigned
    const farmAfter = buildingManager.getBuilding("farm-1");
    expect(farmAfter?.assignedWorkers).not.toContain("colonist-1");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/TransitWorkerAssignment.test.ts
```

Expected: FAIL

**Step 3: Implement disconnection handling**

Add to `BuildingManager`:

```typescript
handleDisconnectedBuildings(): string[] {
  if (!this.gridManager || !this.colonyManager) return [];

  const unassignedWorkers: string[] = [];

  for (const [buildingId, building] of this.buildings) {
    if (building.assignedWorkers.length === 0) continue;

    const workplaceCluster = this.gridManager.getBuildingClusterId(buildingId);

    // Check each worker's housing cluster
    const workersToRemove: string[] = [];
    for (const colonistId of building.assignedWorkers) {
      const colonist = this.colonyManager.getColonist(colonistId);
      if (!colonist?.housingId) continue;

      const housingCluster = this.gridManager.getBuildingClusterId(colonist.housingId);
      if (housingCluster !== workplaceCluster) {
        workersToRemove.push(colonistId);
      }
    }

    for (const colonistId of workersToRemove) {
      this.removeWorker(buildingId, colonistId);
      unassignedWorkers.push(colonistId);
    }
  }

  return unassignedWorkers;
}
```

Update `triggerClusterUpdate`:

```typescript
triggerClusterUpdate(): string[] {
  if (!this.gridManager) return [];
  this.gridManager.updateClusters(
    this.getBuildingDefinitions(),
    this.getDepotRanges()
  );
  return this.handleDisconnectedBuildings();
}
```

**Step 4: Run tests**

```bash
bun test tests/TransitWorkerAssignment.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/TransitWorkerAssignment.test.ts
git commit -m "feat(buildings): unassign workers on transit disconnection"
```

---

## Task 9: Add Disconnection Events

**Files:**
- Modify: `src/core/events/gameEvents.ts`
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Add event type**

In `src/core/events/gameEvents.ts`, add:

```typescript
export interface TransitDisconnectionEvent extends BaseGameEvent {
  type: "transit_disconnection";
  buildingId: string;
  buildingName: string;
  unassignedWorkers: string[];
}
```

Add to the `GameEvent` union type.

**Step 2: Update triggerClusterUpdate to return events**

Modify `handleDisconnectedBuildings` to return events:

```typescript
handleDisconnectedBuildings(): GameEvent[] {
  if (!this.gridManager || !this.colonyManager) return [];

  const events: GameEvent[] = [];

  for (const [buildingId, building] of this.buildings) {
    if (building.assignedWorkers.length === 0) continue;

    const workplaceCluster = this.gridManager.getBuildingClusterId(buildingId);
    const def = buildingDefinitions[building.definitionId];

    const workersToRemove: string[] = [];
    for (const colonistId of building.assignedWorkers) {
      const colonist = this.colonyManager.getColonist(colonistId);
      if (!colonist?.housingId) continue;

      const housingCluster = this.gridManager.getBuildingClusterId(colonist.housingId);
      if (housingCluster !== workplaceCluster) {
        workersToRemove.push(colonistId);
      }
    }

    if (workersToRemove.length > 0) {
      for (const colonistId of workersToRemove) {
        this.removeWorker(buildingId, colonistId);
      }
      events.push({
        type: "transit_disconnection",
        buildingId,
        buildingName: def.name,
        unassignedWorkers: workersToRemove,
      });
    }
  }

  return events;
}
```

**Step 3: Commit**

```bash
git add src/core/events/gameEvents.ts src/core/systems/BuildingManager.ts
git commit -m "feat(events): add transit disconnection event"
```

---

## Task 10: Update GameState to Call Cluster Updates

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Ensure cluster updates happen in tick**

In `GameState.tick()`, after buildings tick, ensure clusters are updated. The `triggerClusterUpdate` should already be called by BuildingManager after building status changes.

Verify that `buildingManager.setGridManager(gridManager)` is called during initialization.

**Step 2: Add initial cluster calculation**

In `GameState` constructor or `initialize()`, after placing initial buildings:

```typescript
this.buildingManager.triggerClusterUpdate();
```

**Step 3: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat(gamestate): integrate cluster updates in game loop"
```

---

## Task 11: Add UI - Cluster Info to Building Stats

**Files:**
- Modify: `src/renderer/services/GameService.ts`
- Modify: `src/renderer/components/BuildingStatsCard.vue`

**Step 1: Expose cluster info in GameUIState**

Add to `GameUIState.buildings` or create a helper:

```typescript
getBuildingClusterId(buildingId: string): string | undefined {
  return this.core.gridManager.getBuildingClusterId(buildingId);
}

isConnectedToHabitat(buildingId: string): boolean {
  return this.core.gridManager.getBuildingClusterId(buildingId) !== undefined;
}
```

**Step 2: Update BuildingStatsCard to show connectivity**

Add connectivity indicator to the building card. Show warning if disconnected:

```vue
<div v-if="!isConnected" class="connectivity-warning">
  <AlertTriangle :size="16" />
  <span>Not connected to habitat</span>
</div>
```

**Step 3: Commit**

```bash
git add src/renderer/services/GameService.ts src/renderer/components/BuildingStatsCard.vue
git commit -m "feat(ui): show connectivity status in building stats card"
```

---

## Task 12: Add UI - Connection Visualization on Hover

**Files:**
- Modify: `src/renderer/components/BaseGrid/renderBaseGrid.ts`

**Step 1: Add connection path rendering**

When a building is selected/hovered, trace and render the path back to its cluster root:

```typescript
function renderClusterConnection(
  connectionLayer: Selection,
  buildingId: string,
  gridManager: GridManager,
  buildingPositions: Map<string, ScreenPosition>
) {
  // Get cluster and trace path (implementation details)
  // Draw lines between connected buildings
}
```

**Step 2: Style the connection lines**

Add CSS for transit connection visualization - different from power lines.

**Step 3: Commit**

```bash
git add src/renderer/components/BaseGrid/renderBaseGrid.ts
git commit -m "feat(ui): render cluster connections on building hover"
```

---

## Task 13: Filter Worker Assignment by Cluster in UI

**Files:**
- Modify: `src/facade/domains/BuildingsFacade.ts`
- Modify: `src/renderer/components/ColonistAssignmentCard.vue` (or equivalent)

**Step 1: Add filtered worker candidates method**

In `BuildingsFacade`:

```typescript
getAssignableWorkersForBuilding(buildingId: string): Colonist[] {
  const workplaceCluster = this.gridManager.getBuildingClusterId(buildingId);
  return this.colonyManager.getUnassignedWorkers().filter((colonist) => {
    if (!colonist.housingId) return false;
    const housingCluster = this.gridManager.getBuildingClusterId(colonist.housingId);
    return housingCluster === workplaceCluster;
  });
}
```

**Step 2: Update UI to use filtered list**

The assignment UI should call this method instead of showing all unassigned colonists.

**Step 3: Commit**

```bash
git add src/facade/domains/BuildingsFacade.ts
git commit -m "feat(ui): filter worker assignment candidates by cluster"
```

---

## Task 14: Run Full Test Suite and Fix Issues

**Step 1: Run all tests**

```bash
bun test
```

**Step 2: Fix any failing tests**

Existing tests may fail if they don't set up proper adjacency. Update test fixtures to place buildings adjacent to habitats.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(tests): update test fixtures for transit connectivity"
```

---

## Task 15: Update Player Manual

**Files:**
- Modify: `MANUAL.md`

**Step 1: Add Transit Connections section**

Document the new mechanic for players:
- Building connectivity basics
- How clusters work
- Rover Depot usage
- What happens on disconnection

**Step 2: Commit**

```bash
git add MANUAL.md
git commit -m "docs: add transit connections to player manual"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Add cluster types | Simple |
| 2 | Add balance constants | Simple |
| 3 | Add Rover Depot building | Simple |
| 4 | Core cluster logic | Complex |
| 5 | Depot range tests | Simple |
| 6 | Integrate into BuildingManager | Medium |
| 7 | Validate on assignment | Medium |
| 8 | Handle disconnection | Medium |
| 9 | Add disconnection events | Simple |
| 10 | GameState integration | Simple |
| 11 | UI cluster info | Medium |
| 12 | UI connection visualization | Complex |
| 13 | UI filter assignments | Medium |
| 14 | Fix test suite | Variable |
| 15 | Update manual | Simple |

**Parallelizable tasks:**
- Tasks 1, 2, 3 can run in parallel (no dependencies)
- Tasks 11, 12, 13 can run in parallel after Task 10
