// tests/workforce/socialGraph.test.ts
import { describe, it, expect } from "bun:test";
import {
  getRelationshipKey,
  calculateClusteringCoefficient,
  calculateBridgingScore,
  calculateTeamCohesionMultiplier,
  isWeakTie,
} from "../../src/core/systems/workforce/socialGraph";
import type { CoworkerRelationship } from "../../src/core/systems/workforce/types";
import {
  WEAK_TIE_THRESHOLD,
  TEAM_COHESION_THRESHOLD,
  MAX_COWORKER_RELATIONSHIP,
  MAX_TEAM_COHESION_BONUS,
} from "../../src/core/balance/WorkforceBalance";

describe("socialGraph", () => {
  describe("getRelationshipKey", () => {
    it("should return alphabetically sorted key", () => {
      expect(getRelationshipKey("bob", "alice")).toBe("alice:bob");
      expect(getRelationshipKey("alice", "bob")).toBe("alice:bob");
    });
  });

  describe("isWeakTie", () => {
    it("should return true for strength below threshold", () => {
      expect(isWeakTie(0.1)).toBe(true);
      expect(isWeakTie(WEAK_TIE_THRESHOLD - 0.01)).toBe(true);
    });

    it("should return false for strength at or above threshold", () => {
      expect(isWeakTie(WEAK_TIE_THRESHOLD)).toBe(false);
      expect(isWeakTie(0.5)).toBe(false);
    });

    it("should return false for zero strength", () => {
      expect(isWeakTie(0)).toBe(false);
    });
  });

  describe("calculateClusteringCoefficient", () => {
    it("should return 0 for fewer than 2 neighbors", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b"]));
      const relationships = new Map<string, CoworkerRelationship>();

      expect(calculateClusteringCoefficient("a", adjacency, relationships)).toBe(0);
    });

    it("should return 1 for fully connected triangle", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      adjacency.set("b", new Set(["a", "c"]));
      adjacency.set("c", new Set(["a", "b"]));

      const relationships = new Map<string, CoworkerRelationship>();
      relationships.set("a:b", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("b:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });

      expect(calculateClusteringCoefficient("a", adjacency, relationships)).toBe(1);
    });

    it("should return 0 for node with no connected neighbors", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      adjacency.set("b", new Set(["a"]));
      adjacency.set("c", new Set(["a"]));

      const relationships = new Map<string, CoworkerRelationship>();
      relationships.set("a:b", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      // No b:c relationship

      expect(calculateClusteringCoefficient("a", adjacency, relationships)).toBe(0);
    });

    it("should return partial value for partially connected neighbors", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c", "d"]));
      adjacency.set("b", new Set(["a", "c"]));
      adjacency.set("c", new Set(["a", "b"]));
      adjacency.set("d", new Set(["a"]));

      const relationships = new Map<string, CoworkerRelationship>();
      relationships.set("a:b", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:d", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("b:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      // No b:d or c:d relationships

      // 3 neighbors, 3 possible edges (b-c, b-d, c-d), only 1 exists (b-c)
      expect(calculateClusteringCoefficient("a", adjacency, relationships)).toBeCloseTo(1 / 3);
    });

    it("should return 0 for node not in adjacency list", () => {
      const adjacency = new Map<string, Set<string>>();
      const relationships = new Map<string, CoworkerRelationship>();

      expect(calculateClusteringCoefficient("unknown", adjacency, relationships)).toBe(0);
    });
  });

  describe("calculateBridgingScore", () => {
    it("should return 0 for fewer than 2 connections", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b"]));
      const getStrength = () => 0.5;

      expect(calculateBridgingScore("a", adjacency, getStrength)).toBe(0);
    });

    it("should return 1 for node connecting unconnected groups", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      // b and c have no connection between them
      const getStrength = (id1: string, id2: string) => {
        // a's connections to b and c are strong, but b-c is weak/nonexistent
        if ((id1 === "b" && id2 === "c") || (id1 === "c" && id2 === "b")) {
          return 0; // No connection between b and c
        }
        return 0.5;
      };

      expect(calculateBridgingScore("a", adjacency, getStrength)).toBe(1);
    });

    it("should return 0 for node in tightly connected group", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      // Everyone is strongly connected
      const getStrength = () => 0.5; // Above WEAK_TIE_THRESHOLD (0.3)

      expect(calculateBridgingScore("a", adjacency, getStrength)).toBe(0);
    });

    it("should return 0 for node not in adjacency list", () => {
      const adjacency = new Map<string, Set<string>>();
      const getStrength = () => 0.5;

      expect(calculateBridgingScore("unknown", adjacency, getStrength)).toBe(0);
    });
  });

  describe("calculateTeamCohesionMultiplier", () => {
    it("should return 1.0 for empty or solo team", () => {
      expect(calculateTeamCohesionMultiplier([], () => 0)).toBe(1.0);
      expect(calculateTeamCohesionMultiplier(["a"], () => 0)).toBe(1.0);
    });

    it("should return 1.0 for team below threshold", () => {
      const getStrength = () => 0.1; // Below TEAM_COHESION_THRESHOLD
      expect(calculateTeamCohesionMultiplier(["a", "b"], getStrength)).toBe(1.0);
    });

    it("should return bonus for team above threshold", () => {
      const getStrength = () => 0.5; // Above TEAM_COHESION_THRESHOLD
      const multiplier = calculateTeamCohesionMultiplier(["a", "b"], getStrength);
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeLessThanOrEqual(1.0 + MAX_TEAM_COHESION_BONUS);
    });

    it("should return max bonus for max relationship strength team", () => {
      const getStrength = () => MAX_COWORKER_RELATIONSHIP;
      const multiplier = calculateTeamCohesionMultiplier(["a", "b"], getStrength);
      expect(multiplier).toBeCloseTo(1.0 + MAX_TEAM_COHESION_BONUS);
    });

    it("should calculate average across all pairs in larger team", () => {
      // Team of 3: a, b, c - pairs are (a,b), (a,c), (b,c)
      const getStrength = (id1: string, id2: string) => {
        if ((id1 === "a" && id2 === "b") || (id1 === "b" && id2 === "a")) return 0.6;
        if ((id1 === "a" && id2 === "c") || (id1 === "c" && id2 === "a")) return 0.4;
        if ((id1 === "b" && id2 === "c") || (id1 === "c" && id2 === "b")) return 0.2;
        return 0;
      };
      // Average: (0.6 + 0.4 + 0.2) / 3 = 0.4

      const multiplier = calculateTeamCohesionMultiplier(["a", "b", "c"], getStrength);
      // Average 0.4 is above TEAM_COHESION_THRESHOLD (0.2), so should have bonus
      expect(multiplier).toBeGreaterThan(1.0);
    });
  });
});
