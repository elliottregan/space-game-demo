import { describe, expect, it, beforeEach } from "bun:test";
import { GridManager } from "../src/core/systems/GridManager";
import { BuildingId } from "../src/core/models/Building";

describe("GridManager - Transit Connectivity", () => {
  let manager: GridManager;

  beforeEach(() => {
    manager = new GridManager();
  });

  describe("getAdjacentPositions", () => {
    it("returns 4 cardinal neighbors for center position", () => {
      const adjacent = manager.getAdjacentPositions({ x: 5, y: 5 });
      expect(adjacent).toHaveLength(4);
      expect(adjacent).toContainEqual({ x: 4, y: 5 });
      expect(adjacent).toContainEqual({ x: 6, y: 5 });
      expect(adjacent).toContainEqual({ x: 5, y: 4 });
      expect(adjacent).toContainEqual({ x: 5, y: 6 });
    });

    it("excludes positions outside grid bounds", () => {
      const corner = manager.getAdjacentPositions({ x: 0, y: 0 });
      expect(corner).toHaveLength(2);
      expect(corner).toContainEqual({ x: 1, y: 0 });
      expect(corner).toContainEqual({ x: 0, y: 1 });
    });
  });

  describe("cluster formation", () => {
    it("habitat forms its own cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.updateClusters(new Map([["hab-1", BuildingId.HABITAT]]), new Map());

      const clusterId = manager.getBuildingClusterId("hab-1");
      expect(clusterId).toBeDefined();
    });

    it("building adjacent to habitat joins its cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.placeBuilding("farm-1", { x: 5, y: 6 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map(),
      );

      const habCluster = manager.getBuildingClusterId("hab-1");
      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(habCluster).toBe(farmCluster);
    });

    it("building not adjacent to habitat has no cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.placeBuilding("farm-1", { x: 8, y: 8 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map(),
      );

      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(farmCluster).toBeUndefined();
    });

    it("chain of buildings connects to habitat cluster", () => {
      manager.placeBuilding("hab-1", { x: 5, y: 5 });
      manager.placeBuilding("solar-1", { x: 5, y: 6 });
      manager.placeBuilding("farm-1", { x: 5, y: 7 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["solar-1", BuildingId.SOLAR_PANEL],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map(),
      );

      const habCluster = manager.getBuildingClusterId("hab-1");
      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(habCluster).toBe(farmCluster);
    });

    it("two separate habitats form separate clusters", () => {
      manager.placeBuilding("hab-1", { x: 2, y: 2 });
      manager.placeBuilding("hab-2", { x: 8, y: 8 });
      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["hab-2", BuildingId.ADVANCED_HABITAT],
        ]),
        new Map(),
      );

      const cluster1 = manager.getBuildingClusterId("hab-1");
      const cluster2 = manager.getBuildingClusterId("hab-2");
      expect(cluster1).toBeDefined();
      expect(cluster2).toBeDefined();
      expect(cluster1).not.toBe(cluster2);
    });
  });

  describe("depot connectivity", () => {
    it("depot bridges disconnected building within range", () => {
      manager.placeBuilding("hab-1", { x: 2, y: 2 });
      manager.placeBuilding("depot-1", { x: 2, y: 3 });
      manager.placeBuilding("farm-1", { x: 2, y: 6 }); // 3 cells from depot

      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["depot-1", BuildingId.ROVER_DEPOT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map([["depot-1", 3]]),
      );

      const habCluster = manager.getBuildingClusterId("hab-1");
      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(farmCluster).toBe(habCluster);
    });

    it("depot does not bridge building outside range", () => {
      manager.placeBuilding("hab-1", { x: 2, y: 2 });
      manager.placeBuilding("depot-1", { x: 2, y: 3 });
      manager.placeBuilding("farm-1", { x: 2, y: 8 }); // 5 cells from depot

      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["depot-1", BuildingId.ROVER_DEPOT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map([["depot-1", 3]]),
      );

      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(farmCluster).toBeUndefined();
    });

    it("depot must be in a cluster to bridge", () => {
      manager.placeBuilding("hab-1", { x: 1, y: 1 });
      manager.placeBuilding("depot-1", { x: 5, y: 5 }); // Not adjacent to habitat
      manager.placeBuilding("farm-1", { x: 5, y: 6 }); // Adjacent to depot but not habitat

      manager.updateClusters(
        new Map([
          ["hab-1", BuildingId.HABITAT],
          ["depot-1", BuildingId.ROVER_DEPOT],
          ["farm-1", BuildingId.BASIC_FARM],
        ]),
        new Map([["depot-1", 3]]),
      );

      const farmCluster = manager.getBuildingClusterId("farm-1");
      expect(farmCluster).toBeUndefined();
    });
  });
});
