# Node-Based Building System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a spatial power grid system where buildings are placed on a 10x10 isometric grid and must connect to power sources within range.

**Architecture:** New GridManager handles spatial state and power distribution. BaseTab renders D3 isometric grid. Buildings auto-connect to power sources by distance; disconnected buildings use battery backup before shutdown.

**Tech Stack:** TypeScript core logic, Vue 3 + D3 for visualization, following existing manager/component patterns.

---

## Task 1: Grid Data Model

**Files:**
- Create: `src/core/models/Grid.ts`
- Test: `tests/Grid.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/Grid.test.ts
import { describe, expect, test } from "bun:test";
import { GridCell, GridPosition, PowerState, DepositType } from "../src/core/models/Grid";

describe("Grid Model", () => {
  test("GridPosition has x and y coordinates", () => {
    const pos: GridPosition = { x: 5, y: 3 };
    expect(pos.x).toBe(5);
    expect(pos.y).toBe(3);
  });

  test("GridCell can have optional deposit", () => {
    const cellWithDeposit: GridCell = {
      position: { x: 0, y: 0 },
      deposit: DepositType.WATER,
    };
    const cellWithoutDeposit: GridCell = {
      position: { x: 1, y: 1 },
    };
    expect(cellWithDeposit.deposit).toBe(DepositType.WATER);
    expect(cellWithoutDeposit.deposit).toBeUndefined();
  });

  test("PowerState enum has correct values", () => {
    expect(PowerState.POWERED).toBe("powered");
    expect(PowerState.ON_BATTERY).toBe("on_battery");
    expect(PowerState.LOW_BATTERY).toBe("low_battery");
    expect(PowerState.UNPOWERED).toBe("unpowered");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/Grid.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/core/models/Grid.ts
export interface GridPosition {
  x: number;
  y: number;
}

export enum DepositType {
  WATER = "water",
  MINERAL = "mineral",
}

export enum PowerState {
  POWERED = "powered",
  ON_BATTERY = "on_battery",
  LOW_BATTERY = "low_battery",
  UNPOWERED = "unpowered",
}

export interface GridCell {
  position: GridPosition;
  deposit?: DepositType;
  buildingId?: string;
}

export interface BuildingPlacement {
  buildingId: string;
  position: GridPosition;
  powerSourceId?: string;
  distanceToPower: number;
  batteryLevel: number; // 0-1, where 1 = full (3 sols)
  powerState: PowerState;
}

export const GRID_SIZE = 10;
export const BATTERY_BACKUP_SOLS = 3;
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/Grid.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/Grid.ts tests/Grid.test.ts
git commit -m "feat(grid): add grid data model types"
```

---

## Task 2: Power Range Balance Constants

**Files:**
- Create: `src/core/balance/GridBalance.ts`
- Test: `tests/GridBalance.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/GridBalance.test.ts
import { describe, expect, test } from "bun:test";
import {
  POWER_RANGE_BASE,
  POWER_RANGE_PER_OUTPUT,
  TECH_RANGE_BONUS,
  calculatePowerRange
} from "../src/core/balance/GridBalance";

describe("Grid Balance", () => {
  test("solar panel has range 2", () => {
    const range = calculatePowerRange(10, false); // 10 power output, no tech
    expect(range).toBe(2);
  });

  test("nuclear reactor has range 4", () => {
    const range = calculatePowerRange(50, false); // 50 power output
    expect(range).toBe(4);
  });

  test("improved power grid tech adds 1 range", () => {
    const rangeWithoutTech = calculatePowerRange(10, false);
    const rangeWithTech = calculatePowerRange(10, true);
    expect(rangeWithTech - rangeWithoutTech).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridBalance.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/core/balance/GridBalance.ts

/** Base range for all power sources */
export const POWER_RANGE_BASE = 2;

/** Additional range per 20 power output */
export const POWER_RANGE_PER_OUTPUT = 20;

/** Range bonus from Improved Power Grid technology */
export const TECH_RANGE_BONUS = 1;

/** Battery backup duration in sols */
export const BATTERY_BACKUP_SOLS = 3;

/** Low battery threshold (below this shows warning) */
export const LOW_BATTERY_THRESHOLD = 0.33;

/**
 * Calculate power range for a power source.
 * Range = base + floor(output/20) + tech bonus
 */
export function calculatePowerRange(powerOutput: number, hasTechBonus: boolean): number {
  const outputBonus = Math.floor(powerOutput / POWER_RANGE_PER_OUTPUT);
  const techBonus = hasTechBonus ? TECH_RANGE_BONUS : 0;
  return POWER_RANGE_BASE + outputBonus + techBonus;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridBalance.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/balance/GridBalance.ts tests/GridBalance.test.ts
git commit -m "feat(grid): add power range balance constants"
```

---

## Task 3: GridManager - Basic Grid State

**Files:**
- Create: `src/core/systems/GridManager.ts`
- Test: `tests/GridManager.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/GridManager.test.ts
import { describe, expect, test } from "bun:test";
import { GridManager } from "../src/core/systems/GridManager";
import { DepositType, GRID_SIZE } from "../src/core/models/Grid";

describe("GridManager", () => {
  test("initializes 10x10 grid", () => {
    const manager = new GridManager();
    expect(manager.getGridSize()).toBe(10);
  });

  test("all cells start empty", () => {
    const manager = new GridManager();
    const cell = manager.getCell(5, 5);
    expect(cell).not.toBeNull();
    expect(cell?.buildingId).toBeUndefined();
  });

  test("getCell returns null for out-of-bounds", () => {
    const manager = new GridManager();
    expect(manager.getCell(-1, 0)).toBeNull();
    expect(manager.getCell(10, 0)).toBeNull();
    expect(manager.getCell(0, 10)).toBeNull();
  });

  test("generateDeposits creates water and mineral deposits", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345); // seed for reproducibility

    const deposits = manager.getAllDeposits();
    const waterDeposits = deposits.filter(d => d.type === DepositType.WATER);
    const mineralDeposits = deposits.filter(d => d.type === DepositType.MINERAL);

    expect(waterDeposits.length).toBeGreaterThanOrEqual(2);
    expect(waterDeposits.length).toBeLessThanOrEqual(3);
    expect(mineralDeposits.length).toBeGreaterThanOrEqual(2);
    expect(mineralDeposits.length).toBeLessThanOrEqual(3);
  });

  test("deposits avoid center 4x4 area", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);

    const deposits = manager.getAllDeposits();
    for (const deposit of deposits) {
      const isInCenter = deposit.position.x >= 3 && deposit.position.x <= 6 &&
                         deposit.position.y >= 3 && deposit.position.y <= 6;
      expect(isInCenter).toBe(false);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridManager.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/core/systems/GridManager.ts
import {
  GridCell,
  GridPosition,
  DepositType,
  GRID_SIZE,
  BuildingPlacement,
  PowerState,
} from "../models/Grid";

interface DepositInfo {
  position: GridPosition;
  type: DepositType;
}

export class GridManager {
  private grid: GridCell[][] = [];
  private placements: Map<string, BuildingPlacement> = new Map();

  constructor() {
    this.initializeGrid();
  }

  private initializeGrid(): void {
    this.grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        row.push({ position: { x, y } });
      }
      this.grid.push(row);
    }
  }

  getGridSize(): number {
    return GRID_SIZE;
  }

  getCell(x: number, y: number): GridCell | null {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      return null;
    }
    return this.grid[y][x];
  }

  generateDeposits(seed: number): void {
    // Simple seeded random
    const random = this.seededRandom(seed);

    // Generate 2-3 water deposits
    const waterCount = 2 + Math.floor(random() * 2);
    this.placeDeposits(DepositType.WATER, waterCount, random);

    // Generate 2-3 mineral deposits
    const mineralCount = 2 + Math.floor(random() * 2);
    this.placeDeposits(DepositType.MINERAL, mineralCount, random);
  }

  private placeDeposits(type: DepositType, count: number, random: () => number): void {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(random() * GRID_SIZE);
      const y = Math.floor(random() * GRID_SIZE);

      // Skip center 4x4 area (cells 3-6)
      if (x >= 3 && x <= 6 && y >= 3 && y <= 6) continue;

      const cell = this.grid[y][x];
      if (cell.deposit) continue; // Already has deposit

      cell.deposit = type;
      placed++;
    }
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  getAllDeposits(): DepositInfo[] {
    const deposits: DepositInfo[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.grid[y][x];
        if (cell.deposit) {
          deposits.push({ position: { x, y }, type: cell.deposit });
        }
      }
    }
    return deposits;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridManager.test.ts
git commit -m "feat(grid): add GridManager with basic grid state and deposits"
```

