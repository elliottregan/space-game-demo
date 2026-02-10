import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import { TechnologyId } from "../src/core/models/Technology";

describe("Job Assignment", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
    // Wire up colonistQueries for worker efficiency tests
    gameState.buildings.setColonistQueries(gameState.colony);
  });

  describe("getColonistWorkplace", () => {
    it("returns undefined for unassigned colonist", () => {
      const colonist = gameState.colony.getColonists()[0]!;
      const workplace = gameState.workforce.getColonistWorkplace(colonist.id, gameState.buildings);
      expect(workplace).toBeUndefined();
    });

    it("returns building id when colonist is assigned", () => {
      // Build a basic farm (has workerSlots)
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      expect(farm).not.toBeNull();

      // Complete construction (workers are auto-assigned)
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Use the auto-assigned worker
      const building = gameState.buildings.getBuilding(farm!.id)!;
      const colonistId = building.assignedWorkers[0]!;

      const workplace = gameState.workforce.getColonistWorkplace(colonistId, gameState.buildings);
      expect(workplace).toBe(farm!.id);
    });
  });

  describe("getStaffingEfficiency", () => {
    it("returns 0 for building with no workers when slots required", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Remove auto-assigned workers to test unstaffed state
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      expect(efficiency).toBe(0);
    });

    it("returns 1 for building without worker slots", () => {
      const solar = gameState.buildings.startBuilding(
        BuildingId.SOLAR_PANEL,
        gameState.resources,
        gameState.technology,
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
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Remove auto-assigned workers, then assign just 1 of 2 (50% staffing)
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      const colonist = gameState.colony.getColonists()[0]!;
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      // Formula: 1 - (1 - 0.5)^1.5 ≈ 0.646
      expect(efficiency).toBeCloseTo(0.646, 2);
    });

    it("returns 1 for fully staffed building", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 2 of 2 workers (100% staffing)
      const colonists = gameState.colony.getColonists();
      gameState.buildings.assignWorker(farm!.id, colonists[0]!.id);
      gameState.buildings.assignWorker(farm!.id, colonists[1]!.id);

      const efficiency = gameState.buildings.getStaffingEfficiency(farm!.id);
      expect(efficiency).toBe(1);
    });
  });

  describe("staffing affects production", () => {
    it("unstaffed building with worker slots produces nothing", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Remove auto-assigned workers to test unstaffed state
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      const production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBe(0);
    });

    it("fully staffed building produces at full rate", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Assign 2 of 2 workers
      const colonists = gameState.colony.getColonists();
      // Find farmers for best efficiency
      const farmers = colonists.filter((c) => c.role === ColonistRole.FARMING);
      if (farmers.length >= 2) {
        gameState.buildings.assignWorker(farm!.id, farmers[0]!.id);
        gameState.buildings.assignWorker(farm!.id, farmers[1]!.id);
      } else {
        gameState.buildings.assignWorker(farm!.id, colonists[0]!.id);
        gameState.buildings.assignWorker(farm!.id, colonists[1]!.id);
      }

      const production = gameState.buildings.getEffectiveProduction(farm!.id);
      // Basic farm produces 10 food, staffing multiplier = 1
      // Worker efficiency depends on colonist stats
      expect(production.food).toBeGreaterThan(0);
    });
  });

  describe("getWorkerEfficiency", () => {
    it("returns 1 for building without worker slots", () => {
      // Automated Factory is truly automated with no worker slots
      gameState.technology.completeResearch(TechnologyId.HABITAT_FABRICATION);
      gameState.technology.completeResearch(TechnologyId.ROBOTICS);

      const factory = gameState.buildings.startBuilding(
        BuildingId.AUTOMATED_FACTORY,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 35; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const efficiency = gameState.buildings.getWorkerEfficiency(factory!.id);
      expect(efficiency).toBe(1);
    });

    it("returns 1 for building with no workers assigned", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Remove auto-assigned workers to test empty state
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
      expect(efficiency).toBe(1); // No workers = base efficiency (staffing handles the 0)
    });

    it("applies role mismatch penalty", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
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
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Start training a colonist
      const colonist = gameState.colony.getColonists()[0]!;
      gameState.workforce.startTraining(colonist, ColonistRole.FARMING);
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const efficiency = gameState.buildings.getWorkerEfficiency(farm!.id);
      // Should include 50% training penalty
      expect(efficiency).toBeLessThan(1);
    });
  });

  describe("assignment validation", () => {
    it("prevents assigning colonist to multiple buildings", () => {
      // Build two farms
      const farm1 = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      const farm2 = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );

      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear auto-assigned workers from both buildings
      const building1 = gameState.buildings.getBuilding(farm1!.id)!;
      const building2 = gameState.buildings.getBuilding(farm2!.id)!;
      for (const workerId of [...building1.assignedWorkers]) {
        gameState.buildings.removeWorker(farm1!.id, workerId);
      }
      for (const workerId of [...building2.assignedWorkers]) {
        gameState.buildings.removeWorker(farm2!.id, workerId);
      }

      const colonist = gameState.colony.getColonists()[0]!;

      // Assign to first farm
      const result1 = gameState.buildings.assignWorker(farm1!.id, colonist.id);
      expect(result1.length).toBeGreaterThan(0);

      // Try to assign to second farm - should fail
      const result2 = gameState.buildings.assignWorker(farm2!.id, colonist.id);
      expect(result2.length).toBe(0);
    });
  });

  describe("colonist death", () => {
    it("removes colonist from building assignment on death", () => {
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Get a colonist that was auto-assigned to the farm
      const building = gameState.buildings.getBuilding(farm!.id)!;
      const colonistId = building.assignedWorkers[0]!;
      const colonist = gameState.colony.getColonist(colonistId)!;

      // Verify assignment
      expect(building.assignedWorkers).toContain(colonist.id);

      // Kill the colonist (simulate via removeColonist if available, or direct manipulation)
      gameState.colony.removeColonist(colonist.id, gameState.buildings);

      // Verify unassigned
      const updatedBuilding = gameState.buildings.getBuilding(farm!.id);
      expect(updatedBuilding?.assignedWorkers).not.toContain(colonist.id);
    });
  });

  describe("labor pool bonus", () => {
    it("unassigned colonists boost construction speed", () => {
      // First tick: auto-assigns workers during colony phase
      gameState.tick();
      // Second tick: pretick computes labor pool bonus from stable assignments
      gameState.tick();

      // Count unassigned colonists (now stable after auto-assignment)
      const colonists = gameState.colony.getColonists();
      const assignedIds = new Set<string>();
      for (const building of gameState.buildings.getBuildings()) {
        for (const id of building.assignedWorkers) {
          assignedIds.add(id);
        }
      }
      const unassignedCount = colonists.filter((c) => !assignedIds.has(c.id)).length;

      // Expected bonus: 2% per unassigned, capped at 20%
      const expectedBonus = Math.min(unassignedCount * 0.02, 0.2);

      // Verify the bonus reflects the stabilized unassigned count
      expect(gameState.getConstructionSpeedBonus()).toBeCloseTo(expectedBonus, 2);
    });
  });

  describe("integration", () => {
    it("full workflow: assign, produce, unassign", () => {
      // Build farm
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology,
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Remove auto-assigned workers to test manual workflow
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      // Initially no production (no workers)
      let production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBe(0);

      // Assign worker
      const colonist = gameState.colony.getColonists()[0]!;
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      // Now has production
      production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBeGreaterThan(0);

      // Unassign worker
      gameState.buildings.removeWorker(farm!.id, colonist.id);

      // Back to no production
      production = gameState.buildings.getEffectiveProduction(farm!.id);
      expect(production.food).toBe(0);
    });
  });
});
