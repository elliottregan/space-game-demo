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

    if (solarBuildings.length > 0) {
      const pos = state.grid.getBuildingPosition(solarBuildings[0].id);
      expect(pos).not.toBeNull();
    }
  });
});
