// tests/workforce/communityDetection.test.ts
import { describe, it, expect } from "bun:test";
import {
  detectCommunities,
  calculateCommunityCohesion,
} from "../../src/core/systems/workforce/communityDetection";
import type { CoworkerRelationship } from "../../src/core/systems/workforce/types";

describe("communityDetection", () => {
  describe("detectCommunities", () => {
    it("should return empty array for no colonists", () => {
      const adjacency = new Map<string, Set<string>>();
      const relationships = new Map<string, CoworkerRelationship>();

      const communities = detectCommunities([], adjacency, relationships);
      expect(communities).toEqual([]);
    });

    it("should detect single community for connected group", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      adjacency.set("b", new Set(["a", "c"]));
      adjacency.set("c", new Set(["a", "b"]));

      const relationships = new Map<string, CoworkerRelationship>();
      relationships.set("a:b", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("b:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });

      const communities = detectCommunities(["a", "b", "c"], adjacency, relationships);
      expect(communities.length).toBe(1);
      expect(communities[0]!.memberIds.sort()).toEqual(["a", "b", "c"]);
    });
  });

  describe("calculateCommunityCohesion", () => {
    it("should return 0 for single member", () => {
      const getStrength = () => 0.5;
      expect(calculateCommunityCohesion(["a"], getStrength)).toBe(0);
    });

    it("should return average strength for multiple members", () => {
      const getStrength = (a: string, b: string) => 0.5;
      expect(calculateCommunityCohesion(["a", "b"], getStrength)).toBe(0.5);
    });
  });
});
