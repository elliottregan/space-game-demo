import { describe, expect, it } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("GameState - Grid Integration", () => {
  it("GameState has grid manager", () => {
    const state = new GameState();
    expect(state.grid).toBeDefined();
  });

  it("GameState initializes grid with deposits", () => {
    const state = new GameState();
    const deposits = state.grid.getAllDeposits();
    expect(deposits.length).toBeGreaterThan(0);
  });

  it("starting buildings are placed on grid", () => {
    const state = new GameState();

    // Should have at least solar panel placed
    const solarBuildings = state.buildings
      .getActiveBuildings()
      .filter((b) => b.definitionId === "solar_panel");

    expect(solarBuildings.length).toBeGreaterThan(0);
    const pos = state.grid.getBuildingPosition(solarBuildings[0].id);
    expect(pos).not.toBeNull();
  });

  it("game tick updates grid power state", () => {
    const state = new GameState();

    // Place building at grid edge, far from starting buildings (grid is 10x10, so 0-9 valid)
    state.grid.placeBuilding("test-building", { x: 9, y: 9 });
    state.grid.setBuildingPowerConsumption("test-building", 4);
    state.grid.updatePowerConnections(false);

    const initialBattery = state.grid.getPlacement("test-building")?.batteryLevel;
    expect(initialBattery).toBeDefined();

    state.tick();

    const afterBattery = state.grid.getPlacement("test-building")?.batteryLevel;
    expect(afterBattery).toBeDefined();
    expect(afterBattery).toBeLessThan(initialBattery!);
  });
});
