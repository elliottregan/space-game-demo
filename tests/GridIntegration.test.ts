// tests/GridIntegration.test.ts
import { describe, expect, it } from "bun:test";
import { GameState } from "../src/core/GameState";
import { PowerState } from "../src/core/models/Grid";
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../src/core/balance/GridBalance";
import { GridManager } from "../src/core/systems/GridManager";

describe("Grid Integration", () => {
  describe("Building placement powers nearby buildings (adjacency)", () => {
    it("placing solar panel powers adjacent buildings", () => {
      const state = new GameState();

      // Use positions in center 4x4 area (3-6) where deposits can't spawn
      state.grid.placeBuilding("test-habitat", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("test-habitat", 4);
      state.grid.updatePowerConnections();

      // Should be on battery (no power source adjacent)
      expect(state.grid.getPowerState("test-habitat")).toBe(PowerState.ON_BATTERY);

      // Place a solar panel adjacent to it
      state.grid.placeBuilding("test-solar", { x: 3, y: 4 });
      state.grid.registerPowerSource("test-solar", 10);
      state.grid.updatePowerConnections();

      // Should now be powered
      expect(state.grid.getPowerState("test-solar")).toBe(PowerState.POWERED);
      expect(state.grid.getPowerState("test-habitat")).toBe(PowerState.POWERED);
    });

    it("adjacent building gets connected", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      // Place building adjacent (distance 1)
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);
    });

    it("non-adjacent building without chain is not powered", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      // Place building 2 cells away with no chain
      manager.placeBuilding("building", { x: 5, y: 7 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      expect(manager.getPowerState("building")).toBe(PowerState.ON_BATTERY);
    });

    it("power chains through adjacent buildings", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 50);

      // Chain of buildings
      manager.placeBuilding("b1", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("b1", 4);
      manager.placeBuilding("b2", { x: 5, y: 7 });
      manager.setBuildingPowerConsumption("b2", 4);
      manager.placeBuilding("b3", { x: 5, y: 8 });
      manager.setBuildingPowerConsumption("b3", 4);

      manager.updatePowerConnections();

      expect(manager.getPowerState("b1")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("b2")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("b3")).toBe(PowerState.POWERED);
    });

    it("empty cell breaks power chain", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 50);

      // Adjacent building - powered
      manager.placeBuilding("connected", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("connected", 4);

      // Gap at (5,7)

      // Building after gap - not reachable
      manager.placeBuilding("disconnected", { x: 5, y: 8 });
      manager.setBuildingPowerConsumption("disconnected", 4);

      manager.updatePowerConnections();

      expect(manager.getPowerState("connected")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("disconnected")).toBe(PowerState.ON_BATTERY);
    });
  });

  describe("Removing power source causes battery drain", () => {
    it("removing power source causes battery mode", () => {
      const state = new GameState();

      state.grid.placeBuilding("powered-building", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("powered-building", 4);
      state.grid.placeBuilding("power-source", { x: 3, y: 4 });
      state.grid.registerPowerSource("power-source", 10);
      state.grid.updatePowerConnections();

      expect(state.grid.getPowerState("powered-building")).toBe(PowerState.POWERED);

      // Remove power source
      state.grid.unregisterPowerSource("power-source");
      state.grid.updatePowerConnections();

      expect(state.grid.getPowerState("powered-building")).toBe(PowerState.ON_BATTERY);
    });

    it("buildings start with full battery when placed", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      const placement = manager.getPlacement("building");
      expect(placement?.batteryLevel).toBe(1.0);
    });

    it("unregistering power triggers ON_BATTERY with full battery", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);

      manager.unregisterPowerSource("solar");
      manager.updatePowerConnections();

      const placement = manager.getPlacement("building");
      expect(placement?.powerState).toBe(PowerState.ON_BATTERY);
      expect(placement?.batteryLevel).toBe(1.0);
    });
  });

  describe("Tick progresses battery drain", () => {
    it("tick drains battery for unpowered buildings", () => {
      const state = new GameState();

      state.grid.placeBuilding("drain-test", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("drain-test", 4);
      state.grid.updatePowerConnections();

      const initialBattery = state.grid.getPlacement("drain-test")?.batteryLevel ?? 0;
      expect(initialBattery).toBe(1.0);

      state.tick();

      const afterBattery = state.grid.getPlacement("drain-test")?.batteryLevel ?? 0;
      expect(afterBattery).toBeLessThan(initialBattery);
    });

    it("battery drains at rate of 1/BATTERY_BACKUP_SOLS per sol", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      const initialBattery = manager.getPlacement("building")?.batteryLevel ?? 0;

      manager.tick();

      const afterBattery = manager.getPlacement("building")?.batteryLevel ?? 0;
      const expectedDrain = 1 / BATTERY_BACKUP_SOLS;
      expect(afterBattery).toBeCloseTo(initialBattery - expectedDrain, 5);
    });

    it("battery transitions to LOW_BATTERY state", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      const ticksToLowBattery = Math.ceil(BATTERY_BACKUP_SOLS * (1 - LOW_BATTERY_THRESHOLD));
      for (let i = 0; i < ticksToLowBattery; i++) {
        manager.tick();
      }

      expect(manager.getPowerState("building")).toBe(PowerState.LOW_BATTERY);
    });
  });

  describe("Battery depletes over multiple ticks until unpowered", () => {
    it("battery fully depletes after BATTERY_BACKUP_SOLS ticks", () => {
      const state = new GameState();

      state.grid.placeBuilding("deplete-test", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("deplete-test", 4);
      state.grid.updatePowerConnections();

      for (let i = 0; i < BATTERY_BACKUP_SOLS + 1; i++) {
        state.tick();
      }

      expect(state.grid.getPowerState("deplete-test")).toBe(PowerState.UNPOWERED);
    });

    it("battery level reaches zero after complete drain", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      for (let i = 0; i <= BATTERY_BACKUP_SOLS; i++) {
        manager.tick();
      }

      const placement = manager.getPlacement("building");
      expect(placement?.batteryLevel).toBe(0);
      expect(placement?.powerState).toBe(PowerState.UNPOWERED);
    });

    it("powered buildings do not drain battery", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);

      for (let i = 0; i < 10; i++) {
        manager.tick();
      }

      const placement = manager.getPlacement("building");
      expect(placement?.batteryLevel).toBe(1.0);
      expect(placement?.powerState).toBe(PowerState.POWERED);
    });
  });

  describe("Building recycling removes from grid", () => {
    it("startRecycling removes building from grid via facade", () => {
      const state = new GameState();

      state.grid.placeBuilding("recycle-test", { x: 2, y: 2 });
      state.grid.setBuildingPowerConsumption("recycle-test", 4);
      state.grid.updatePowerConnections();

      expect(state.grid.getBuildingPosition("recycle-test")).not.toBeNull();
      expect(state.grid.getCell(2, 2)?.buildingId).toBe("recycle-test");

      const pos = state.grid.getBuildingPosition("recycle-test");
      if (pos) {
        state.grid.removeBuilding(pos);
      }

      expect(state.grid.getBuildingPosition("recycle-test")).toBeNull();
      expect(state.grid.getCell(2, 2)?.buildingId).toBeUndefined();
    });

    it("removing building cleans up power source registration", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      expect(manager.getPowerSources().length).toBe(1);

      manager.removeBuilding({ x: 5, y: 5 });

      expect(manager.getPowerSources().length).toBe(0);
    });

    it("removing power building affects other buildings power state", () => {
      const manager = new GridManager();

      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections();

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);

      manager.removeBuilding({ x: 5, y: 5 });
      manager.updatePowerConnections();

      expect(manager.getPowerState("building")).toBe(PowerState.ON_BATTERY);
    });
  });

  describe("Full integration flow", () => {
    it("complete cycle: place, power, lose power, drain, repower", () => {
      const manager = new GridManager();

      // 1. Place building without power - starts on battery
      manager.placeBuilding("habitat", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("habitat", 4);
      manager.updatePowerConnections();

      expect(manager.getPowerState("habitat")).toBe(PowerState.ON_BATTERY);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0);

      // 2. Drain some battery
      manager.tick();
      const drainedLevel = manager.getPlacement("habitat")?.batteryLevel ?? 0;
      expect(drainedLevel).toBeLessThan(1.0);

      // 3. Add power source adjacent - should recharge and power
      manager.placeBuilding("solar", { x: 0, y: 1 });
      manager.registerPowerSource("solar", 10);
      manager.updatePowerConnections();

      expect(manager.getPowerState("habitat")).toBe(PowerState.POWERED);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0);

      // 4. Remove power source - back to battery
      manager.removeBuilding({ x: 0, y: 1 });
      manager.updatePowerConnections();

      expect(manager.getPowerState("habitat")).toBe(PowerState.ON_BATTERY);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0);

      // 5. Drain until unpowered
      for (let i = 0; i <= BATTERY_BACKUP_SOLS; i++) {
        manager.tick();
      }

      expect(manager.getPowerState("habitat")).toBe(PowerState.UNPOWERED);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(0);

      // 6. Add power source again adjacent - should repower
      manager.placeBuilding("solar2", { x: 1, y: 0 });
      manager.registerPowerSource("solar2", 10);
      manager.updatePowerConnections();

      expect(manager.getPowerState("habitat")).toBe(PowerState.POWERED);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0);
    });

    it("power capacity priority: BFS order gives closer buildings power first", () => {
      const manager = new GridManager();

      // Solar panel with 10 power (enough for 2 buildings at 4 power each)
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      // Chain of three adjacent buildings
      manager.placeBuilding("close", { x: 5, y: 6 }); // 1 hop
      manager.placeBuilding("mid", { x: 5, y: 7 }); // 2 hops
      manager.placeBuilding("far", { x: 5, y: 8 }); // 3 hops

      manager.setBuildingPowerConsumption("close", 4);
      manager.setBuildingPowerConsumption("mid", 4);
      manager.setBuildingPowerConsumption("far", 4);

      manager.updatePowerConnections();

      // Close and mid should be powered (8 power), far should not (would need 12)
      expect(manager.getPowerState("close")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("mid")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("far")).toBe(PowerState.ON_BATTERY);
    });
  });
});
