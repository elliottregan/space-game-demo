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

describe("GridManager - Power Connections (Adjacency)", () => {
  it("registerPowerSource tracks power buildings", () => {
    const manager = new GridManager();
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);

    const sources = manager.getPowerSources();
    expect(sources.length).toBe(1);
    expect(sources[0]!.buildingId).toBe("solar-1");
  });

  it("calculateDistance returns Manhattan distance", () => {
    const manager = new GridManager();
    const distance = manager.calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(distance).toBe(7);
  });

  it("adjacent building connects to power", () => {
    const manager = new GridManager();

    // Place solar panel
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);

    // Place habitat adjacent (distance 1)
    manager.placeBuilding("habitat-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("habitat-1", 4);

    manager.updatePowerConnections();

    expect(manager.getPowerState("habitat-1")).toBe(PowerState.POWERED);
  });

  it("non-adjacent building without chain is unpowered", () => {
    const manager = new GridManager();

    // Place solar panel
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);

    // Place habitat non-adjacent (distance 2, no chain)
    manager.placeBuilding("habitat-1", { x: 5, y: 7 });
    manager.setBuildingPowerConsumption("habitat-1", 4);

    manager.updatePowerConnections();

    // Not adjacent and no relay chain => unpowered
    expect(manager.getPowerState("habitat-1")).toBe(PowerState.ON_BATTERY);
  });

  it("power propagates through chain of adjacent buildings", () => {
    const manager = new GridManager();

    // Solar at (5,5)
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 50);

    // Chain: (5,6) -> (5,7) -> (5,8)
    manager.placeBuilding("relay-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("relay-1", 4);
    manager.placeBuilding("relay-2", { x: 5, y: 7 });
    manager.setBuildingPowerConsumption("relay-2", 4);
    manager.placeBuilding("target", { x: 5, y: 8 });
    manager.setBuildingPowerConsumption("target", 4);

    manager.updatePowerConnections();

    expect(manager.getPowerState("relay-1")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("relay-2")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("target")).toBe(PowerState.POWERED);
  });

  it("empty cell breaks power chain", () => {
    const manager = new GridManager();

    // Solar at (5,5)
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 50);

    // Building at (5,6) - adjacent to solar
    manager.placeBuilding("connected", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("connected", 4);

    // Gap at (5,7) - empty cell

    // Building at (5,8) - not connected through chain
    manager.placeBuilding("disconnected", { x: 5, y: 8 });
    manager.setBuildingPowerConsumption("disconnected", 4);

    manager.updatePowerConnections();

    expect(manager.getPowerState("connected")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("disconnected")).toBe(PowerState.ON_BATTERY);
  });

  it("capacity limits in chains - closer buildings get priority", () => {
    const manager = new GridManager();

    // Solar with limited power (10 = enough for 2 buildings at 4 each)
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);

    // Chain of 3 buildings each needing 4 power
    manager.placeBuilding("b1", { x: 5, y: 6 }); // 1 hop
    manager.setBuildingPowerConsumption("b1", 4);
    manager.placeBuilding("b2", { x: 5, y: 7 }); // 2 hops
    manager.setBuildingPowerConsumption("b2", 4);
    manager.placeBuilding("b3", { x: 5, y: 8 }); // 3 hops
    manager.setBuildingPowerConsumption("b3", 4);

    manager.updatePowerConnections();

    // First two should be powered (8 power), third should not (would need 12)
    expect(manager.getPowerState("b1")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("b2")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("b3")).toBe(PowerState.ON_BATTERY);
  });

  it("buildings relay power even when powered by another source", () => {
    const manager = new GridManager();

    // Two power sources
    manager.placeBuilding("solar-1", { x: 3, y: 5 });
    manager.registerPowerSource("solar-1", 50);
    manager.placeBuilding("solar-2", { x: 7, y: 5 });
    manager.registerPowerSource("solar-2", 4); // just enough for 1 building

    // Chain connecting both: (4,5) -> (5,5) -> (6,5)
    manager.placeBuilding("b1", { x: 4, y: 5 });
    manager.setBuildingPowerConsumption("b1", 4);
    manager.placeBuilding("b2", { x: 5, y: 5 });
    manager.setBuildingPowerConsumption("b2", 4);
    manager.placeBuilding("b3", { x: 6, y: 5 });
    manager.setBuildingPowerConsumption("b3", 4);

    manager.updatePowerConnections();

    // All should be powered - solar-1 can reach through chain, solar-2 can reach b3
    expect(manager.getPowerState("b1")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("b2")).toBe(PowerState.POWERED);
    expect(manager.getPowerState("b3")).toBe(PowerState.POWERED);
  });

  it("distanceToPower represents BFS hop count", () => {
    const manager = new GridManager();

    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 50);

    manager.placeBuilding("b1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("b1", 4);
    manager.placeBuilding("b2", { x: 5, y: 7 });
    manager.setBuildingPowerConsumption("b2", 4);

    manager.updatePowerConnections();

    expect(manager.getPlacement("b1")?.distanceToPower).toBe(1);
    expect(manager.getPlacement("b2")?.distanceToPower).toBe(2);
  });

  it("activeBuildingIds filters inactive power sources", () => {
    const manager = new GridManager();

    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.placeBuilding("habitat-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("habitat-1", 4);

    // Solar is not in active set
    manager.updatePowerConnections(new Set(["habitat-1"]));

    expect(manager.getPowerState("habitat-1")).toBe(PowerState.ON_BATTERY);
  });
});