---

## Task 4: GridManager - Building Placement

**Files:**
- Modify: `src/core/systems/GridManager.ts`
- Modify: `tests/GridManager.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to tests/GridManager.test.ts
describe("GridManager - Building Placement", () => {
  test("placeBuilding adds building to cell", () => {
    const manager = new GridManager();
    const result = manager.placeBuilding("building-1", { x: 5, y: 5 });

    expect(result.success).toBe(true);
    const cell = manager.getCell(5, 5);
    expect(cell?.buildingId).toBe("building-1");
  });

  test("placeBuilding fails on occupied cell", () => {
    const manager = new GridManager();
    manager.placeBuilding("building-1", { x: 5, y: 5 });
    const result = manager.placeBuilding("building-2", { x: 5, y: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Cell is occupied");
  });

  test("placeBuilding fails on out-of-bounds", () => {
    const manager = new GridManager();
    const result = manager.placeBuilding("building-1", { x: 15, y: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Position out of bounds");
  });

  test("removeBuilding clears cell", () => {
    const manager = new GridManager();
    manager.placeBuilding("building-1", { x: 5, y: 5 });
    manager.removeBuilding({ x: 5, y: 5 });

    const cell = manager.getCell(5, 5);
    expect(cell?.buildingId).toBeUndefined();
  });

  test("getBuildingPosition returns position for placed building", () => {
    const manager = new GridManager();
    manager.placeBuilding("building-1", { x: 3, y: 7 });

    const pos = manager.getBuildingPosition("building-1");
    expect(pos).toEqual({ x: 3, y: 7 });
  });

  test("getBuildingPosition returns null for unknown building", () => {
    const manager = new GridManager();
    const pos = manager.getBuildingPosition("unknown");
    expect(pos).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridManager.test.ts`
Expected: FAIL - methods not found

**Step 3: Write minimal implementation**

Add to `src/core/systems/GridManager.ts`:

```typescript
interface PlacementResult {
  success: boolean;
  error?: string;
}

// Add to GridManager class:

placeBuilding(buildingId: string, position: GridPosition): PlacementResult {
  const cell = this.getCell(position.x, position.y);

  if (!cell) {
    return { success: false, error: "Position out of bounds" };
  }

  if (cell.buildingId) {
    return { success: false, error: "Cell is occupied" };
  }

  cell.buildingId = buildingId;

  // Create placement record
  this.placements.set(buildingId, {
    buildingId,
    position: { ...position },
    distanceToPower: Infinity,
    batteryLevel: 1.0, // Start with full battery
    powerState: PowerState.UNPOWERED,
  });

  return { success: true };
}

removeBuilding(position: GridPosition): void {
  const cell = this.getCell(position.x, position.y);
  if (cell?.buildingId) {
    this.placements.delete(cell.buildingId);
    cell.buildingId = undefined;
  }
}

getBuildingPosition(buildingId: string): GridPosition | null {
  const placement = this.placements.get(buildingId);
  return placement ? { ...placement.position } : null;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridManager.test.ts
git commit -m "feat(grid): add building placement to GridManager"
```

---

## Task 5: GridManager - Power Connection Logic

**Files:**
- Modify: `src/core/systems/GridManager.ts`
- Modify: `tests/GridManager.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to tests/GridManager.test.ts
import { PowerState } from "../src/core/models/Grid";
import { calculatePowerRange } from "../src/core/balance/GridBalance";

describe("GridManager - Power Connections", () => {
  test("registerPowerSource tracks power buildings", () => {
    const manager = new GridManager();
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10); // 10 power output

    const sources = manager.getPowerSources();
    expect(sources.length).toBe(1);
    expect(sources[0].buildingId).toBe("solar-1");
  });

  test("calculateDistance returns Manhattan distance", () => {
    const manager = new GridManager();
    const distance = manager.calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(distance).toBe(7); // |3-0| + |4-0| = 7
  });

  test("building within range connects to power", () => {
    const manager = new GridManager();

    // Place solar panel at center
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10); // range = 2

    // Place habitat within range (distance 2)
    manager.placeBuilding("habitat-1", { x: 5, y: 7 });

    manager.updatePowerConnections(false); // no tech bonus

    const state = manager.getPowerState("habitat-1");
    expect(state).toBe(PowerState.POWERED);
  });

  test("building outside range is unpowered", () => {
    const manager = new GridManager();

    // Place solar panel at center
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10); // range = 2

    // Place habitat outside range (distance 5)
    manager.placeBuilding("habitat-1", { x: 0, y: 5 });

    manager.updatePowerConnections(false);

    const state = manager.getPowerState("habitat-1");
    expect(state).toBe(PowerState.ON_BATTERY); // Starts on battery
  });

  test("closer buildings get priority when capacity exceeded", () => {
    const manager = new GridManager();

    // Solar panel with 10 power (enough for ~2 buildings at 4 power each)
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);

    // Three habitats at different distances, each consuming 4 power
    manager.placeBuilding("habitat-close", { x: 5, y: 6 }); // distance 1
    manager.placeBuilding("habitat-mid", { x: 5, y: 7 }); // distance 2
    manager.placeBuilding("habitat-far", { x: 4, y: 7 }); // distance 3

    manager.setBuildingPowerConsumption("habitat-close", 4);
    manager.setBuildingPowerConsumption("habitat-mid", 4);
    manager.setBuildingPowerConsumption("habitat-far", 4);

    manager.updatePowerConnections(false);

    // Close and mid should be powered (8 power), far should not (would need 12)
    expect(manager.getPowerState("habitat-close")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("habitat-mid")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("habitat-far")).toBe(PowerState.ON_BATTERY);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridManager.test.ts`
Expected: FAIL - methods not found

**Step 3: Write minimal implementation**

Add to `src/core/systems/GridManager.ts`:

