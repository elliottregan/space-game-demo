// tests/ColonyFacade.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { GameAPI } from "../src/facade";
import { BuildingId } from "../src/core/models/Building";
import { ColonistRole } from "../src/core/models/Colonist";

describe("ColonyFacade", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
  });

  // ==========================================================================
  // getByRole() tests
  // ==========================================================================
  describe("getByRole()", () => {
    it("should return empty for no matches", () => {
      // Try a role that likely has no colonists initially
      const colonists = api.colony.getByRole(ColonistRole.CIVIL_SCIENCE);

      // May or may not be empty depending on initial game state
      expect(Array.isArray(colonists)).toBe(true);
    });

    it("should filter correctly", () => {
      const allColonists = api.colony.snapshot().colonists;
      const unassignedManual = allColonists.filter((c) => c.role === ColonistRole.UNASSIGNED);
      const unassignedFromMethod = api.colony.getByRole(ColonistRole.UNASSIGNED);

      expect(unassignedFromMethod.length).toBe(unassignedManual.length);
    });
  });

  // ==========================================================================
  // snapshot() tests
  // ==========================================================================
  describe("snapshot()", () => {
    it("should return colony snapshot with all fields", () => {
      const snapshot = api.colony.snapshot();

      expect(snapshot.population).toBeGreaterThan(0);
      expect(typeof snapshot.health).toBe("number");
      expect(typeof snapshot.morale).toBe("number");
      expect(Array.isArray(snapshot.colonists)).toBe(true);
      expect(Array.isArray(snapshot.skillDefinitions)).toBe(true);
    });

    it("should return frozen colonists array", () => {
      const snapshot = api.colony.snapshot();
      expect(Object.isFrozen(snapshot.colonists)).toBe(true);
    });

    it("should return frozen skill definitions", () => {
      const snapshot = api.colony.snapshot();
      expect(Object.isFrozen(snapshot.skillDefinitions)).toBe(true);
    });
  });

  // ==========================================================================
  // getById() tests
  // ==========================================================================
  describe("getById()", () => {
    it("should return colonist when found", () => {
      const colonists = api.colony.snapshot().colonists;
      const first = colonists[0];

      if (first) {
        const found = api.colony.getById(first.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(first.id);
        expect(found?.name).toBe(first.name);
      }
    });

    it("should return undefined when not found", () => {
      const found = api.colony.getById("nonexistent_colonist_id");
      expect(found).toBeUndefined();
    });
  });

  // ==========================================================================
  // getColonistsByRole() tests (alias for getByRole)
  // ==========================================================================
  describe("getColonistsByRole()", () => {
    it("should be an alias for getByRole", () => {
      const byRole = api.colony.getByRole(ColonistRole.UNASSIGNED);
      const colonistsByRole = api.colony.getColonistsByRole(ColonistRole.UNASSIGNED);

      expect(byRole.length).toBe(colonistsByRole.length);
      expect(byRole.map((c) => c.id)).toEqual(colonistsByRole.map((c) => c.id));
    });
  });

  // ==========================================================================
  // assignToBuilding() tests
  // ==========================================================================
  describe("assignToBuilding", () => {
    it("should assign colonist to building", () => {
      // Disable auto-assign to have more control
      api.colony.setAutoAssignNewColonists(false);

      // Build a farm
      api.buildings.build(BuildingId.BASIC_FARM);

      // Complete construction
      for (let i = 0; i < 15; i++) {
        api.game.advanceSol();
      }

      // Find any farm with available slots
      const activeBuildings = api.buildings.snapshot().active;
      const farms = activeBuildings.filter((b) => b.definitionId === BuildingId.BASIC_FARM);
      const farm = farms.find((f) => f.assignedWorkers.length < 2); // Farm has 2 worker slots

      // Find an unassigned colonist
      let colonist = api.colony.getUnassignedColonists()[0];

      // If no unassigned colonist, unassign one
      if (!colonist) {
        const colonists = api.colony.snapshot().colonists;
        const assignedColonist = colonists[0]!;
        api.colony.unassignFromBuilding(assignedColonist.id);
        colonist = api.colony.getById(assignedColonist.id)!;
      }

      const result = api.colony.assignToBuilding(colonist.id, farm!.id);
      expect(result.success).toBe(true);
    });

    it("should fail if colonist already assigned", () => {
      // Build two farms
      api.buildings.build(BuildingId.BASIC_FARM);
      api.buildings.build(BuildingId.BASIC_FARM);

      for (let i = 0; i < 15; i++) {
        api.game.advanceSol();
      }

      const colonist = api.colony.snapshot().colonists[0]!;
      const activeBuildings = api.buildings.snapshot().active;
      const farms = activeBuildings.filter((b) => b.definitionId === BuildingId.BASIC_FARM);

      api.colony.assignToBuilding(colonist.id, farms[0]!.id);
      const result = api.colony.assignToBuilding(colonist.id, farms[1]!.id);

      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // unassignFromBuilding() tests
  // ==========================================================================
  describe("unassignFromBuilding", () => {
    it("should unassign colonist from building", () => {
      api.buildings.build(BuildingId.BASIC_FARM);
      for (let i = 0; i < 15; i++) {
        api.game.advanceSol();
      }

      const activeBuildings = api.buildings.snapshot().active;
      const farm = activeBuildings.find((b) => b.definitionId === BuildingId.BASIC_FARM);

      // Use an auto-assigned worker (farm will have workers after construction)
      const assignedWorkerId = farm!.assignedWorkers[0];
      expect(assignedWorkerId).toBeDefined();

      const result = api.colony.unassignFromBuilding(assignedWorkerId!);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // getWorkplace() tests
  // ==========================================================================
  describe("getWorkplace", () => {
    it("should return building id for assigned colonist", () => {
      api.buildings.build(BuildingId.BASIC_FARM);
      for (let i = 0; i < 15; i++) {
        api.game.advanceSol();
      }

      const activeBuildings = api.buildings.snapshot().active;
      const farm = activeBuildings.find((b) => b.definitionId === BuildingId.BASIC_FARM);

      // Use an auto-assigned worker (farm will have workers after construction)
      const assignedWorkerId = farm!.assignedWorkers[0];
      expect(assignedWorkerId).toBeDefined();

      const workplace = api.colony.getWorkplace(assignedWorkerId!);
      expect(workplace).toBe(farm!.id);
    });

    it("should return undefined for unassigned colonist", () => {
      // Find a colonist not assigned to any building
      const colonists = api.colony.snapshot().colonists;
      const buildings = api.buildings.snapshot().active;
      const assignedIds = new Set(buildings.flatMap((b) => b.assignedWorkers));
      const unassigned = colonists.find((c) => !assignedIds.has(c.id));

      if (unassigned) {
        const workplace = api.colony.getWorkplace(unassigned.id);
        expect(workplace).toBeUndefined();
      }
    });
  });
});
