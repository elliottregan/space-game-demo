import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Distributed Oxygen System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("Oxygen deficit efficiency penalty", () => {
    it("should apply 50% efficiency penalty when oxygen is negative", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed techs
      gameState.technology.completeResearch("advanced_materials");
      gameState.technology.completeResearch("robotics");

      // Build factory (-1) without any positive oxygen buildings
      // Need to build multiple factories to go negative
      gameState.buildings.startBuilding("automated_factory", gameState.resources, gameState.technology);
      gameState.buildings.startBuilding("automated_factory", gameState.resources, gameState.technology);

      // Fast-forward construction (30 sols)
      for (let i = 0; i < 30; i++) {
        gameState.tick();
      }

      // Total oxygen contribution should be -2
      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(-2);

      // Get effective production - should be penalized
      const factories = gameState.buildings.getActiveBuildings()
        .filter(b => b.definitionId === "automated_factory");

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0].id);

      // Base production is 15 materials, with 50% penalty should be 7.5
      expect(effectiveProd.materials).toBe(7.5);
    });

    it("should not apply penalty when oxygen is positive", () => {
      gameState.resources.add({ materials: 500 });

      // Build habitat (+2) and solar panel (no workerSlots, oxygenContribution: 0)
      gameState.buildings.startBuilding("habitat", gameState.resources, gameState.technology);
      gameState.buildings.startBuilding("solar_panel", gameState.resources, gameState.technology);

      // Fast-forward construction
      for (let i = 0; i < 10; i++) {
        gameState.tick();
      }

      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBeGreaterThan(0); // From habitat (+2)

      const solarPanels = gameState.buildings.getActiveBuildings()
        .filter(b => b.definitionId === "solar_panel");

      const effectiveProd = gameState.buildings.getEffectiveProduction(solarPanels[0].id);

      // Base production is 10 power, no penalty (solar panels don't require workers)
      expect(effectiveProd.power).toBe(10);
    });
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