```typescript
import { calculatePowerRange } from "../balance/GridBalance";

interface PowerSource {
  buildingId: string;
  output: number;
}

// Add to GridManager class properties:
private powerSources: Map<string, PowerSource> = new Map();
private buildingPowerConsumption: Map<string, number> = new Map();

// Add methods:
registerPowerSource(buildingId: string, output: number): void {
  this.powerSources.set(buildingId, { buildingId, output });
}

unregisterPowerSource(buildingId: string): void {
  this.powerSources.delete(buildingId);
}

getPowerSources(): PowerSource[] {
  return Array.from(this.powerSources.values());
}

setBuildingPowerConsumption(buildingId: string, consumption: number): void {
  this.buildingPowerConsumption.set(buildingId, consumption);
}

calculateDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

updatePowerConnections(hasTechBonus: boolean): void {
  // Reset all placements to calculate fresh
  for (const placement of this.placements.values()) {
    placement.powerSourceId = undefined;
    placement.distanceToPower = Infinity;
  }

  // For each power source, find buildings in range
  const powerSourceList = Array.from(this.powerSources.values());

  // Build list of buildings that need power (not power sources themselves)
  const buildingsNeedingPower: { placement: BuildingPlacement; consumption: number }[] = [];

  for (const placement of this.placements.values()) {
    if (this.powerSources.has(placement.buildingId)) {
      // Power sources are always powered
      placement.powerState = PowerState.POWERED;
      placement.distanceToPower = 0;
      continue;
    }

    const consumption = this.buildingPowerConsumption.get(placement.buildingId) ?? 0;
    buildingsNeedingPower.push({ placement, consumption });
  }

  // For each power source, allocate power by distance
  for (const source of powerSourceList) {
    const sourcePosition = this.getBuildingPosition(source.buildingId);
    if (!sourcePosition) continue;

    const range = calculatePowerRange(source.output, hasTechBonus);
    let availablePower = source.output;

    // Find all buildings in range and sort by distance
    const inRange = buildingsNeedingPower
      .map(b => ({
        ...b,
        distance: this.calculateDistance(sourcePosition, b.placement.position),
      }))
      .filter(b => b.distance <= range)
      .sort((a, b) => a.distance - b.distance);

    // Allocate power by distance priority
    for (const building of inRange) {
      if (building.placement.powerSourceId) continue; // Already connected

      if (availablePower >= building.consumption) {
        building.placement.powerSourceId = source.buildingId;
        building.placement.distanceToPower = building.distance;
        building.placement.powerState = PowerState.POWERED;
        building.placement.batteryLevel = 1.0; // Recharge battery
        availablePower -= building.consumption;
      }
    }
  }

  // Buildings not connected start draining battery
  for (const { placement } of buildingsNeedingPower) {
    if (!placement.powerSourceId && placement.powerState !== PowerState.UNPOWERED) {
      // Will be on battery - actual drain happens in tick()
      if (placement.batteryLevel > 0) {
        placement.powerState = PowerState.ON_BATTERY;
      }
    }
  }
}

getPowerState(buildingId: string): PowerState {
  const placement = this.placements.get(buildingId);
  return placement?.powerState ?? PowerState.UNPOWERED;
}

getPlacement(buildingId: string): BuildingPlacement | undefined {
  return this.placements.get(buildingId);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridManager.test.ts
git commit -m "feat(grid): add power connection logic to GridManager"
```

---

## Task 6: GridManager - Battery Drain Tick

**Files:**
- Modify: `src/core/systems/GridManager.ts`
- Modify: `tests/GridManager.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to tests/GridManager.test.ts
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../src/core/balance/GridBalance";

describe("GridManager - Battery System", () => {
  test("tick drains battery for unpowered buildings", () => {
    const manager = new GridManager();

    // Place building with no power source
    manager.placeBuilding("habitat-1", { x: 0, y: 0 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections(false);

    const initialBattery = manager.getPlacement("habitat-1")?.batteryLevel ?? 0;
    expect(initialBattery).toBe(1.0);

    // Tick once (1 sol)
    manager.tick();

    const afterOneSol = manager.getPlacement("habitat-1")?.batteryLevel ?? 0;
    expect(afterOneSol).toBeCloseTo(1 - (1 / BATTERY_BACKUP_SOLS), 2);
  });

  test("battery transitions to low_battery state", () => {
    const manager = new GridManager();

    manager.placeBuilding("habitat-1", { x: 0, y: 0 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections(false);

    // Drain to low battery (tick enough times)
    const ticksToLowBattery = Math.ceil(BATTERY_BACKUP_SOLS * (1 - LOW_BATTERY_THRESHOLD));
    for (let i = 0; i < ticksToLowBattery; i++) {
      manager.tick();
    }

    expect(manager.getPowerState("habitat-1")).toBe(PowerState.LOW_BATTERY);
  });

  test("battery fully drained becomes unpowered", () => {
    const manager = new GridManager();

    manager.placeBuilding("habitat-1", { x: 0, y: 0 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections(false);

    // Drain completely (tick BATTERY_BACKUP_SOLS + 1 times)
    for (let i = 0; i <= BATTERY_BACKUP_SOLS; i++) {
      manager.tick();
    }

    expect(manager.getPowerState("habitat-1")).toBe(PowerState.UNPOWERED);
  });

  test("reconnecting to power recharges battery", () => {
    const manager = new GridManager();

    // Start without power
    manager.placeBuilding("habitat-1", { x: 5, y: 5 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections(false);

    // Drain some battery
    manager.tick();
    manager.tick();

    const drainedBattery = manager.getPlacement("habitat-1")?.batteryLevel ?? 0;
    expect(drainedBattery).toBeLessThan(1.0);

    // Add power source and reconnect
    manager.placeBuilding("solar-1", { x: 5, y: 6 });
    manager.registerPowerSource("solar-1", 10);
    manager.updatePowerConnections(false);

    // Battery should be recharged
    expect(manager.getPlacement("habitat-1")?.batteryLevel).toBe(1.0);
    expect(manager.getPowerState("habitat-1")).toBe(PowerState.POWERED);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridManager.test.ts`
Expected: FAIL - tick method not found

**Step 3: Write minimal implementation**

Add to `src/core/systems/GridManager.ts`:

```typescript
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../balance/GridBalance";

// Add to GridManager class:
tick(): void {
  const drainPerSol = 1 / BATTERY_BACKUP_SOLS;

  for (const placement of this.placements.values()) {
    // Skip power sources
    if (this.powerSources.has(placement.buildingId)) continue;

    // Skip powered buildings
    if (placement.powerSourceId) continue;

    // Drain battery
    placement.batteryLevel = Math.max(0, placement.batteryLevel - drainPerSol);

    // Update power state based on battery
    if (placement.batteryLevel <= 0) {
      placement.powerState = PowerState.UNPOWERED;
    } else if (placement.batteryLevel <= LOW_BATTERY_THRESHOLD) {
      placement.powerState = PowerState.LOW_BATTERY;
    } else {
      placement.powerState = PowerState.ON_BATTERY;
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridManager.test.ts
git commit -m "feat(grid): add battery drain tick to GridManager"
```

---

## Task 7: GridManager - Serialization

**Files:**
- Modify: `src/core/systems/GridManager.ts`
- Modify: `tests/GridManager.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to tests/GridManager.test.ts
describe("GridManager - Serialization", () => {
  test("toJSON captures grid state", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.placeBuilding("habitat-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections(false);

    const json = manager.toJSON();

    expect(json.placements).toHaveLength(2);
    expect(json.powerSources).toHaveLength(1);
    expect(json.deposits.length).toBeGreaterThan(0);
  });

  test("fromJSON restores grid state", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.placeBuilding("habitat-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections(false);

    const json = manager.toJSON();

    const restored = new GridManager();
    restored.fromJSON(json);

    expect(restored.getCell(5, 5)?.buildingId).toBe("solar-1");
    expect(restored.getCell(5, 6)?.buildingId).toBe("habitat-1");
    expect(restored.getPowerSources()).toHaveLength(1);
    expect(restored.getPowerState("habitat-1")).toBe(PowerState.POWERED);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridManager.test.ts`
Expected: FAIL - toJSON/fromJSON not found

**Step 3: Write minimal implementation**

Add to `src/core/systems/GridManager.ts`:

