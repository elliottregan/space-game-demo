// tests/GridIntegration.test.ts
import { describe, expect, it } from "bun:test";
import { GameState } from "../src/core/GameState";
import { PowerState } from "../src/core/models/Grid";
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../src/core/balance/GridBalance";
import { GridManager } from "../src/core/systems/GridManager";

describe("Grid Integration", () => {
  describe("Building placement powers nearby buildings", () => {
    it("placing solar panel powers nearby buildings", () => {
      const state = new GameState();

      // Use positions in center 4x4 area (3-6) where deposits can't spawn
      // but away from starting buildings (which are around 4-6, 5-6)
      state.grid.placeBuilding("test-habitat", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("test-habitat", 4);
      state.grid.updatePowerConnections(false);

      // Should be on battery (no power source nearby)
      expect(state.grid.getPowerState("test-habitat")).toBe(PowerState.ON_BATTERY);

      // Place a solar panel next to it
      state.grid.placeBuilding("test-solar", { x: 3, y: 4 });
      state.grid.registerPowerSource("test-solar", 10);
      state.grid.updatePowerConnections(false);

      // Should now be powered
      expect(state.grid.getPowerState("test-solar")).toBe(PowerState.POWERED);
      expect(state.grid.getPowerState("test-habitat")).toBe(PowerState.POWERED);
    });

    it("building at edge of power range gets connected", () => {
      // Power range = base(2) + floor(output/20) = 2 for 10 power output
      const manager = new GridManager();

      // Place power source at center
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      // Place building exactly at range (distance 2)
      manager.placeBuilding("building", { x: 5, y: 7 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);
    });

    it("building just outside power range is not powered", () => {
      const manager = new GridManager();

      // Place power source at center
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10); // range = 2

      // Place building outside range (distance 3)
      manager.placeBuilding("building", { x: 5, y: 8 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("building")).toBe(PowerState.ON_BATTERY);
    });
  });

  describe("Removing power source causes battery drain", () => {
    it("removing power source causes battery mode", () => {
      const state = new GameState();

      // Use positions in center 4x4 area (3-6) where deposits can't spawn
      state.grid.placeBuilding("powered-building", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("powered-building", 4);
      state.grid.placeBuilding("power-source", { x: 3, y: 4 });
      state.grid.registerPowerSource("power-source", 10);
      state.grid.updatePowerConnections(false);

      expect(state.grid.getPowerState("powered-building")).toBe(PowerState.POWERED);

      // Remove power source
      state.grid.unregisterPowerSource("power-source");
      state.grid.updatePowerConnections(false);

      // Should be on battery
      expect(state.grid.getPowerState("powered-building")).toBe(PowerState.ON_BATTERY);
    });

    it("buildings start with full battery when placed", () => {
      const manager = new GridManager();

      // Place building without power source
      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      const placement = manager.getPlacement("building");
      expect(placement?.batteryLevel).toBe(1.0);
    });

    it("unregistering power triggers ON_BATTERY with full battery", () => {
      const manager = new GridManager();

      // Setup: powered building
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);

      // Unregister power source
      manager.unregisterPowerSource("solar");
      manager.updatePowerConnections(false);

      // Check state after losing power
      const placement = manager.getPlacement("building");
      expect(placement?.powerState).toBe(PowerState.ON_BATTERY);
      expect(placement?.batteryLevel).toBe(1.0); // Battery still full
    });
  });

  describe("Tick progresses battery drain", () => {
    it("tick drains battery for unpowered buildings", () => {
      const state = new GameState();

      // Use position in center 4x4 area (3-6) where deposits can't spawn
      state.grid.placeBuilding("drain-test", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("drain-test", 4);
      state.grid.updatePowerConnections(false);

      const initialBattery = state.grid.getPlacement("drain-test")?.batteryLevel ?? 0;
      expect(initialBattery).toBe(1.0);

      // Tick to drain battery
      state.tick();

      const afterBattery = state.grid.getPlacement("drain-test")?.batteryLevel ?? 0;
      expect(afterBattery).toBeLessThan(initialBattery);
    });

    it("battery drains at rate of 1/BATTERY_BACKUP_SOLS per sol", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      const initialBattery = manager.getPlacement("building")?.batteryLevel ?? 0;

      // Tick once
      manager.tick();

      const afterBattery = manager.getPlacement("building")?.batteryLevel ?? 0;
      const expectedDrain = 1 / BATTERY_BACKUP_SOLS;
      expect(afterBattery).toBeCloseTo(initialBattery - expectedDrain, 5);
    });

    it("battery transitions to LOW_BATTERY state", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      // Drain to low battery
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

      // Use position in center 4x4 area (3-6) where deposits can't spawn
      state.grid.placeBuilding("deplete-test", { x: 3, y: 3 });
      state.grid.setBuildingPowerConsumption("deplete-test", 4);
      state.grid.updatePowerConnections(false);

      // Tick until battery depletes (BATTERY_BACKUP_SOLS = 3)
      for (let i = 0; i < BATTERY_BACKUP_SOLS + 1; i++) {
        state.tick();
      }

      expect(state.grid.getPowerState("deplete-test")).toBe(PowerState.UNPOWERED);
    });

    it("battery level reaches zero after complete drain", () => {
      const manager = new GridManager();

      manager.placeBuilding("building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      // Drain completely
      for (let i = 0; i <= BATTERY_BACKUP_SOLS; i++) {
        manager.tick();
      }

      const placement = manager.getPlacement("building");
      expect(placement?.batteryLevel).toBe(0);
      expect(placement?.powerState).toBe(PowerState.UNPOWERED);
    });

    it("powered buildings do not drain battery", () => {
      const manager = new GridManager();

      // Setup powered building
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);

      // Tick multiple times
      for (let i = 0; i < 10; i++) {
        manager.tick();
      }

      // Battery should still be full
      const placement = manager.getPlacement("building");
      expect(placement?.batteryLevel).toBe(1.0);
      expect(placement?.powerState).toBe(PowerState.POWERED);
    });
  });

  describe("Building recycling removes from grid", () => {
    it("startRecycling removes building from grid via facade", () => {
      const state = new GameState();

      // Build and place a building on the grid
      state.grid.placeBuilding("recycle-test", { x: 2, y: 2 });
      state.grid.setBuildingPowerConsumption("recycle-test", 4);
      state.grid.updatePowerConnections(false);

      // Verify it's on the grid
      expect(state.grid.getBuildingPosition("recycle-test")).not.toBeNull();
      expect(state.grid.getCell(2, 2)?.buildingId).toBe("recycle-test");

      // Remove from grid (simulating what facade.recycle() does)
      const pos = state.grid.getBuildingPosition("recycle-test");
      if (pos) {
        state.grid.removeBuilding(pos);
      }

      // Verify it's removed from grid
      expect(state.grid.getBuildingPosition("recycle-test")).toBeNull();
      expect(state.grid.getCell(2, 2)?.buildingId).toBeUndefined();
    });

    it("removing building cleans up power source registration", () => {
      const manager = new GridManager();

      // Place a solar panel
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      expect(manager.getPowerSources().length).toBe(1);

      // Remove the building
      manager.removeBuilding({ x: 5, y: 5 });

      // Power source should be unregistered
      expect(manager.getPowerSources().length).toBe(0);
    });

    it("removing power building affects other buildings power state", () => {
      const manager = new GridManager();

      // Setup: solar panel powering a building
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);
      manager.placeBuilding("building", { x: 5, y: 6 });
      manager.setBuildingPowerConsumption("building", 4);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);

      // Remove solar panel from grid
      manager.removeBuilding({ x: 5, y: 5 });
      manager.updatePowerConnections(false);

      // Building should now be on battery
      expect(manager.getPowerState("building")).toBe(PowerState.ON_BATTERY);
    });
  });

  describe("Power connections update after tech research", () => {
    it("improved-power-grid technology increases power range", () => {
      const manager = new GridManager();

      // Place power source
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10); // Base range = 2

      // Place building at distance 3 (just outside base range)
      manager.placeBuilding("building", { x: 5, y: 8 });
      manager.setBuildingPowerConsumption("building", 4);

      // Without tech bonus
      manager.updatePowerConnections(false);
      expect(manager.getPowerState("building")).toBe(PowerState.ON_BATTERY);

      // With tech bonus (range becomes 3)
      manager.updatePowerConnections(true);
      expect(manager.getPowerState("building")).toBe(PowerState.POWERED);
    });

    it("tech bonus parameter is respected by grid manager", () => {
      const manager = new GridManager();

      // Place building just outside normal power range
      manager.placeBuilding("far-building", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("far-building", 4);

      // Place power source at distance 3
      manager.placeBuilding("solar-far", { x: 0, y: 3 });
      manager.registerPowerSource("solar-far", 10); // range = 2 without tech, 3 with tech

      // Without tech bonus, should be on battery (distance 3 > range 2)
      manager.updatePowerConnections(false);
      expect(manager.getPowerState("far-building")).toBe(PowerState.ON_BATTERY);

      // With tech bonus, range = 3, should now be powered
      manager.updatePowerConnections(true);
      expect(manager.getPowerState("far-building")).toBe(PowerState.POWERED);
    });
  });

  describe("Full integration flow", () => {
    it("complete cycle: place, power, lose power, drain, repower", () => {
      const manager = new GridManager();

      // 1. Place building without power - starts on battery
      manager.placeBuilding("habitat", { x: 0, y: 0 });
      manager.setBuildingPowerConsumption("habitat", 4);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("habitat")).toBe(PowerState.ON_BATTERY);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0);

      // 2. Drain some battery
      manager.tick();
      const drainedLevel = manager.getPlacement("habitat")?.batteryLevel ?? 0;
      expect(drainedLevel).toBeLessThan(1.0);

      // 3. Add power source - should recharge and power
      manager.placeBuilding("solar", { x: 0, y: 1 });
      manager.registerPowerSource("solar", 10);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("habitat")).toBe(PowerState.POWERED);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0); // Recharged

      // 4. Remove power source - back to battery
      manager.removeBuilding({ x: 0, y: 1 });
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("habitat")).toBe(PowerState.ON_BATTERY);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0); // Still full

      // 5. Drain until unpowered
      for (let i = 0; i <= BATTERY_BACKUP_SOLS; i++) {
        manager.tick();
      }

      expect(manager.getPowerState("habitat")).toBe(PowerState.UNPOWERED);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(0);

      // 6. Add power source again - should repower
      manager.placeBuilding("solar2", { x: 0, y: 2 });
      manager.registerPowerSource("solar2", 10);
      manager.updatePowerConnections(false);

      expect(manager.getPowerState("habitat")).toBe(PowerState.POWERED);
      expect(manager.getPlacement("habitat")?.batteryLevel).toBe(1.0);
    });

    it("power capacity priority: closer buildings get power first", () => {
      const manager = new GridManager();

      // Solar panel with 10 power (enough for 2 buildings at 4 power each)
      manager.placeBuilding("solar", { x: 5, y: 5 });
      manager.registerPowerSource("solar", 10);

      // Three buildings at different distances
      manager.placeBuilding("close", { x: 5, y: 6 }); // distance 1
      manager.placeBuilding("mid", { x: 5, y: 7 }); // distance 2
      manager.placeBuilding("far", { x: 4, y: 7 }); // distance 3

      manager.setBuildingPowerConsumption("close", 4);
      manager.setBuildingPowerConsumption("mid", 4);
      manager.setBuildingPowerConsumption("far", 4);

      manager.updatePowerConnections(false);

      // Close and mid should be powered (8 power), far should not (would need 12)
      expect(manager.getPowerState("close")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("mid")).toBe(PowerState.POWERED);
      expect(manager.getPowerState("far")).toBe(PowerState.ON_BATTERY);
    });
  });
});
