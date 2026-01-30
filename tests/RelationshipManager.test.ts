// tests/RelationshipManager.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import {
  INITIAL_COWORKER_RELATIONSHIP,
  COWORKER_BONDING_RATE,
  COWORKER_RELATIONSHIP_DECAY,
} from "../src/core/balance/WorkforceBalance";

describe("RelationshipManager", () => {
  let manager: RelationshipManager;

  beforeEach(() => {
    manager = new RelationshipManager();
  });

  describe("createRelationship", () => {
    it("should create a new relationship", () => {
      manager.createRelationship("a", "b", 1);

      const rel = manager.getRelationship("a", "b");
      expect(rel).toBeDefined();
      expect(rel?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP);
      expect(rel?.formedAt).toBe(1);
    });

    it("should not overwrite existing relationship", () => {
      manager.createRelationship("a", "b", 1);
      manager.createRelationship("a", "b", 2);

      const rel = manager.getRelationship("a", "b");
      expect(rel?.formedAt).toBe(1); // Still original
    });
  });

  describe("strengthenRelationship", () => {
    it("should increase relationship strength", () => {
      manager.createRelationship("a", "b", 1);
      manager.strengthenRelationship("a", "b", COWORKER_BONDING_RATE, 2);

      const rel = manager.getRelationship("a", "b");
      expect(rel?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP + COWORKER_BONDING_RATE);
      expect(rel?.lastWorkedTogether).toBe(2);
    });
  });

  describe("getNeighbors", () => {
    it("should return all connected colonist IDs", () => {
      manager.createRelationship("a", "b", 1);
      manager.createRelationship("a", "c", 1);

      const neighbors = manager.getNeighbors("a");
      expect(neighbors.has("b")).toBe(true);
      expect(neighbors.has("c")).toBe(true);
      expect(neighbors.size).toBe(2);
    });
  });

  describe("getConnectionCount", () => {
    it("should return number of connections", () => {
      expect(manager.getConnectionCount("a")).toBe(0);

      manager.createRelationship("a", "b", 1);
      expect(manager.getConnectionCount("a")).toBe(1);

      manager.createRelationship("a", "c", 1);
      expect(manager.getConnectionCount("a")).toBe(2);
    });
  });

  describe("decayRelationships", () => {
    it("should decay inactive relationships", () => {
      manager.createRelationship("a", "b", 1);
      manager.createRelationship("a", "c", 1);

      // Only a:c is active
      const activeKeys = new Set(["a:c"]);
      manager.decayRelationships(activeKeys);

      // a:b should be decayed, a:c should be unchanged
      const relAB = manager.getRelationship("a", "b");
      const relAC = manager.getRelationship("a", "c");

      expect(relAB?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP - COWORKER_RELATIONSHIP_DECAY);
      expect(relAC?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP);
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize correctly", () => {
      manager.createRelationship("a", "b", 1);
      manager.strengthenRelationship("a", "b", 0.1, 2);

      const json = manager.toJSON();
      const restored = RelationshipManager.fromJSON(json);

      expect(restored.getRelationshipStrength("a", "b")).toBe(
        manager.getRelationshipStrength("a", "b"),
      );
      expect(restored.getNeighbors("a").has("b")).toBe(true);
    });
  });

  describe("centrality", () => {
    it("computes centrality for connected colonists", () => {
      const manager = new RelationshipManager();
      manager.createRelationship("a", "b", 0);
      manager.createRelationship("a", "c", 0);
      manager.createRelationship("b", "c", 0);

      manager.recalculateCentrality(0);

      // All connected in triangle - should have equal centrality
      const centralityA = manager.getCentrality("a");
      const centralityB = manager.getCentrality("b");
      expect(centralityA).toBeCloseTo(centralityB, 2);
      expect(centralityA).toBeGreaterThan(0);
    });

    it("returns zero centrality for unknown colonist", () => {
      const manager = new RelationshipManager();
      expect(manager.getCentrality("unknown")).toBe(0);
    });

    it("caches centrality until recalc interval", () => {
      const manager = new RelationshipManager();
      manager.createRelationship("a", "b", 0);
      manager.recalculateCentrality(0);

      const first = manager.getCentrality("a");

      // Add new relationship but don't recalculate
      manager.createRelationship("a", "c", 5);

      // Should still return cached value
      expect(manager.getCentrality("a")).toBe(first);
    });

    it("recalculates when stale", () => {
      const manager = new RelationshipManager();
      manager.createRelationship("a", "b", 0);
      manager.recalculateCentralityIfStale(0, 20); // interval = 20

      // At sol 19, should not recalculate
      manager.recalculateCentralityIfStale(19, 20);

      // At sol 20, should recalculate
      manager.createRelationship("a", "c", 20);
      manager.recalculateCentralityIfStale(20, 20);

      // Centrality should now reflect 3 nodes
      expect(manager.getCentrality("c")).toBeGreaterThan(0);
    });

    it("serializes and deserializes centrality cache", () => {
      const manager = new RelationshipManager();
      manager.createRelationship("a", "b", 0);
      manager.recalculateCentrality(10);

      const json = manager.toJSON();
      const restored = RelationshipManager.fromJSON(json);

      expect(restored.getCentrality("a")).toBe(manager.getCentrality("a"));
      expect(restored.getLastCentralitySol()).toBe(10);
    });
  });
});
