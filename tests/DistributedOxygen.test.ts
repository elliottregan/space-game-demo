import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";

describe("Distributed Oxygen System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("Oxygen deficit efficiency penalty", () => {
    it("should apply 50% efficiency penalty when oxygen is negative", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed techs
      gameState.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
      gameState.technology.completeResearch(TechnologyId.ROBOTICS);

      // Build factory (-1) without any positive oxygen buildings
      // Need to build multiple factories to go negative
      gameState.buildings.startBuilding(
        BuildingId.AUTOMATED_FACTORY,
        gameState.resources,
        gameState.technology,
      );
      gameState.buildings.startBuilding(
        BuildingId.AUTOMATED_FACTORY,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction (30 sols)
      for (let i = 0; i < 30; i++) {
        gameState.tick();
      }

      // Total oxygen contribution should be -2
      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(-2);

      // Get effective production - should be penalized
      const factories = gameState.buildings
        .getActiveBuildings()
        .filter((b) => b.definitionId === BuildingId.AUTOMATED_FACTORY);

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0]!.id);

      // Base production is 15 materials, with 50% penalty should be 7.5
      expect(effectiveProd.materials).toBe(7.5);
    });

    it("should not apply penalty when oxygen is positive", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed tech for automated factory
      gameState.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
      gameState.technology.completeResearch(TechnologyId.ROBOTICS);

      // Build habitats (+2 each) to get positive oxygen, and automated factory (truly automated)
      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );
      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );
      gameState.buildings.startBuilding(
        BuildingId.AUTOMATED_FACTORY,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction (30 sols for factory)
      for (let i = 0; i < 30; i++) {
        gameState.tick();
      }

      const total = gameState.buildings.getTotalOxygenContribution();
      // 2 habitats (+2 each) + 1 factory (-1) = +3
      expect(total).toBeGreaterThan(0);

      const factories = gameState.buildings
        .getActiveBuildings()
        .filter((b) => b.definitionId === BuildingId.AUTOMATED_FACTORY);

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0]!.id);

      // Base production is 15 materials, no penalty (automated, no workers needed, oxygen positive)
      expect(effectiveProd.materials).toBe(15);
    });
  });

  describe("BuildingDefinition.oxygenContribution", () => {
    it("should have oxygenContribution defined on habitat", () => {
      const habitat = gameState.buildings.getDefinition(BuildingId.HABITAT);
      expect(habitat?.oxygenContribution).toBe(2);
    });

    it("should have oxygenContribution defined on research_lab", () => {
      const lab = gameState.buildings.getDefinition(BuildingId.RESEARCH_LAB);
      expect(lab?.oxygenContribution).toBe(-1);
    });

    it("should have oxygenContribution as 0 on solar_panel", () => {
      const solar = gameState.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      expect(solar?.oxygenContribution).toBe(0);
    });

    it("should have oxygen_generator building with production", () => {
      const oxygenGen = gameState.buildings.getDefinition("oxygen_generator" as BuildingId);
      expect(oxygenGen).toBeDefined();
      expect(oxygenGen?.production?.oxygen).toBe(5);
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

      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );
      gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );

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
      gameState.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);

      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );
      gameState.buildings.startBuilding(
        BuildingId.RESEARCH_LAB,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction (25 sols for research_lab)
      for (let i = 0; i < 25; i++) {
        gameState.tick();
      }

      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(1); // 2 + (-1) = 1
    });

    it("should not count broken buildings", () => {
      gameState.resources.add({ materials: 500 });

      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction
      for (let i = 0; i < 10; i++) {
        gameState.tick();
      }

      const buildings = gameState.buildings.getActiveBuildings();
      const habitat = buildings.find((b) => b.definitionId === BuildingId.HABITAT);

      // Break the building
      gameState.buildings.breakBuilding(habitat!.id, gameState.resources);

      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(0);
    });

    it("should not count pending buildings", () => {
      gameState.resources.add({ materials: 500 });

      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );

      // Don't advance time - building is still pending
      const total = gameState.buildings.getTotalOxygenContribution();
      expect(total).toBe(0);
    });
  });
});