```typescript
interface GridManagerJSON {
  deposits: Array<{ x: number; y: number; type: DepositType }>;
  placements: Array<{
    buildingId: string;
    x: number;
    y: number;
    batteryLevel: number;
    powerState: PowerState;
  }>;
  powerSources: Array<{ buildingId: string; output: number }>;
  powerConsumption: Array<{ buildingId: string; consumption: number }>;
}

// Add to GridManager class:
toJSON(): GridManagerJSON {
  const deposits: GridManagerJSON["deposits"] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = this.grid[y][x];
      if (cell.deposit) {
        deposits.push({ x, y, type: cell.deposit });
      }
    }
  }

  const placements = Array.from(this.placements.values()).map(p => ({
    buildingId: p.buildingId,
    x: p.position.x,
    y: p.position.y,
    batteryLevel: p.batteryLevel,
    powerState: p.powerState,
  }));

  const powerSources = Array.from(this.powerSources.values()).map(s => ({
    buildingId: s.buildingId,
    output: s.output,
  }));

  const powerConsumption = Array.from(this.buildingPowerConsumption.entries()).map(
    ([buildingId, consumption]) => ({ buildingId, consumption })
  );

  return { deposits, placements, powerSources, powerConsumption };
}

fromJSON(json: GridManagerJSON): void {
  // Reset state
  this.initializeGrid();
  this.placements.clear();
  this.powerSources.clear();
  this.buildingPowerConsumption.clear();

  // Restore deposits
  for (const deposit of json.deposits) {
    const cell = this.grid[deposit.y][deposit.x];
    cell.deposit = deposit.type;
  }

  // Restore power sources first
  for (const source of json.powerSources) {
    this.powerSources.set(source.buildingId, source);
  }

  // Restore power consumption
  for (const { buildingId, consumption } of json.powerConsumption) {
    this.buildingPowerConsumption.set(buildingId, consumption);
  }

  // Restore placements
  for (const p of json.placements) {
    const cell = this.grid[p.y][p.x];
    cell.buildingId = p.buildingId;

    this.placements.set(p.buildingId, {
      buildingId: p.buildingId,
      position: { x: p.x, y: p.y },
      distanceToPower: Infinity,
      batteryLevel: p.batteryLevel,
      powerState: p.powerState,
    });
  }

  // Recalculate power connections
  this.updatePowerConnections(false); // TODO: pass tech bonus from GameState
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridManager.test.ts
git commit -m "feat(grid): add serialization to GridManager"
```

---

## Task 8: GridManager - Placement Hints

**Files:**
- Modify: `src/core/systems/GridManager.ts`
- Modify: `tests/GridManager.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to tests/GridManager.test.ts
describe("GridManager - Placement Hints", () => {
  test("getPlacementHints shows power availability", () => {
    const manager = new GridManager();

    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.updatePowerConnections(false);

    // Cell in power range
    const hintsInRange = manager.getPlacementHints({ x: 5, y: 6 }, false);
    expect(hintsInRange.hasPower).toBe(true);
    expect(hintsInRange.powerCapacityAvailable).toBe(10);

    // Cell outside power range
    const hintsOutOfRange = manager.getPlacementHints({ x: 0, y: 0 }, false);
    expect(hintsOutOfRange.hasPower).toBe(false);
  });

  test("getPlacementHints shows deposit info", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);

    const deposits = manager.getAllDeposits();
    const waterDeposit = deposits.find(d => d.type === DepositType.WATER);

    if (waterDeposit) {
      const hints = manager.getPlacementHints(waterDeposit.position, false);
      expect(hints.deposit).toBe(DepositType.WATER);
    }
  });

  test("getPlacementHints shows cell is occupied", () => {
    const manager = new GridManager();
    manager.placeBuilding("solar-1", { x: 5, y: 5 });

    const hints = manager.getPlacementHints({ x: 5, y: 5 }, false);
    expect(hints.isOccupied).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GridManager.test.ts`
Expected: FAIL - getPlacementHints not found

**Step 3: Write minimal implementation**

Add to `src/core/systems/GridManager.ts`:

```typescript
export interface PlacementHints {
  position: GridPosition;
  isOccupied: boolean;
  deposit?: DepositType;
  hasPower: boolean;
  powerCapacityAvailable: number;
  distanceToNearestPower: number;
}

// Add to GridManager class:
getPlacementHints(position: GridPosition, hasTechBonus: boolean): PlacementHints {
  const cell = this.getCell(position.x, position.y);

  const hints: PlacementHints = {
    position,
    isOccupied: !!cell?.buildingId,
    deposit: cell?.deposit,
    hasPower: false,
    powerCapacityAvailable: 0,
    distanceToNearestPower: Infinity,
  };

  // Check power availability from all sources
  for (const source of this.powerSources.values()) {
    const sourcePos = this.getBuildingPosition(source.buildingId);
    if (!sourcePos) continue;

    const distance = this.calculateDistance(position, sourcePos);
    const range = calculatePowerRange(source.output, hasTechBonus);

    if (distance <= range) {
      hints.hasPower = true;
      // Calculate remaining capacity (simplified - full capacity for now)
      hints.powerCapacityAvailable = Math.max(
        hints.powerCapacityAvailable,
        source.output
      );
    }

    hints.distanceToNearestPower = Math.min(hints.distanceToNearestPower, distance);
  }

  return hints;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GridManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GridManager.ts tests/GridManager.test.ts
git commit -m "feat(grid): add placement hints to GridManager"
```

---

## Task 9: Integrate GridManager into GameState

**Files:**
- Modify: `src/core/GameState.ts`
- Test: `tests/GameState.test.ts` (add integration tests)

**Step 1: Write the failing test**

```typescript
// Add to tests/GameState.test.ts or create new file
import { describe, expect, test } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("GameState - Grid Integration", () => {
  test("GameState has grid manager", () => {
    const state = new GameState();
    expect(state.grid).toBeDefined();
  });

  test("GameState initializes grid with deposits", () => {
    const state = new GameState();
    const deposits = state.grid.getAllDeposits();
    expect(deposits.length).toBeGreaterThan(0);
  });

  test("starting buildings are placed on grid", () => {
    const state = new GameState();

    // Should have at least solar panel placed
    const solarBuildings = state.buildings.getActiveBuildings()
      .filter(b => b.definitionId === "solar_panel");

    if (solarBuildings.length > 0) {
      const pos = state.grid.getBuildingPosition(solarBuildings[0].id);
      expect(pos).not.toBeNull();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GameState.test.ts`
Expected: FAIL - grid property not found

**Step 3: Write minimal implementation**

Modify `src/core/GameState.ts`:

