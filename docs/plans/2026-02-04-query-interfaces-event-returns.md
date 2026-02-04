# Query Interfaces and Consistent Event Returns

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Two related improvements to reduce coupling and improve consistency:

1. **Read-only query interfaces** - Replace concrete manager references in BuildingManager with slim query interfaces
2. **Consistent event returns** - State-mutating methods return `GameEvent[]` instead of `void`/`boolean`

## Query Interfaces

### Problem

BuildingManager holds 6 manager references for simple queries:

```typescript
class BuildingManager {
  private colonyManager: ColonyManager | null = null;
  private workforceManager: WorkforceManager | null = null;
  private ideologyManager: IdeologyManager | null = null;
  private victoryManager: VictoryManager | null = null;
  private gridManager: GridManager | null = null;
}
```

### Solution

Create query interfaces in `src/core/interfaces/Queries.ts`:

```typescript
export interface ColonistQueries {
  getColonist(id: string): Colonist | undefined;
  getColonists(): Colonist[];
}

export interface WorkforceQueries {
  getTeamCohesionMultiplier(workerIds: string[]): number;
}

export interface ProjectQueries {
  isProjectCompleted(projectId: ProjectId): boolean;
}

export interface GridQueries {
  getPlacement(buildingId: string): GridPlacement | undefined;
  getBuildingClusterId(buildingId: string): string | undefined;
}
```

### Manager Changes

Managers implement the interfaces:

```typescript
export class ColonyManager implements ColonistQueries { ... }
export class IdeologyManager implements ProjectQueries { ... }
export class WorkforceManager implements WorkforceQueries { ... }
export class GridManager implements GridQueries { ... }
```

### BuildingManager Changes

```typescript
class BuildingManager {
  // Query interfaces (read-only)
  private colonistQueries: ColonistQueries | null = null;
  private workforceQueries: WorkforceQueries | null = null;
  private projectQueries: ProjectQueries | null = null;
  private gridQueries: GridQueries | null = null;

  // Keep full refs only where mutations needed
  private victoryManager: VictoryManager | null = null;  // checkBuildingVictory returns events
  private gridManager: GridManager | null = null;        // updateClusters mutates
}
```

## Consistent Event Returns

### Problem

Many state-mutating methods return `void` or `boolean`:

```typescript
assignWorker(buildingId: string, colonistId: string): boolean
breakBuilding(buildingId: string, resources: ResourceManager): boolean
completeProject(projectId: ProjectId): void
```

This makes it impossible for callers to know what events occurred.

### Solution

State-mutating methods return `GameEvent[]`:

```typescript
assignWorker(buildingId: string, colonistId: string): GameEvent[]
// Returns [] if failed, [WORKER_ASSIGNED] if succeeded
```

### Methods to Update

| Method | Current Return | New Return | Event Type |
|--------|----------------|------------|------------|
| `BuildingManager.assignWorker()` | `boolean` | `GameEvent[]` | `WORKER_ASSIGNED` |
| `BuildingManager.removeWorker()` | `boolean` | `GameEvent[]` | `WORKER_UNASSIGNED` |
| `BuildingManager.breakBuilding()` | `boolean` | `GameEvent[]` | `BUILDING_BROKEN` |
| `BuildingManager.startRepair()` | `boolean` | `GameEvent[]` | `BUILDING_REPAIR_STARTED` (new) |
| `BuildingManager.startRecycling()` | `boolean` | `GameEvent[]` | `BUILDING_RECYCLING_STARTED` (new) |
| `ColonyManager.removeColonist()` | `boolean` | `GameEvent[]` | `COLONIST_DIED` |
| `TechnologyTree.startResearch()` | `boolean` | `GameEvent[]` | `RESEARCH_STARTED` |
| `TechnologyTree.completeResearch()` | `boolean` | `GameEvent[]` | `TECH_RESEARCHED` |
| `IdeologyManager.completeProject()` | `void` | `GameEvent[]` | `PROJECT_COMPLETED` |

### Caller Updates

Callers checking `=== true` must change to check `events.length > 0`:

```typescript
// Before
if (buildings.assignWorker(buildingId, colonistId)) { ... }

// After
const events = buildings.assignWorker(buildingId, colonistId);
if (events.length > 0) { ... }
```

## Implementation Order

1. **Create `src/core/interfaces/Queries.ts`** - Define all query interfaces
2. **Add `implements` to managers** - ColonyManager, WorkforceManager, IdeologyManager, GridManager
3. **Update BuildingManager fields** - Change types from concrete to interface
4. **Update GameState wiring** - Pass interfaces in setter methods
5. **Update BuildingManager methods** - Return `GameEvent[]` from mutating methods
6. **Update ColonyManager.removeColonist()** - Return `GameEvent[]`
7. **Update TechnologyTree methods** - Return `GameEvent[]`
8. **Update IdeologyManager.completeProject()** - Return `GameEvent[]`
9. **Update all callers** - Change boolean checks to event array checks

## Files to Modify

| File | Changes |
|------|---------|
| `src/core/interfaces/Queries.ts` | **New file** - Query interface definitions |
| `src/core/systems/ColonyManager.ts` | Implement `ColonistQueries`, update `removeColonist()` |
| `src/core/systems/WorkforceManager.ts` | Implement `WorkforceQueries` |
| `src/core/systems/IdeologyManager.ts` | Implement `ProjectQueries`, update `completeProject()` |
| `src/core/systems/GridManager.ts` | Implement `GridQueries` |
| `src/core/systems/BuildingManager.ts` | Use query interfaces, update method returns |
| `src/core/systems/TechnologyTree.ts` | Update `startResearch()`, `completeResearch()` |
| `src/core/GameState.ts` | Update wiring to pass interfaces |
| `src/facade/domains/*.ts` | Update callers of changed methods |
| `src/core/tick/phases/*.ts` | Update callers of changed methods |

## Test Coverage

- Query interfaces work correctly (managers implement them)
- Event returns contain correct event types
- Empty array returned on failure cases
- Callers handle new return type correctly
- Existing tests still pass after refactor
