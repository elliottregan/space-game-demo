import { describe, it, expect } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { ProjectId } from "../src/core/models/NPCInfluence";

describe("Victory Megastructures Integration", () => {
  it("should not allow building megastructure without capstone project", () => {
    const state = new GameState();

    // Give plenty of resources
    state.resources.add({ materials: 1000, power: 500 });

    // Try to build Generation Ship without completing project
    const canBuild = state.buildings.canBuild(
      BuildingId.GENERATION_SHIP,
      state.resources,
      state.technology,
    );

    expect(canBuild).toBe(false);
  });

  it("should allow building megastructure after capstone project completed", () => {
    const state = new GameState();

    // Give plenty of resources
    state.resources.add({ materials: 1000, power: 500 });

    // Complete the capstone project
    state.ideology.completeProject(ProjectId.RETURN_MISSION);

    // Now should be able to build
    const canBuild = state.buildings.canBuild(
      BuildingId.GENERATION_SHIP,
      state.resources,
      state.technology,
    );

    expect(canBuild).toBe(true);
  });

  it("should trigger victory when megastructure completes", () => {
    const state = new GameState();

    // Setup: complete project and give resources
    state.ideology.completeProject(ProjectId.RETURN_MISSION);
    state.resources.add({ materials: 1000 });

    // Start building
    const building = state.buildings.startBuilding(
      BuildingId.GENERATION_SHIP,
      state.resources,
      state.technology,
    );
    expect(building).not.toBeNull();

    // Fast-forward construction (40 sols)
    let victoryEvent = null;
    for (let i = 0; i < 50; i++) {
      const events = state.tick();
      const victory = events.find((e) => e.type === "VICTORY");
      if (victory) {
        victoryEvent = victory;
        break;
      }
    }

    expect(victoryEvent).not.toBeNull();
    expect(state.victory.getState().status).toBe("victory");
    expect(state.victory.getState().reason).toContain("Generation Ship");
  });

  it("should include building name in victory message", () => {
    const state = new GameState();

    // Setup for Space Elevator
    state.ideology.completeProject(ProjectId.PLANETARY_ACQUISITION);
    state.resources.add({ materials: 500, power: 200 });

    // Start building
    state.buildings.startBuilding(BuildingId.SPACE_ELEVATOR, state.resources, state.technology);

    // Fast-forward construction (30 sols)
    for (let i = 0; i < 35; i++) {
      state.tick();
    }

    expect(state.victory.getState().status).toBe("victory");
    expect(state.victory.getState().reason).toContain("Space Elevator");
  });
});