```typescript
// Add import at top:
import { GridManager } from "./systems/GridManager";
import { BuildingId } from "./models/Building";

// Add to class properties (after other managers):
grid: GridManager;

// In constructor, after other manager initialization:
this.grid = new GridManager();
this.grid.generateDeposits(Date.now()); // Use timestamp as seed for variety

// After createPreBuiltBuildings call, add:
this.placeStartingBuildingsOnGrid();

// Add new method:
private placeStartingBuildingsOnGrid(): void {
  const activeBuildings = this.buildings.getActiveBuildings();

  // Place solar panel at center (5,5)
  const solarPanel = activeBuildings.find(b => b.definitionId === BuildingId.SOLAR_PANEL);
  if (solarPanel) {
    this.grid.placeBuilding(solarPanel.id, { x: 5, y: 5 });
    const def = this.buildings.getDefinition(solarPanel.definitionId);
    if (def?.powerProduction) {
      this.grid.registerPowerSource(solarPanel.id, def.powerProduction);
    }
  }

  // Place habitat adjacent (5,6)
  const habitat = activeBuildings.find(b => b.definitionId === BuildingId.HABITAT);
  if (habitat) {
    this.grid.placeBuilding(habitat.id, { x: 5, y: 6 });
    const def = this.buildings.getDefinition(habitat.definitionId);
    if (def?.powerConsumption) {
      this.grid.setBuildingPowerConsumption(habitat.id, def.powerConsumption);
    }
  }

  // Place farm (4,5)
  const farm = activeBuildings.find(b => b.definitionId === BuildingId.BASIC_FARM);
  if (farm) {
    this.grid.placeBuilding(farm.id, { x: 4, y: 5 });
    const def = this.buildings.getDefinition(farm.definitionId);
    if (def?.powerConsumption) {
      this.grid.setBuildingPowerConsumption(farm.id, def.powerConsumption);
    }
  }

  // Place water extractor on nearest water deposit
  const waterExtractor = activeBuildings.find(b => b.definitionId === BuildingId.WATER_EXTRACTOR);
  if (waterExtractor) {
    const deposits = this.grid.getAllDeposits();
    const waterDeposit = deposits.find(d => d.type === "water");
    if (waterDeposit) {
      this.grid.placeBuilding(waterExtractor.id, waterDeposit.position);
      const def = this.buildings.getDefinition(waterExtractor.definitionId);
      if (def?.powerConsumption) {
        this.grid.setBuildingPowerConsumption(waterExtractor.id, def.powerConsumption);
      }
    }
  }

  // Update power connections
  this.grid.updatePowerConnections(false);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GameState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/GameState.ts tests/GameState.test.ts
git commit -m "feat(grid): integrate GridManager into GameState"
```

---

## Task 10: Add Grid Tick to Game Loop

**Files:**
- Modify: `src/core/tick/phases.ts` or wherever tick phases are defined
- Add grid tick phase

**Step 1: Locate tick phases file**

Read `src/core/tick/phases.ts` to understand the tick system.

**Step 2: Add grid phase**

Add a grid tick phase that:
1. Updates power connections
2. Drains batteries for unpowered buildings
3. Marks buildings as non-operational when unpowered

**Step 3: Test that tick updates grid**

```typescript
test("game tick updates grid power state", () => {
  const state = new GameState();

  // Place building outside power range
  state.grid.placeBuilding("test-building", { x: 0, y: 0 });
  state.grid.setBuildingPowerConsumption("test-building", 4);
  state.grid.updatePowerConnections(false);

  const initialBattery = state.grid.getPlacement("test-building")?.batteryLevel;

  state.tick();

  const afterBattery = state.grid.getPlacement("test-building")?.batteryLevel;
  expect(afterBattery).toBeLessThan(initialBattery ?? 1);
});
```

**Step 4: Commit**

```bash
git add src/core/tick/phases.ts
git commit -m "feat(grid): add grid tick phase to game loop"
```

---

## Task 11: Create BaseTab Vue Component Shell

**Files:**
- Create: `src/renderer/components/BaseTab.vue`
- Modify: `src/renderer/router.ts`
- Modify: `src/renderer/components/TabNav.vue`

**Step 1: Create minimal component**

```vue
<!-- src/renderer/components/BaseTab.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";

const state = computed(() => gameService.getState());
</script>

<template>
  <div class="base-tab">
    <header class="base-header">
      <h2>Base Grid</h2>
      <div class="power-summary">
        <!-- Power stats will go here -->
        <span>Power: Coming soon</span>
      </div>
    </header>

    <div class="grid-container">
      <!-- D3 grid will render here -->
      <p class="placeholder">Grid visualization coming soon...</p>
    </div>
  </div>
</template>

<style scoped>
.base-tab {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  height: 100%;
}

.base-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.base-header h2 {
  margin: 0;
  font-size: var(--g-font-size-lg);
}

.power-summary {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.grid-container {
  flex: 1;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  color: var(--g-color-text-muted);
  font-style: italic;
}
</style>
```

**Step 2: Add route**

Modify `src/renderer/router.ts`:

```typescript
{
  path: "/base",
  name: "base",
  component: () => import("./components/BaseTab.vue"),
},
```

**Step 3: Add tab navigation**

Modify `src/renderer/components/TabNav.vue` template:

```vue
<RouterLink to="/base" class="tab-link" active-class="active"> Base </RouterLink>
```

**Step 4: Verify tab appears**

Run: `bun run dev`
Navigate to Base tab and verify it loads.

**Step 5: Commit**

```bash
git add src/renderer/components/BaseTab.vue src/renderer/router.ts src/renderer/components/TabNav.vue
git commit -m "feat(ui): add BaseTab component shell with navigation"
```

---

## Task 12: Isometric Grid Rendering Utilities

**Files:**
- Create: `src/renderer/components/BaseGrid/isometricUtils.ts`
- Test: `tests/isometricUtils.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/isometricUtils.test.ts
import { describe, expect, test } from "bun:test";
import {
  gridToScreen,
  screenToGrid,
  TILE_WIDTH,
  TILE_HEIGHT
} from "../src/renderer/components/BaseGrid/isometricUtils";

describe("Isometric Utils", () => {
  test("gridToScreen converts (0,0) to center offset", () => {
    const screen = gridToScreen(0, 0, 800, 600);
    // (0,0) should be at top-center of visible area
    expect(screen.x).toBeCloseTo(400, 0);
  });

  test("gridToScreen: moving right (+x) goes down-right", () => {
    const origin = gridToScreen(0, 0, 800, 600);
    const right = gridToScreen(1, 0, 800, 600);

    expect(right.x).toBeGreaterThan(origin.x);
    expect(right.y).toBeGreaterThan(origin.y);
  });

  test("gridToScreen: moving down (+y) goes down-left", () => {
    const origin = gridToScreen(0, 0, 800, 600);
    const down = gridToScreen(0, 1, 800, 600);

    expect(down.x).toBeLessThan(origin.x);
    expect(down.y).toBeGreaterThan(origin.y);
  });

  test("screenToGrid inverts gridToScreen", () => {
    const gridX = 5, gridY = 3;
    const screen = gridToScreen(gridX, gridY, 800, 600);
    const grid = screenToGrid(screen.x, screen.y, 800, 600);

    expect(grid.x).toBeCloseTo(gridX, 0);
    expect(grid.y).toBeCloseTo(gridY, 0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/isometricUtils.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/renderer/components/BaseGrid/isometricUtils.ts

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const GRID_SIZE = 10;

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface GridCoord {
  x: number;
  y: number;
}

/**
 * Convert grid coordinates to screen position (isometric projection).
 * Grid (0,0) is at top-center of the view.
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  viewWidth: number,
  viewHeight: number
): ScreenPosition {
  // Isometric projection formulas
  const isoX = (gridX - gridY) * (TILE_WIDTH / 2);
  const isoY = (gridX + gridY) * (TILE_HEIGHT / 2);

  // Center the grid in the view
  // The grid spans from (-GRID_SIZE * TILE_WIDTH/2) to (GRID_SIZE * TILE_WIDTH/2) in x
  const centerOffsetX = viewWidth / 2;
  const centerOffsetY = TILE_HEIGHT * 2; // Some padding from top

  return {
    x: isoX + centerOffsetX,
    y: isoY + centerOffsetY,
  };
}

/**
 * Convert screen position back to grid coordinates.
 * Returns floating point - caller should round as needed.
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  viewWidth: number,
  viewHeight: number
): GridCoord {
  // Reverse the offset
  const centerOffsetX = viewWidth / 2;
  const centerOffsetY = TILE_HEIGHT * 2;

  const isoX = screenX - centerOffsetX;
  const isoY = screenY - centerOffsetY;

  // Reverse isometric projection
  const gridX = (isoX / (TILE_WIDTH / 2) + isoY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (isoY / (TILE_HEIGHT / 2) - isoX / (TILE_WIDTH / 2)) / 2;

  return { x: gridX, y: gridY };
}

/**
 * Snap screen coordinates to nearest grid cell.
 */
export function snapToGrid(
  screenX: number,
  screenY: number,
  viewWidth: number,
  viewHeight: number
): GridCoord {
  const grid = screenToGrid(screenX, screenY, viewWidth, viewHeight);
  return {
    x: Math.round(grid.x),
    y: Math.round(grid.y),
  };
}

/**
 * Check if grid coordinates are within bounds.
 */
export function isValidGridPosition(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/isometricUtils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/components/BaseGrid/isometricUtils.ts tests/isometricUtils.test.ts
git commit -m "feat(ui): add isometric coordinate utilities"
```