describe("GridManager - Battery System", () => {
  it("tick drains battery for unpowered buildings", () => {
    const manager = new GridManager();

    manager.placeBuilding("habitat-1", { x: 0, y: 0 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections();

    const initialBattery = manager.getPlacement("habitat-1")?.batteryLevel ?? 0;
    expect(initialBattery).toBe(1.0);

    manager.tick();

    const afterOneSol = manager.getPlacement("habitat-1")?.batteryLevel ?? 0;
    expect(afterOneSol).toBeCloseTo(1 - 1 / BATTERY_BACKUP_SOLS, 2);
  });

  it("battery transitions to low_battery state", () => {
    const manager = new GridManager();

    manager.placeBuilding("habitat-1", { x: 0, y: 0 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections();

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
    manager.updatePowerConnections();

    for (let i = 0; i <= BATTERY_BACKUP_SOLS; i++) {
      manager.tick();
    }

    expect(manager.getPowerState("habitat-1")).toBe(PowerState.UNPOWERED);
  });

  it("reconnecting to power recharges battery", () => {
    const manager = new GridManager();

    manager.placeBuilding("habitat-1", { x: 5, y: 5 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections();

    manager.tick();
    manager.tick();

    const drainedBattery = manager.getPlacement("habitat-1")?.batteryLevel ?? 0;
    expect(drainedBattery).toBeLessThan(1.0);

    // Add power source adjacent and reconnect
    manager.placeBuilding("solar-1", { x: 5, y: 6 });
    manager.registerPowerSource("solar-1", 10);
    manager.updatePowerConnections();

    expect(manager.getPlacement("habitat-1")?.batteryLevel).toBe(1.0);
    expect(manager.getPowerState("habitat-1")).toBe(PowerState.POWERED);
  });
});

describe("GridManager - Placement Hints (Adjacency)", () => {
  it("getPlacementHints shows power available when adjacent to powered building", () => {
    const manager = new GridManager();

    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.updatePowerConnections();

    // Cell adjacent to solar panel
    const hintsAdjacent = manager.getPlacementHints({ x: 5, y: 6 });
    expect(hintsAdjacent.hasPower).toBe(true);

    // Cell not adjacent to any powered building
    const hintsNotAdjacent = manager.getPlacementHints({ x: 0, y: 0 });
    expect(hintsNotAdjacent.hasPower).toBe(false);
  });

  it("getPlacementHints shows power when adjacent to powered relay", () => {
    const manager = new GridManager();

    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 50);
    manager.placeBuilding("relay", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("relay", 4);
    manager.updatePowerConnections();

    // Cell adjacent to powered relay (not directly adjacent to solar)
    const hints = manager.getPlacementHints({ x: 5, y: 7 });
    expect(hints.hasPower).toBe(true);
  });

  it("getPlacementHints shows deposit info", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);

    const deposits = manager.getAllDeposits();
    const waterDeposit = deposits.find((d) => d.type === DepositType.WATER);

    if (waterDeposit) {
      const hints = manager.getPlacementHints(waterDeposit.position);
      expect(hints.deposit).toBe(DepositType.WATER);
    }
  });

  it("getPlacementHints shows cell is occupied", () => {
    const manager = new GridManager();
    manager.placeBuilding("solar-1", { x: 5, y: 5 });

    const hints = manager.getPlacementHints({ x: 5, y: 5 });
    expect(hints.isOccupied).toBe(true);
  });
});

describe("GridManager - Serialization", () => {
  it("toJSON captures grid state", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.placeBuilding("habitat-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections();

    const json = manager.toJSON();

    expect(json.placements).toHaveLength(2);
    expect(json.powerSources).toHaveLength(1);
    expect(json.deposits.length).toBeGreaterThan(0);
  });

  it("fromJSON restores grid state", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);
    manager.placeBuilding("solar-1", { x: 5, y: 5 });
    manager.registerPowerSource("solar-1", 10);
    manager.placeBuilding("habitat-1", { x: 5, y: 6 });
    manager.setBuildingPowerConsumption("habitat-1", 4);
    manager.updatePowerConnections();

    const json = manager.toJSON();

    const restored = new GridManager();
    restored.fromJSON(json);

    expect(restored.getCell(5, 5)?.buildingId).toBe("solar-1");
    expect(restored.getCell(5, 6)?.buildingId).toBe("habitat-1");
    expect(restored.getPowerSources()).toHaveLength(1);
    expect(restored.getPowerState("habitat-1")).toBe(PowerState.POWERED);
  });
});
