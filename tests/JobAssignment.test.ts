import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

describe("Job Assignment", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
    // Wire up colonyManager for worker efficiency tests
    gameState.buildings.setColonyManager(gameState.colony);
  });

  describe("getColonistWorkplace", () => {
    it("returns undefined for unassigned colonist", () => {
      const colonist = gameState.colony.getColonists()[0];
      const workplace = gameState.workforce.getColonistWorkplace(
        colonist.id,
        gameState.buildings
      );
      expect(workplace).toBeUndefined();
    });

    it("returns building id when colonist is assigned", () => {
      // Build a basic farm (has workerSlots)
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      expect(farm).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const workplace = gameState.workforce.getColonistWorkplace(
        colonist.id,
        gameState.buildings
      );
      expect(workplace).toBe(farm!.id);
    });
  });

  describe("getStaffingEfficiency", () => {
    it("returns 0 for building with no workers when slots required", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      expect(efficiency).toBe(0);
    });

    it("returns 1 for building without worker slots", () => {
      const solar = gameState.buildings.startBuilding(
        "solar_panel",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 10; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getStaffingEfficiency(solar!.id);
      expect(efficiency).toBe(1);
    });

    it("returns diminishing returns value for partial staffing", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 1 of 2 workers (50% staffing)
      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      // Formula: 1 - (1 - 0.5)^1.5 ≈ 0.646
      expect(efficiency).toBeCloseTo(0.646, 2);
    });

    it("returns 1 for fully staffed building", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 2 of 2 workers (100% staffing)
      const colonists = gameState.colony.getColonists();
      gameState.buildings.assignWorker(farm!.id, colonists[0].id);
      gameState.buildings.assignWorker(farm!.id, colonists[1].id);

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      expect(efficiency).toBe(1);
    });
  });

  describe("getWorkerEfficiency", () => {
    it("returns 1 for building without worker slots", () => {
      const solar = gameState.buildings.startBuilding(
        "solar_panel",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 10; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getWorkerEfficiency(solar!.id);
      expect(efficiency).toBe(1);
    });

    it("returns 1 for building with no workers assigned", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
      expect(efficiency).toBe(1); // No workers = base efficiency (staffing handles the 0)
    });

    it("applies role mismatch penalty", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Find a non-farmer colonist
      const colonists = gameState.colony.getColonists();
      const nonFarmer = colonists.find((c) => c.role !== ColonistRole.FARMING);
      if (nonFarmer) {
        gameState.buildings.assignWorker(farm!.id, nonFarmer.id);
        const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
        // Should include 30% role mismatch penalty: base * 0.7
        expect(efficiency).toBeLessThan(1);
      }
    });

    it("applies training penalty", () => {
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Start training a colonist
      const colonist = gameState.colony.getColonists()[0];
      gameState.workforce.startTraining(colonist, ColonistRole.FARMING);
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
      // Should include 50% training penalty
      expect(efficiency).toBeLessThan(1);
    });
  });
});