---

## Task 13: D3 Grid Rendering Function

**Files:**
- Create: `src/renderer/components/BaseGrid/renderBaseGrid.ts`

**Step 1: Create rendering function**

```typescript
// src/renderer/components/BaseGrid/renderBaseGrid.ts
import { select } from "d3-selection";
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT, GRID_SIZE, isValidGridPosition } from "./isometricUtils";
import type { GridPosition, DepositType, PowerState } from "../../../core/models/Grid";

export interface GridNodeData {
  buildingId?: string;
  buildingName?: string;
  buildingIcon?: string;
  position: GridPosition;
  deposit?: DepositType;
  powerState?: PowerState;
  batteryLevel?: number;
}

export interface BaseGridData {
  cells: GridNodeData[];
  selectedPosition: GridPosition | null;
}

export interface BaseGridOptions {
  width: number;
  height: number;
  onCellClick: (position: GridPosition, hasBuilding: boolean) => void;
  onCellHover: (position: GridPosition | null) => void;
}

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    bgBase: style.getPropertyValue("--g-color-bg-base").trim() || "#1a1a2e",
    bgSurface: style.getPropertyValue("--g-color-bg-surface").trim() || "#252540",
    border: style.getPropertyValue("--g-color-border").trim() || "#3a3a5c",
    text: style.getPropertyValue("--g-color-text").trim() || "#e0e0e0",
    textMuted: style.getPropertyValue("--g-color-text-muted").trim() || "#888",
    positive: style.getPropertyValue("--g-color-positive").trim() || "#4caf50",
    warning: style.getPropertyValue("--g-color-warning").trim() || "#ff9800",
    danger: style.getPropertyValue("--g-color-danger").trim() || "#f44336",
    info: style.getPropertyValue("--g-color-info").trim() || "#2196f3",
  };
}

export function renderBaseGrid(
  container: SVGSVGElement,
  data: BaseGridData,
  options: BaseGridOptions
): void {
  const { width, height, onCellClick, onCellHover } = options;
  const colors = getThemeColors();

  const svg = select(container);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  // Background for click-away
  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", colors.bgBase)
    .on("click", () => onCellClick({ x: -1, y: -1 }, false));

  // Create cell lookup
  const cellMap = new Map<string, GridNodeData>();
  for (const cell of data.cells) {
    cellMap.set(`${cell.position.x},${cell.position.y}`, cell);
  }

  // Render grid cells
  const cellGroup = svg.append("g").attr("class", "grid-cells");

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const screen = gridToScreen(x, y, width, height);
      const cell = cellMap.get(`${x},${y}`);
      const isSelected = data.selectedPosition?.x === x && data.selectedPosition?.y === y;

      // Diamond shape for isometric tile
      const points = [
        [screen.x, screen.y - TILE_HEIGHT / 2],
        [screen.x + TILE_WIDTH / 2, screen.y],
        [screen.x, screen.y + TILE_HEIGHT / 2],
        [screen.x - TILE_WIDTH / 2, screen.y],
      ].map(p => p.join(",")).join(" ");

      const cellG = cellGroup.append("g")
        .attr("class", "grid-cell")
        .attr("data-x", x)
        .attr("data-y", y);

      // Base tile
      cellG.append("polygon")
        .attr("points", points)
        .attr("fill", cell?.buildingId ? colors.bgSurface : colors.bgBase)
        .attr("stroke", isSelected ? colors.info : colors.border)
        .attr("stroke-width", isSelected ? 2 : 1)
        .style("cursor", "pointer")
        .on("click", () => onCellClick({ x, y }, !!cell?.buildingId))
        .on("mouseenter", () => onCellHover({ x, y }))
        .on("mouseleave", () => onCellHover(null));

      // Deposit indicator
      if (cell?.deposit && !cell.buildingId) {
        const depositColor = cell.deposit === "water" ? colors.info : colors.warning;
        cellG.append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 6)
          .attr("fill", depositColor)
          .attr("opacity", 0.6)
          .style("pointer-events", "none");
      }

      // Building node
      if (cell?.buildingId) {
        // Building circle
        cellG.append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 14)
          .attr("fill", colors.bgSurface)
          .attr("stroke", getPowerStateColor(cell.powerState, colors))
          .attr("stroke-width", 2);

        // Building label
        cellG.append("text")
          .attr("x", screen.x)
          .attr("y", screen.y + 24)
          .attr("text-anchor", "middle")
          .attr("fill", colors.textMuted)
          .attr("font-size", "9px")
          .attr("font-family", "var(--g-font-mono)")
          .text(cell.buildingName?.substring(0, 8) ?? "");

        // Power state icon
        if (cell.powerState && cell.powerState !== "powered") {
          cellG.append("text")
            .attr("x", screen.x)
            .attr("y", screen.y + 4)
            .attr("text-anchor", "middle")
            .attr("fill", getPowerStateColor(cell.powerState, colors))
            .attr("font-size", "12px")
            .text(getPowerStateIcon(cell.powerState));
        }
      }
    }
  }
}

function getPowerStateColor(state: PowerState | undefined, colors: ReturnType<typeof getThemeColors>): string {
  switch (state) {
    case "powered": return colors.positive;
    case "on_battery": return colors.warning;
    case "low_battery": return colors.danger;
    case "unpowered": return colors.textMuted;
    default: return colors.border;
  }
}

function getPowerStateIcon(state: PowerState): string {
  switch (state) {
    case "on_battery": return "🔋";
    case "low_battery": return "🪫";
    case "unpowered": return "⛔";
    default: return "";
  }
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/BaseGrid/renderBaseGrid.ts
git commit -m "feat(ui): add D3 isometric grid rendering"
```

---

## Task 14: BaseGrid Vue Component

**Files:**
- Create: `src/renderer/components/BaseGrid/BaseGrid.vue`

**Step 1: Create component**

```vue
<!-- src/renderer/components/BaseGrid/BaseGrid.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { GridPosition, DepositType, PowerState } from "../../../core/models/Grid";
import { renderBaseGrid, type BaseGridData, type GridNodeData } from "./renderBaseGrid";

interface BuildingInfo {
  id: string;
  name: string;
  position: GridPosition;
  powerState: PowerState;
  batteryLevel: number;
}

interface DepositInfo {
  position: GridPosition;
  type: DepositType;
}

interface Props {
  buildings: BuildingInfo[];
  deposits: DepositInfo[];
  selectedPosition: GridPosition | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  cellClick: [position: GridPosition, hasBuilding: boolean];
  cellHover: [position: GridPosition | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const dimensions = ref({ width: 800, height: 600 });

function updateDimensions() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dimensions.value = {
      width: Math.max(400, rect.width),
      height: Math.max(300, rect.height),
    };
  }
}

const gridData = computed<BaseGridData>(() => {
  const cells: GridNodeData[] = [];

  // Create lookup for buildings and deposits
  const buildingMap = new Map(props.buildings.map(b => [`${b.position.x},${b.position.y}`, b]));
  const depositMap = new Map(props.deposits.map(d => [`${d.position.x},${d.position.y}`, d]));

  // Generate all cells
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const key = `${x},${y}`;
      const building = buildingMap.get(key);
      const deposit = depositMap.get(key);

      cells.push({
        position: { x, y },
        buildingId: building?.id,
        buildingName: building?.name,
        powerState: building?.powerState,
        batteryLevel: building?.batteryLevel,
        deposit: deposit?.type,
      });
    }
  }

  return {
    cells,
    selectedPosition: props.selectedPosition,
  };
});

function render() {
  if (!svgRef.value) return;

  renderBaseGrid(svgRef.value, gridData.value, {
    width: dimensions.value.width,
    height: dimensions.value.height,
    onCellClick: (pos, hasBuilding) => emit("cellClick", pos, hasBuilding),
    onCellHover: (pos) => emit("cellHover", pos),
  });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateDimensions();
  render();

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      render();
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch([gridData, dimensions], render);
</script>

<template>
  <div ref="containerRef" class="base-grid">
    <svg ref="svgRef" class="grid-svg" />
  </div>
</template>

<style scoped>
.base-grid {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.grid-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/BaseGrid/BaseGrid.vue
git commit -m "feat(ui): add BaseGrid Vue component"
```

