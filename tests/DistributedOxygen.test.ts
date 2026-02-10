import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";

describe("Life Support System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("Life support efficiency penalty", () => {
    it("should apply 50% efficiency penalty when life support efficiency is set low", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed techs
      gameState.technology.completeResearch(TechnologyId.HABITAT_FABRICATION);
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

      // Get effective production - should be penalized when life support efficiency is low
      const factories = gameState.buildings
        .getActiveBuildings()
        .filter((b) => b.definitionId === BuildingId.AUTOMATED_FACTORY);

      // Set life support efficiency to 50%
      gameState.buildings.setLifeSupportEfficiency(0.5);

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0]!.id);

      // Base production is 12 materials, with 50% penalty should be 6
      expect(effectiveProd.materials).toBe(6);
    });

    it("should not apply penalty when life support efficiency is full", () => {
      gameState.resources.add({ materials: 1000 });

      // Research needed tech for automated factory
      gameState.technology.completeResearch(TechnologyId.HABITAT_FABRICATION);
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

      // Life support efficiency defaults to 1.0
      gameState.buildings.setLifeSupportEfficiency(1.0);

      const effectiveProd = gameState.buildings.getEffectiveProduction(factories[0]!.id);

      // Base production is 12 materials, no penalty (automated, no workers needed, life support full)
      expect(effectiveProd.materials).toBe(12);
    });
  });

  describe("BuildingDefinition.lifeSupportCapacity and lifeSupportLoad", () => {
    it("should have lifeSupportLoad defined on research_lab", () => {
      const lab = gameState.buildings.getDefinition(BuildingId.RESEARCH_LAB);
      expect(lab?.lifeSupportLoad).toBe(1);
    });

    it("should have no lifeSupportCapacity or lifeSupportLoad on solar_panel", () => {
      const solar = gameState.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      expect(solar?.lifeSupportCapacity).toBeUndefined();
      expect(solar?.lifeSupportLoad).toBeUndefined();
    });

    it("should have lifeSupportLoad on basic_mine", () => {
      const mine = gameState.buildings.getDefinition(BuildingId.BASIC_MINE);
      expect(mine?.lifeSupportLoad).toBe(1);
    });
  });

  describe("BuildingManager.getTotalLifeSupportCapacity and getTotalLifeSupportLoad", () => {
    it("should return zero life support capacity when no buildings provide it", () => {
      // No starting buildings provide lifeSupportCapacity (HABITAT was removed)
      const totalCapacity = gameState.buildings.getTotalLifeSupportCapacity();
      expect(totalCapacity).toBe(0);
    });

    it("should return starting buildings life support load", () => {
      // Default starting condition has: 1 basic mine (lifeSupportLoad: 1) = 1
      const totalLoad = gameState.buildings.getTotalLifeSupportLoad();
      expect(totalLoad).toBe(1);
    });

    it("should sum life support load from active buildings", () => {
      // Starting load is 1 (1 basic mine * 1)
      gameState.resources.add({ materials: 500 });

      // Research habitat_fabrication for research_lab
      gameState.technology.completeResearch(TechnologyId.HABITAT_FABRICATION);

      gameState.buildings.startBuilding(
        BuildingId.RESEARCH_LAB,
        gameState.resources,
        gameState.technology,
      );

      // Fast-forward construction (25 sols for research_lab)
      for (let i = 0; i < 25; i++) {
        gameState.tick();
      }

      const totalLoad = gameState.buildings.getTotalLifeSupportLoad();
      expect(totalLoad).toBe(2); // 1 + 1
    });

    it("should not count broken buildings in load", () => {
      // Starting load is 1 (basic mine)
      const startingLoad = gameState.buildings.getTotalLifeSupportLoad();
      expect(startingLoad).toBe(1);

      // Get the starting basic mine and break it
      const buildings = gameState.buildings.getActiveBuildings();
      const mine = buildings.find((b) => b.definitionId === BuildingId.BASIC_MINE);

      gameState.buildings.breakBuilding(mine!.id, gameState.resources);

      const totalLoad = gameState.buildings.getTotalLifeSupportLoad();
      expect(totalLoad).toBe(0); // Broken mine doesn't contribute load
    });

    it("should not count pending buildings in load", () => {
      // Starting load is 1 (basic mine)
      const startingLoad = gameState.buildings.getTotalLifeSupportLoad();
      expect(startingLoad).toBe(1);

      gameState.resources.add({ materials: 500 });
      gameState.technology.completeResearch(TechnologyId.HABITAT_FABRICATION);

      gameState.buildings.startBuilding(
        BuildingId.RESEARCH_LAB,
        gameState.resources,
        gameState.technology,
      );

      // Don't advance time - new building is still pending
      const totalLoad = gameState.buildings.getTotalLifeSupportLoad();
      expect(totalLoad).toBe(1); // Still 1, pending building doesn't count
    });
  });
});
