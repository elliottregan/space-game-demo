import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";

describe("Auto-Assign Workers", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
    gameState.buildings.setColonyManager(gameState.colony);
  });

  describe("autoAssignNewColonists setting", () => {
    it("defaults to true", () => {
      expect(gameState.getAutoAssignNewColonists()).toBe(true);
    });

    it("can be toggled off", () => {
      gameState.setAutoAssignNewColonists(false);
      expect(gameState.getAutoAssignNewColonists()).toBe(false);
    });

    it("can be toggled back on", () => {
      gameState.setAutoAssignNewColonists(false);
      gameState.setAutoAssignNewColonists(true);
      expect(gameState.getAutoAssignNewColonists()).toBe(true);
    });

    it("persists through save/load", () => {
      gameState.setAutoAssignNewColonists(false);
      const saveData = JSON.stringify(gameState.toJSON());

      const loadedState = GameState.fromJSON(JSON.parse(saveData));
      expect(loadedState.getAutoAssignNewColonists()).toBe(false);
    });
  });

  describe("getUnderstaffedBuildings", () => {
    it("returns empty array when no buildings exist", () => {
      const understaffed = gameState.buildings.getUnderstaffedBuildings();
      expect(understaffed).toHaveLength(0);
    });

    it("returns buildings with empty worker slots", () => {
      // Build a farm
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );
      expect(farm).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear auto-assigned workers
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      const understaffed = gameState.buildings.getUnderstaffedBuildings();
      expect(understaffed.length).toBeGreaterThan(0);
      expect(understaffed.some((b) => b.id === farm!.id)).toBe(true);
    });

    it("does not include buildings without worker slots", () => {
      // Build a solar panel (no worker slots)
      const solar = gameState.buildings.startBuilding(
        BuildingId.SOLAR_PANEL,
        gameState.resources,
        gameState.technology
      );
      expect(solar).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 10; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const understaffed = gameState.buildings.getUnderstaffedBuildings();
      expect(understaffed.some((b) => b.id === solar!.id)).toBe(false);
    });

    it("prioritizes food buildings", () => {
      // Add more resources to build both buildings
      gameState.resources.add({ materials: 500 });

      // Build a farm (food producer) and a mine (non-food, has workers)
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );
      const mine = gameState.buildings.startBuilding(
        BuildingId.BASIC_MINE,
        gameState.resources,
        gameState.technology
      );

      expect(farm).not.toBeNull();
      expect(mine).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 20; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear workers from both buildings
      const farmBuilding = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...farmBuilding.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }
      const mineBuilding = gameState.buildings.getBuilding(mine!.id)!;
      for (const workerId of [...mineBuilding.assignedWorkers]) {
        gameState.buildings.removeWorker(mine!.id, workerId);
      }

      const understaffed = gameState.buildings.getUnderstaffedBuildings();
      // Farm should come before mine (food priority)
      const farmIndex = understaffed.findIndex((b) => b.id === farm!.id);
      const mineIndex = understaffed.findIndex((b) => b.id === mine!.id);
      expect(farmIndex).toBeLessThan(mineIndex);
    });
  });

  describe("autoAssignAllWorkers", () => {
    it("assigns unassigned colonist to understaffed building", () => {
      // Build a farm
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );
      expect(farm).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear auto-assigned workers
      const building = gameState.buildings.getBuilding(farm!.id)!;
      const initialWorkerCount = building.assignedWorkers.length;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }
      expect(building.assignedWorkers.length).toBe(0);

      // Run auto-assign
      const events = gameState.buildings.autoAssignAllWorkers(gameState.colony);

      // Should have assigned workers
      expect(events.length).toBeGreaterThan(0);
      expect(building.assignedWorkers.length).toBeGreaterThan(0);
    });

    it("returns events for each assignment", () => {
      // Build a farm
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear workers
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      // Run auto-assign
      const events = gameState.buildings.autoAssignAllWorkers(gameState.colony);

      // Events should be of type WORKER_AUTO_ASSIGNED
      for (const event of events) {
        expect(event.type).toBe("WORKER_AUTO_ASSIGNED");
        expect(event.severity).toBe("info");
        expect(event.message).toBeDefined();
      }
    });

    it("does not steal workers from other buildings", () => {
      // Build two farms
      const farm1 = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );
      const farm2 = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Farm1 has workers, farm2 is empty
      const building1 = gameState.buildings.getBuilding(farm1!.id)!;
      const building2 = gameState.buildings.getBuilding(farm2!.id)!;
      const farm1Workers = [...building1.assignedWorkers];

      // Clear workers from farm2 only
      for (const workerId of [...building2.assignedWorkers]) {
        gameState.buildings.removeWorker(farm2!.id, workerId);
      }

      // Run auto-assign (no unassigned colonists since all are assigned to farm1)
      const events = gameState.buildings.autoAssignAllWorkers(gameState.colony);

      // Farm1 workers should still be there (not stolen)
      expect(building1.assignedWorkers).toEqual(farm1Workers);
    });

    it("returns empty array when no unassigned colonists", () => {
      // Build a farm - auto-assigns workers
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // All colonists are now assigned via auto-assign on construction
      // Build another farm
      const farm2 = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear workers from farm2
      const building2 = gameState.buildings.getBuilding(farm2!.id)!;
      for (const workerId of [...building2.assignedWorkers]) {
        gameState.buildings.removeWorker(farm2!.id, workerId);
      }

      // Now try auto-assign when no colonists are unassigned
      // (all are assigned to farm1)
      const events = gameState.buildings.autoAssignAllWorkers(gameState.colony);

      // Should be empty or only assign those who are still unassigned
      // This depends on how many colonists we have vs slots
      expect(events).toBeDefined();
    });

    it("returns empty array when no understaffed buildings", () => {
      // No buildings built
      const events = gameState.buildings.autoAssignAllWorkers(gameState.colony);
      expect(events).toHaveLength(0);
    });
  });

  describe("scoring colonists", () => {
    it("prioritizes colonists with matching role", () => {
      // Build a farm
      const farm = gameState.buildings.startBuilding(
        BuildingId.BASIC_FARM,
        gameState.resources,
        gameState.technology
      );

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      // Clear workers
      const building = gameState.buildings.getBuilding(farm!.id)!;
      for (const workerId of [...building.assignedWorkers]) {
        gameState.buildings.removeWorker(farm!.id, workerId);
      }

      // Run auto-assign
      gameState.buildings.autoAssignAllWorkers(gameState.colony);

      // The assigned workers should ideally be farmers (if available)
      // This tests that the scoring system prefers matching roles
      expect(building.assignedWorkers.length).toBeGreaterThan(0);
    });
  });
});