---

## Task 15: Building Context Menu Component

**Files:**
- Create: `src/renderer/components/BaseGrid/BuildingContextMenu.vue`

**Step 1: Create component**

```vue
<!-- src/renderer/components/BaseGrid/BuildingContextMenu.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { GridPosition, DepositType } from "../../../core/models/Grid";
import type { BuildingDefinition } from "../../../core/models/Building";

interface PlacementHints {
  hasPower: boolean;
  powerCapacityAvailable: number;
  deposit?: DepositType;
  isOccupied: boolean;
}

interface Props {
  position: GridPosition;
  hints: PlacementHints;
  availableBuildings: BuildingDefinition[];
  screenX: number;
  screenY: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [buildingId: string];
  close: [];
}>();

const filteredBuildings = computed(() => {
  return props.availableBuildings.filter(def => {
    // Filter by deposit requirement
    if (def.requiresDeposit && !props.hints.deposit) {
      return false;
    }
    return true;
  });
});

function getBuildingHint(def: BuildingDefinition): string {
  const hints: string[] = [];

  if (!props.hints.hasPower && def.powerConsumption) {
    hints.push("⚠️ No power");
  } else if (props.hints.hasPower) {
    hints.push(`⚡ ${props.hints.powerCapacityAvailable} available`);
  }

  if (def.requiresDeposit && props.hints.deposit) {
    hints.push(`💧 ${props.hints.deposit} deposit`);
  }

  return hints.join(" · ");
}

function isRecommended(def: BuildingDefinition): boolean {
  // Recommend power buildings when no power
  if (!props.hints.hasPower && def.powerProduction) {
    return true;
  }
  // Recommend deposit buildings when on deposit
  if (props.hints.deposit && def.requiresDeposit) {
    return true;
  }
  return false;
}
</script>

<template>
  <div
    class="context-menu"
    :style="{ left: `${screenX}px`, top: `${screenY}px` }"
  >
    <header class="menu-header">
      <span class="coords">Cell ({{ position.x }}, {{ position.y }})</span>
      <button class="close-btn" @click="emit('close')">×</button>
    </header>

    <div class="menu-info">
      <span v-if="hints.hasPower" class="power-ok">⚡ Powered</span>
      <span v-else class="power-warning">⚠️ No power coverage</span>
      <span v-if="hints.deposit" class="deposit">
        {{ hints.deposit === 'water' ? '💧' : '�ite;' }} {{ hints.deposit }}
      </span>
    </div>

    <ul class="building-list">
      <li
        v-for="def in filteredBuildings"
        :key="def.id"
        class="building-option"
        :class="{ recommended: isRecommended(def) }"
        @click="emit('select', def.id)"
      >
        <div class="building-name">
          {{ def.name }}
          <span v-if="isRecommended(def)" class="rec-badge">★</span>
        </div>
        <div class="building-hint">{{ getBuildingHint(def) }}</div>
        <div class="building-cost">{{ def.cost.materials }} materials</div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-base);
  border-bottom: 1px solid var(--g-color-border);
}

.coords {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.close-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.close-btn:hover {
  color: var(--g-color-text);
}

.menu-info {
  display: flex;
  gap: var(--g-space-sm);
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.power-ok {
  color: var(--g-color-positive);
}

.power-warning {
  color: var(--g-color-warning);
}

.deposit {
  color: var(--g-color-info);
}

.building-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.building-option {
  padding: var(--g-space-sm);
  cursor: pointer;
  border-bottom: 1px solid var(--g-color-border);
}

.building-option:hover {
  background: var(--g-color-bg-base);
}

.building-option.recommended {
  background: rgba(33, 150, 243, 0.1);
}

.building-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.rec-badge {
  color: var(--g-color-warning);
  font-size: var(--g-font-size-xs);
}

.building-hint {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: 2px;
}

.building-cost {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/BaseGrid/BuildingContextMenu.vue
git commit -m "feat(ui): add building context menu component"
```

---

## Task 16: Building Stats Card Component

**Files:**
- Create: `src/renderer/components/BaseGrid/BuildingStatsCard.vue`

**Step 1: Create component**

