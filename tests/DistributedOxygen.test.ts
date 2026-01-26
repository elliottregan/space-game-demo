import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Distributed Oxygen System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("BuildingDefinition.oxygenContribution", () => {
    it("should have oxygenContribution defined on habitat", () => {
      const habitat = gameState.buildings.getDefinition("habitat");
      expect(habitat?.oxygenContribution).toBe(2);
    });

    it("should have oxygenContribution defined on research_lab", () => {
      const lab = gameState.buildings.getDefinition("research_lab");
      expect(lab?.oxygenContribution).toBe(-1);
    });

    it("should have oxygenContribution as 0 on solar_panel", () => {
      const solar = gameState.buildings.getDefinition("solar_panel");
      expect(solar?.oxygenContribution).toBe(0);
    });

    it("should NOT have oxygen_generator building", () => {
      const oxygenGen = gameState.buildings.getDefinition("oxygen_generator");
      expect(oxygenGen).toBeUndefined();
    });
  });

  describe("BuildingManager.getTotalOxygenContribution", () => {
    it("should return 0 when no buildings exist", () => {
      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(0);
    });

    it("should sum oxygen contributions from active buildings", () => {
      // Build a habitat (+2) and basic_farm (+2)
      gameState.resources.add({ materials: 500 });

      gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);
      gameState.buildings.startBuilding("basic_farm", gameState.resources, gameState.technology);

      // Fast-forward construction (12 sols for basic_farm)
      for (let i = 0; i < 12; i++) {
        gameState.tick();
      }

      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(4); // 2 + 2
    });

    it("should include negative contributions", () => {
      gameState.resources.add({ materials: 500 });

      // Research advanced_materials for research_lab
      gameState.technology.completeResearch("advanced_materials");

      gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);
      gameState.buildings.startBuilding("research_lab", gameState.resources, gameState.technology);

      // Fast-forward construction (25 sols for research_lab)
      for (let i = 0; i < 25; i++) {
        gameState.tick();
      }

      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(1); // 2 + (-1) = 1
    });

    it("should not count broken buildings", () => {
      gameState.resources.add({ materials: 500 });

      gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);

      // Fast-forward construction
      for (let i = 0; i < 10; i++) {
        gameState.tick();
      }

      const buildings = gameState.buildings.getActiveBuildings();
      const habitat = buildings.find(b => b.definitionId === "habitat");

      // Break the building
      gameState.buildings.breakBuilding(habitat!.id, gameState.resources);

      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(0);
    });

    it("should not count pending buildings", () => {
      gameState.resources.add({ materials: 500 });

      gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);

      // Don't advance time - building is still pending
      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(0);
    });
  });
});
