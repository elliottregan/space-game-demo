import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";

describe("Distributed Oxygen System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("Air quality efficiency penalty", () => {
    it("should apply 50% efficiency penalty when air quality efficiency is set low", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed techs
      gameState.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
      gameState.technology.completeResearch(TechnologyId.ROBOTICS);

      // Build factory
      gameState.buildings.startBuilding(
        BuildingId.AUTOMATED_FACTORY,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction (30 sols)
      for (let i = 0; i < 30; i++) {
        gameState.tick();
      }

      // Get effective production - should be penalized when air quality efficiency is low
      const factories = gameState.buildings
        .getActiveBuildings()
        .filter((b) => b.definitionId === BuildingId.AUTOMATED_FACTORY);

      // Set air quality efficiency to 50%
      gameState.buildings.setAirQualityEfficiency(0.5);

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0]!.id);

      // Base production is 15 materials, with 50% penalty should be 7.5
      expect(effectiveProd.materials).toBe(7.5);
    });

    it("should not apply penalty when air quality efficiency is full", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed tech for automated factory
      gameState.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
      gameState.technology.completeResearch(TechnologyId.ROBOTICS);

      // Build automated factory (truly automated)
      gameState.buildings.startBuilding(
        BuildingId.AUTOMATED_FACTORY,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction (30 sols for factory)
      for (let i = 0; i < 30; i++) {
        gameState.tick();
      }

      const factories = gameState.buildings
        .getActiveBuildings()
        .filter((b) => b.definitionId === BuildingId.AUTOMATED_FACTORY);

      // Air quality efficiency defaults to 1.0
      gameState.buildings.setAirQualityEfficiency(1.0);

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0]!.id);

      // Base production is 15 materials, no penalty (automated, no workers needed, air quality full)
      expect(effectiveProd.materials).toBe(15);
    });
  });

  describe("BuildingDefinition.airContribution", () => {
    it("should have airContribution defined on habitat", () => {
      const habitat = gameState.buildings.getDefinition(BuildingId.HABITAT);
      expect(habitat?.airContribution).toBe(2);
    });

    it("should have airContribution defined on research_lab", () => {
      const lab = gameState.buildings.getDefinition(BuildingId.RESEARCH_LAB);
      expect(lab?.airContribution).toBe(-1);
    });

    it("should have airContribution as 0 on solar_panel", () => {
      const solar = gameState.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      expect(solar?.airContribution).toBe(0);
    });

    it("should have oxygen_generator building with oxygen contribution", () => {
      const oxygenGen = gameState.buildings.getDefinition("oxygen_generator" as BuildingId);
      expect(oxygenGen).toBeDefined();
      expect(oxygenGen?.airContribution).toBe(5);
    });
  });

  describe("BuildingManager.getTotalAirContribution", () => {
    it("should return starting buildings oxygen contribution", () => {
      // Default starting condition has: 1 habitat (+2), 1 farm (+2), 1 oxygen generator (+5), 1 basic mine (-2) = 7
      const total = gameState.buildings.getTotalAirContribution();
      expect(total).toBe(7);
    });

    it("should sum oxygen contributions from active buildings", () => {
      // Starting contribution is 7 (habitat +2, farm +2, oxygen generator +5, basic mine -2)
      const startingOxygen = gameState.buildings.getTotalAirContribution();
      expect(startingOxygen).toBe(7);

      // Build another habitat (+2) and basic_farm (+2)
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

      const total = gameState.buildings.getTotalAirContribution();
      expect(total).toBe(11); // 7 + 2 + 2
    });

    it("should include negative contributions", () => {
      // Starting contribution is 7
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

      const total = gameState.buildings.getTotalAirContribution();
      expect(total).toBe(8); // 7 + 2 + (-1) = 8
    });

    it("should not count broken buildings", () => {
      // Starting contribution is 7
      const startingOxygen = gameState.buildings.getTotalAirContribution();
      expect(startingOxygen).toBe(7);

      // Get a starting habitat and break it
      const buildings = gameState.buildings.getActiveBuildings();
      const habitat = buildings.find((b) => b.definitionId === BuildingId.HABITAT);

      // Break the building
      gameState.buildings.breakBuilding(habitat!.id, gameState.resources);

      const total = gameState.buildings.getTotalAirContribution();
      expect(total).toBe(5); // 7 - 2 = 5 (broken habitat doesn't contribute)
    });

    it("should not count pending buildings", () => {
      // Starting contribution is 7
      const startingOxygen = gameState.buildings.getTotalAirContribution();
      expect(startingOxygen).toBe(7);

      gameState.resources.add({ materials: 500 });

      gameState.buildings.startBuilding(
        BuildingId.HABITAT,
        gameState.resources,
        gameState.technology,
      );

      // Don't advance time - new building is still pending
      const total = gameState.buildings.getTotalAirContribution();
      expect(total).toBe(7); // Still 7, pending building doesn't count
    });
  });
});