```vue
<!-- src/renderer/components/BaseGrid/BuildingStatsCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition } from "../../../core/models/Building";
import type { PowerState, GridPosition } from "../../../core/models/Grid";
import GCard from "../../ui/GCard.vue";
import GProgress from "../../ui/GProgress.vue";

interface Props {
  building: Building;
  definition: BuildingDefinition;
  position: GridPosition;
  powerState: PowerState;
  batteryLevel: number;
  distanceToPower: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  demolish: [buildingId: string];
}>();

const powerStateLabel = computed(() => {
  switch (props.powerState) {
    case "powered": return "Powered";
    case "on_battery": return "On Battery";
    case "low_battery": return "Low Battery";
    case "unpowered": return "Unpowered";
    default: return "Unknown";
  }
});

const powerStateColor = computed(() => {
  switch (props.powerState) {
    case "powered": return "var(--g-color-positive)";
    case "on_battery": return "var(--g-color-warning)";
    case "low_battery": return "var(--g-color-danger)";
    case "unpowered": return "var(--g-color-text-muted)";
    default: return "var(--g-color-text-muted)";
  }
});

const batteryPercent = computed(() => Math.round(props.batteryLevel * 100));
</script>

<template>
  <GCard class="stats-card">
    <template #header>
      <div class="card-header">
        <h3>{{ definition.name }}</h3>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
    </template>

    <div class="card-content">
      <p class="description">{{ definition.description }}</p>

      <div class="stats-section">
        <h4>Location</h4>
        <div class="stat-row">
          <span class="stat-label">Position</span>
          <span class="stat-value">({{ position.x }}, {{ position.y }})</span>
        </div>
      </div>

      <div class="stats-section">
        <h4>Power</h4>
        <div class="stat-row">
          <span class="stat-label">Status</span>
          <span class="stat-value" :style="{ color: powerStateColor }">
            {{ powerStateLabel }}
          </span>
        </div>
        <div v-if="definition.powerConsumption" class="stat-row">
          <span class="stat-label">Consumption</span>
          <span class="stat-value">{{ definition.powerConsumption }}/sol</span>
        </div>
        <div v-if="definition.powerProduction" class="stat-row">
          <span class="stat-label">Production</span>
          <span class="stat-value positive">+{{ definition.powerProduction }}/sol</span>
        </div>
        <div v-if="powerState !== 'powered'" class="battery-section">
          <span class="stat-label">Battery</span>
          <GProgress :value="batteryLevel" :max="1" :variant="batteryLevel < 0.33 ? 'danger' : 'default'" />
          <span class="battery-percent">{{ batteryPercent }}%</span>
        </div>
        <div v-if="distanceToPower < Infinity" class="stat-row">
          <span class="stat-label">Distance to Power</span>
          <span class="stat-value">{{ distanceToPower }} cells</span>
        </div>
      </div>

      <div v-if="definition.production || definition.consumption" class="stats-section">
        <h4>Resources</h4>
        <div v-if="definition.production" class="stat-row">
          <span class="stat-label">Production</span>
          <span class="stat-value positive">
            <span v-for="(val, key) in definition.production" :key="key">
              +{{ val }} {{ key }}
            </span>
          </span>
        </div>
        <div v-if="definition.consumption" class="stat-row">
          <span class="stat-label">Consumption</span>
          <span class="stat-value negative">
            <span v-for="(val, key) in definition.consumption" :key="key">
              -{{ val }} {{ key }}
            </span>
          </span>
        </div>
      </div>

      <div v-if="definition.workerSlots" class="stats-section">
        <h4>Workers</h4>
        <div class="stat-row">
          <span class="stat-label">Assigned</span>
          <span class="stat-value">{{ building.assignedWorkers.length }} / {{ definition.workerSlots }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="demolish-btn" @click="emit('demolish', building.id)">
        Demolish
      </button>
    </template>
  </GCard>
</template>

<style scoped>
.stats-card {
  width: 280px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: var(--g-font-size-md);
}

.close-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  font-size: 20px;
  cursor: pointer;
}

.description {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  margin-bottom: var(--g-space-md);
}

.stats-section {
  margin-bottom: var(--g-space-md);
}

.stats-section h4 {
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  color: var(--g-color-text-muted);
  margin: 0 0 var(--g-space-xs) 0;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
  padding: var(--g-space-xs) 0;
}

.stat-label {
  color: var(--g-color-text-muted);
}

.stat-value {
  font-family: var(--g-font-mono);
}

.stat-value.positive {
  color: var(--g-color-positive);
}

.stat-value.negative {
  color: var(--g-color-negative);
}

.battery-section {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-xs) 0;
}

.battery-percent {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  min-width: 36px;
}

.demolish-btn {
  width: 100%;
  padding: var(--g-space-sm);
  background: var(--g-color-danger);
  color: white;
  border: none;
  cursor: pointer;
  font-family: var(--g-font-mono);
  text-transform: uppercase;
}

.demolish-btn:hover {
  filter: brightness(1.1);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/BaseGrid/BuildingStatsCard.vue
git commit -m "feat(ui): add building stats card component"
```

---

## Task 17: Wire Up BaseTab with Grid Components

**Files:**
- Modify: `src/renderer/components/BaseTab.vue`
- Modify: `src/renderer/services/GameService.ts` (add grid state sync)

**Step 1: Update GameService to expose grid state**

Add to `GameService.ts`:

```typescript
// Add to GameUIState interface:
gridBuildings: Array<{
  id: string;
  name: string;
  position: { x: number; y: number };
  powerState: string;
  batteryLevel: number;
}>;
gridDeposits: Array<{
  position: { x: number; y: number };
  type: string;
}>;

// Add to syncState():
const gridPlacements = [];
for (const building of this.gameState.buildings.getActiveBuildings()) {
  const pos = this.gameState.grid.getBuildingPosition(building.id);
  const placement = this.gameState.grid.getPlacement(building.id);
  if (pos && placement) {
    const def = this.gameState.buildings.getDefinition(building.definitionId);
    gridPlacements.push({
      id: building.id,
      name: def?.name ?? building.definitionId,
      position: pos,
      powerState: placement.powerState,
      batteryLevel: placement.batteryLevel,
    });
  }
}
this.state.gridBuildings = gridPlacements;
this.state.gridDeposits = this.gameState.grid.getAllDeposits().map(d => ({
  position: d.position,
  type: d.type,
}));
```

**Step 2: Update BaseTab to use components**

Full implementation of BaseTab.vue integrating all components.

**Step 3: Test in browser**

Run: `bun run dev`
Navigate to Base tab, verify grid renders with buildings and interactions work.

**Step 4: Commit**

```bash
git add src/renderer/components/BaseTab.vue src/renderer/services/GameService.ts
git commit -m "feat(ui): wire up BaseTab with grid components"
```

---

## Task 18: Add Building Placement Action

**Files:**
- Modify: `src/facade/domains/BuildingsFacade.ts`
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Add grid placement to build action**

When a building is constructed, also place it on the grid at the specified position.

**Step 2: Add demolish with grid removal**

When recycling/demolishing, also remove from grid.

**Step 3: Test placement flow**

Verify that building via context menu places on grid and updates power.

**Step 4: Commit**

```bash
git add src/facade/domains/BuildingsFacade.ts src/renderer/services/GameService.ts
git commit -m "feat(grid): connect building placement to grid system"
```

---

## Task 19: Integration Tests

**Files:**
- Create: `tests/GridIntegration.test.ts`

**Step 1: Write integration tests**

```typescript
// tests/GridIntegration.test.ts
import { describe, expect, test } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { PowerState } from "../src/core/models/Grid";

describe("Grid Integration", () => {
  test("new building placed on grid affects power network", () => {
    const state = new GameState();

    // Build a new solar panel
    const result = state.buildings.startConstruction(BuildingId.SOLAR_PANEL);
    expect(result.success).toBe(true);

    // Place it on grid
    if (result.buildingId) {
      state.grid.placeBuilding(result.buildingId, { x: 3, y: 3 });
      state.grid.registerPowerSource(result.buildingId, 10);
      state.grid.updatePowerConnections(false);
    }

    // Buildings near it should be powered
    // ... test specifics
  });

  test("removing power source causes battery drain", () => {
    const state = new GameState();

    // Remove initial solar panel
    const solar = state.buildings.getActiveBuildings()
      .find(b => b.definitionId === BuildingId.SOLAR_PANEL);

    if (solar) {
      state.grid.unregisterPowerSource(solar.id);
      state.grid.updatePowerConnections(false);

      // Habitat should now be on battery
      const habitat = state.buildings.getActiveBuildings()
        .find(b => b.definitionId === BuildingId.HABITAT);

      if (habitat) {
        const powerState = state.grid.getPowerState(habitat.id);
        expect(powerState).toBe(PowerState.ON_BATTERY);
      }
    }
  });

  test("tick progresses battery drain", () => {
    const state = new GameState();

    // ... setup unpowered building

    const initialBattery = 1.0;
    state.tick();

    // ... verify battery decreased
  });
});
```

**Step 2: Run and verify**

Run: `bun test tests/GridIntegration.test.ts`

**Step 3: Commit**

```bash
git add tests/GridIntegration.test.ts
git commit -m "test(grid): add grid integration tests"
```

---

## Task 20: Update Manual

**Files:**
- Modify: `MANUAL.md`

**Step 1: Add Base tab documentation**

Add section explaining:
- The power grid system
- How to place buildings
- Power range and battery mechanics
- Strategic tips for layout

**Step 2: Commit**

```bash
git add MANUAL.md
git commit -m "docs: add Base tab and power grid to manual"
```

---

## Summary

This plan creates a complete node-based power grid system in 20 tasks:

1. **Tasks 1-8**: Core GridManager with power connections, battery system, serialization
2. **Tasks 9-10**: GameState integration and tick phase
3. **Tasks 11-16**: Vue UI components (tab, grid, context menu, stats card)
4. **Tasks 17-18**: Wiring everything together
5. **Tasks 19-20**: Testing and documentation

Each task is 2-5 minutes of focused work following TDD patterns.
