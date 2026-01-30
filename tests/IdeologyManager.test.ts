import { describe, expect, test, beforeEach } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import { ColonistMoraleManager } from "../src/core/systems/ColonistMoraleManager";
import { NPCFaction } from "../src/core/models/NPCInfluence";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

function createTestColonist(
  id: string,
  name: string,
  ideology: ColonistIdeology,
): Colonist {
  return {
    id,
    name,
    role: ColonistRole.UNASSIGNED,
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
    skills: [],
    ideology,
  };
}

describe("IdeologyManager", () => {
  describe("getPrimaryFaction", () => {
    test("returns EarthLoyalists when earthLoyalist is highest", () => {
      const ideology: ColonistIdeology = {
        earthLoyalist: 0.8,
        marsIndependence: 0.3,
        corporateInterests: 0.2,
        conviction: 0.5,
      };
      expect(IdeologyManager.getPrimaryFaction(ideology)).toBe(NPCFaction.EarthLoyalists);
    });

    test("returns MarsIndependence when marsIndependence is highest", () => {
      const ideology: ColonistIdeology = {
        earthLoyalist: 0.2,
        marsIndependence: 0.9,
        corporateInterests: 0.3,
        conviction: 0.5,
      };
      expect(IdeologyManager.getPrimaryFaction(ideology)).toBe(NPCFaction.MarsIndependence);
    });

    test("returns CorporateInterests when corporateInterests is highest", () => {
      const ideology: ColonistIdeology = {
        earthLoyalist: 0.2,
        marsIndependence: 0.3,
        corporateInterests: 0.8,
        conviction: 0.5,
      };
      expect(IdeologyManager.getPrimaryFaction(ideology)).toBe(NPCFaction.CorporateInterests);
    });

    test("returns null when all affinities below threshold", () => {
      const ideology: ColonistIdeology = {
        earthLoyalist: 0.2,
        marsIndependence: 0.25,
        corporateInterests: 0.15,
        conviction: 0.5,
      };
      expect(IdeologyManager.getPrimaryFaction(ideology)).toBeNull();
    });
  });

  describe("factionToKey", () => {
    test("converts EarthLoyalists to earthLoyalist", () => {
      expect(IdeologyManager.factionToKey(NPCFaction.EarthLoyalists)).toBe("earthLoyalist");
    });

    test("converts MarsIndependence to marsIndependence", () => {
      expect(IdeologyManager.factionToKey(NPCFaction.MarsIndependence)).toBe("marsIndependence");
    });

    test("converts CorporateInterests to corporateInterests", () => {
      expect(IdeologyManager.factionToKey(NPCFaction.CorporateInterests)).toBe("corporateInterests");
    });
  });

  describe("createNeutralIdeology", () => {
    test("creates ideology with balanced affinities", () => {
      const ideology = IdeologyManager.createNeutralIdeology();
      expect(ideology.earthLoyalist).toBe(0.33);
      expect(ideology.marsIndependence).toBe(0.33);
      expect(ideology.corporateInterests).toBe(0.33);
    });

    test("creates ideology with low conviction", () => {
      const ideology = IdeologyManager.createNeutralIdeology();
      expect(ideology.conviction).toBe(0.2);
    });
  });

  describe("selectCouncil", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("selects colonists with highest influence", () => {
      const colonists = [
        createTestColonist("c1", "High Influence", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.9,
        }),
        createTestColonist("c2", "Medium Influence", {
          earthLoyalist: 0.5,
          marsIndependence: 0.5,
          corporateInterests: 0.2,
          conviction: 0.5,
        }),
        createTestColonist("c3", "Low Influence", {
          earthLoyalist: 0.3,
          marsIndependence: 0.3,
          corporateInterests: 0.3,
          conviction: 0.2,
        }),
      ];

      // Create relationships to establish centrality
      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.8 });
      relationshipManager.createRelationship("c1", "c3", 0, { initialStrength: 0.6 });
      relationshipManager.recalculateCentrality(0);

      const council = manager.selectCouncil(colonists, relationshipManager, 0);

      // Council should be ordered by influence
      expect(council.length).toBeGreaterThan(0);
      expect(council[0]?.colonistId).toBe("c1");
    });

    test("identifies faction correctly for council members", () => {
      const colonists = [
        createTestColonist("c1", "Earth Loyalist", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      const council = manager.selectCouncil(colonists, relationshipManager, 0);

      expect(council[0]?.faction).toBe(NPCFaction.EarthLoyalists);
    });
  });

  describe("calculateFactionSupport", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("calculates support weighted by centrality", () => {
      const colonists = [
        createTestColonist("c1", "Strong EL", {
          earthLoyalist: 1.0,
          marsIndependence: 0.0,
          corporateInterests: 0.0,
          conviction: 0.8,
        }),
        createTestColonist("c2", "Strong MI", {
          earthLoyalist: 0.0,
          marsIndependence: 1.0,
          corporateInterests: 0.0,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      const support = manager.calculateFactionSupport(colonists, relationshipManager);

      // With equal centrality (both 0), each colonist contributes equally via baseline
      expect(support.earthLoyalists).toBeCloseTo(0.5, 1);
      expect(support.marsIndependence).toBeCloseTo(0.5, 1);
      expect(support.corporateInterests).toBeCloseTo(0, 1);
    });

    test("returns zero support for empty colonist list", () => {
      const support = manager.calculateFactionSupport([], relationshipManager);

      expect(support.earthLoyalists).toBe(0);
      expect(support.marsIndependence).toBe(0);
      expect(support.corporateInterests).toBe(0);
    });
  });

  describe("getCouncilFactionCounts", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("counts council members by faction", () => {
      const colonists = [
        createTestColonist("c1", "EL1", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.8,
        }),
        createTestColonist("c2", "EL2", {
          earthLoyalist: 0.8,
          marsIndependence: 0.2,
          corporateInterests: 0.1,
          conviction: 0.7,
        }),
        createTestColonist("c3", "MI1", {
          earthLoyalist: 0.1,
          marsIndependence: 0.9,
          corporateInterests: 0.2,
          conviction: 0.8,
        }),
        createTestColonist("c4", "Neutral", {
          earthLoyalist: 0.2,
          marsIndependence: 0.2,
          corporateInterests: 0.2,
          conviction: 0.3,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);
      const counts = manager.getCouncilFactionCounts();

      expect(counts[NPCFaction.EarthLoyalists]).toBe(2);
      expect(counts[NPCFaction.MarsIndependence]).toBe(1);
      expect(counts.neutral).toBe(1);
    });
  });

  describe("serialization", () => {
    test("toJSON and fromJSON roundtrip preserves state", () => {
      const manager = new IdeologyManager();
      const colonists = [
        createTestColonist("c1", "Test", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.8,
        }),
      ];
      const relationshipManager = new RelationshipManager();
      relationshipManager.recalculateCentrality(0);

      manager.selectCouncil(colonists, relationshipManager, 50);

      const json = manager.toJSON();
      const restored = IdeologyManager.fromJSON(json);

      expect(restored.getCouncil()).toEqual(manager.getCouncil());
    });
  });
});
