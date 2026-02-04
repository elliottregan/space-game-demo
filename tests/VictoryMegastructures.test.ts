import { describe, it, expect } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { ProjectId } from "../src/core/models/NPCInfluence";

describe("Victory Megastructures Integration", () => {
  it("should not allow building megastructure without capstone project", () => {
    const state = new GameState();

    // Give plenty of resources
    state.resources.add({ materials: 1000 });

    // Try to build Asteroid Mining Platform without completing project
    const canBuild = state.buildings.canBuild(
      BuildingId.ASTEROID_MINING_PLATFORM,
      state.resources,
      state.technology,
    );

    expect(canBuild).toBe(false);
  });

  it("should allow building megastructure after capstone project completed", () => {
    const state = new GameState();

    // Give plenty of resources
    state.resources.add({ materials: 1000 });

    // Complete the capstone project
    // Asteroid Mining Platform is unlocked by Corporate Interests' DEEP_SPACE_MINING_CHARTER
    state.ideology.completeProject(ProjectId.DEEP_SPACE_MINING_CHARTER);

    // Now should be able to build
    const canBuild = state.buildings.canBuild(
      BuildingId.ASTEROID_MINING_PLATFORM,
      state.resources,
      state.technology,
    );

    expect(canBuild).toBe(true);
  });

  it("should trigger victory when megastructure completes", () => {
    const state = new GameState();

    // Setup: complete project and give resources
    // Asteroid Mining Platform is unlocked by Corporate Interests' DEEP_SPACE_MINING_CHARTER
    state.ideology.completeProject(ProjectId.DEEP_SPACE_MINING_CHARTER);
    state.resources.add({ materials: 1000 });

    // Start building
    const building = state.buildings.startBuilding(
      BuildingId.ASTEROID_MINING_PLATFORM,
      state.resources,
      state.technology,
    );
    expect(building).not.toBeNull();

    // Fast-forward construction (115 sols for Asteroid Mining Platform)
    let victoryEvent = null;
    for (let i = 0; i < 120; i++) {
      const events = state.tick();
      const victory = events.find((e) => e.type === "VICTORY");
      if (victory) {
        victoryEvent = victory;
        break;
      }
    }

    expect(victoryEvent).not.toBeNull();
    expect(state.victory.getState().status).toBe("victory");
    expect(state.victory.getState().reason).toContain("Asteroid Mining Platform");
  });

  it("should include building name in victory message", () => {
    const state = new GameState();

    // Setup for Space Elevator
    // Space Elevator is unlocked by Earth Loyalists' EARTH_RELIEF_COMPACT
    state.ideology.completeProject(ProjectId.EARTH_RELIEF_COMPACT);
    state.resources.add({ materials: 500 });

    // Start building
    state.buildings.startBuilding(BuildingId.SPACE_ELEVATOR, state.resources, state.technology);

    // Fast-forward construction (105 sols for Space Elevator)
    for (let i = 0; i < 110; i++) {
      state.tick();
    }

    expect(state.victory.getState().status).toBe("victory");
    expect(state.victory.getState().reason).toContain("Space Elevator");
  });
});
