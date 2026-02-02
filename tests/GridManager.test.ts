// tests/GridManager.test.ts
import { describe, expect, it } from "bun:test";
import { GridManager } from "../src/core/systems/GridManager";
import { DepositType, GRID_SIZE, PowerState } from "../src/core/models/Grid";
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../src/core/balance/GridBalance";

describe("GridManager", () => {
  it("initializes 10x10 grid", () => {
    const manager = new GridManager();
    expect(manager.getGridSize()).toBe(GRID_SIZE);
  });

  it("all cells start empty", () => {
    const manager = new GridManager();
    const cell = manager.getCell(5, 5);
    expect(cell).not.toBeNull();
    expect(cell?.buildingId).toBeUndefined();
  });

  it("getCell returns null for out-of-bounds", () => {
    const manager = new GridManager();
    expect(manager.getCell(-1, 0)).toBeNull();
    expect(manager.getCell(10, 0)).toBeNull();
    expect(manager.getCell(0, 10)).toBeNull();
  });

  it("generateDeposits creates water and mineral deposits", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345); // seed for reproducibility

    const deposits = manager.getAllDeposits();
    const waterDeposits = deposits.filter((d) => d.type === DepositType.WATER);
    const mineralDeposits = deposits.filter((d) => d.type === DepositType.MINERAL);

    expect(waterDeposits.length).toBeGreaterThanOrEqual(2);
    expect(waterDeposits.length).toBeLessThanOrEqual(3);
    expect(mineralDeposits.length).toBeGreaterThanOrEqual(2);
    expect(mineralDeposits.length).toBeLessThanOrEqual(3);
  });

  it("deposits avoid center 4x4 area", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);

    const deposits = manager.getAllDeposits();
    for (const deposit of deposits) {
      const isInCenter =
        deposit.position.x >= 3 &&
        deposit.position.x <= 6 &&
        deposit.position.y >= 3 &&
        deposit.position.y <= 6;
      expect(isInCenter).toBe(false);
    }
  });
});

describe("GridManager - Building Placement", () => {
  it("placeBuilding adds building to cell", () => {
    const manager = new GridManager();
    const result = manager.placeBuilding("building-1", { x: 5, y: 5 });

    expect(result.success).toBe(true);
    const cell = manager.getCell(5, 5);
    expect(cell?.buildingId).toBe("building-1");
  });

  it("placeBuilding fails on occupied cell", () => {
    const manager = new GridManager();
    manager.placeBuilding("building-1", { x: 5, y: 5 });
    const result = manager.placeBuilding("building-2", { x: 5, y: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Cell is occupied");
  });

  it("placeBuilding fails on out-of-bounds", () => {
    const manager = new GridManager();
    const result = manager.placeBuilding("building-1", { x: 15, y: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Position out of bounds");
  });

  it("removeBuilding clears cell and placement record", () => {
    const manager = new GridManager();
    manager.placeBuilding("building-1", { x: 5, y: 5 });
    manager.removeBuilding({ x: 5, y: 5 });

    const cell = manager.getCell(5, 5);
    expect(cell?.buildingId).toBeUndefined();
    expect(manager.getBuildingPosition("building-1")).toBeNull();
  });

  it("getBuildingPosition returns position for placed building", () => {
    const manager = new GridManager();
    manager.placeBuilding("building-1", { x: 3, y: 7 });

    const pos = manager.getBuildingPosition("building-1");
    expect(pos).toEqual({ x: 3, y: 7 });
  });

  it("getBuildingPosition returns null for unknown building", () => {
    const manager = new GridManager();
    const pos = manager.getBuildingPosition("unknown");
    expect(pos).toBeNull();
  });

  it("removeBuilding cleans up power sources", () => {
    const manager = new GridManager();
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);

    expect(manager.getPowerSources().length).toBe(1);

    manager.removeBuilding({ x: 5, y: 5 });

    expect(manager.getPowerSources().length).toBe(0);
  });
});

describe("GridManager - Power Connections", () => {
  it("registerPowerSource tracks power buildings", () => {
    const manager = new GridManager();
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10); // 10 power output

    const sources = manager.getPowerSources();
    expect(sources.length).toBe(1);
    expect(sources[0].buildingId).toBe("solar-1");
  });

  it("calculateDistance returns Manhattan distance", () => {
    const manager = new GridManager();
    const distance = manager.calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(distance).toBe(7); // |3-0| + |4-0| = 7
  });

  it("building within range connects to power", () => {
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

  it("building outside range is unpowered", () => {
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

  it("closer buildings get priority when capacity exceeded", () => {
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

describe("GridManager - Battery System", () => {
  it("tick drains battery for unpowered buildings", () => {
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
    expect(afterOneSol).toBeCloseTo(1 - 1 / BATTERY_BACKUP_SOLS, 2);
  });

  it("battery transitions to low_battery state", () => {
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

  it("battery fully drained becomes unpowered", () => {
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

  it("reconnecting to power recharges battery", () => {
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
