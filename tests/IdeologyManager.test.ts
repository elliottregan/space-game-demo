import { describe, expect, test, beforeEach } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import { NPCFaction, ProjectId } from "../src/core/models/NPCInfluence";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole } from "../src/core/models/Colonist";

function createTestColonist(id: string, name: string, ideology: ColonistIdeology): Colonist {
  return {
    id,
    name,
    role: ColonistRole.UNASSIGNED,
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
      expect(IdeologyManager.factionToKey(NPCFaction.CorporateInterests)).toBe(
        "corporateInterests",
      );
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

  describe("lobbying", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("calculates lobby cost based on colonist influence", () => {
      const colonists = [
        createTestColonist("c1", "High Influence", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.9,
        }),
        createTestColonist("c2", "Low Influence", {
          earthLoyalist: 0.5,
          marsIndependence: 0.5,
          corporateInterests: 0.2,
          conviction: 0.3,
        }),
      ];

      // Create relationships to establish centrality
      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.8 });
      relationshipManager.recalculateCentrality(0);

      manager.selectCouncil(colonists, relationshipManager, 0);

      const highInfluenceCost = manager.getLobbyCost("c1", NPCFaction.EarthLoyalists, 0.15);
      const lowInfluenceCost = manager.getLobbyCost("c2", NPCFaction.EarthLoyalists, 0.15);

      // Higher influence colonist should cost more to lobby
      expect(highInfluenceCost).toBeGreaterThan(lowInfluenceCost);
      // Both should be finite (valid council members)
      expect(highInfluenceCost).toBeLessThan(Infinity);
      expect(lowInfluenceCost).toBeLessThan(Infinity);
    });

    test("returns Infinity cost for non-council member", () => {
      const colonists = [
        createTestColonist("c1", "Council Member", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.9,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);

      const cost = manager.getLobbyCost("nonexistent", NPCFaction.EarthLoyalists, 0.15);
      expect(cost).toBe(Infinity);
    });

    test("boosts colonist faction affinity when lobbied", () => {
      const colonists = [
        createTestColonist("c1", "Target", {
          earthLoyalist: 0.5,
          marsIndependence: 0.3,
          corporateInterests: 0.2,
          conviction: 0.5,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);

      const result = manager.lobbyColonist("c1", NPCFaction.MarsIndependence, 0.15, colonists);

      expect(result.success).toBe(true);
      expect(result.newAffinity).toBeCloseTo(0.45, 2);
      expect(colonists[0]!.ideology!.marsIndependence).toBeCloseTo(0.45, 2);
    });

    test("fails to lobby non-council member", () => {
      const colonists = [
        createTestColonist("c1", "Council Member", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.9,
        }),
        createTestColonist("c2", "Not on Council", {
          earthLoyalist: 0.3,
          marsIndependence: 0.3,
          corporateInterests: 0.3,
          conviction: 0.1,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      // Only c1 will be on council due to higher conviction
      manager.selectCouncil([colonists[0]!], relationshipManager, 0);

      const result = manager.lobbyColonist("c2", NPCFaction.EarthLoyalists, 0.15, colonists);

      expect(result.success).toBe(false);
      expect(result.reason).toBe("Target is not a council member");
    });

    test("clamps affinity to max 1.0", () => {
      const colonists = [
        createTestColonist("c1", "High Affinity", {
          earthLoyalist: 0.95,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);

      const result = manager.lobbyColonist("c1", NPCFaction.EarthLoyalists, 0.15, colonists);

      expect(result.success).toBe(true);
      expect(result.newAffinity).toBe(1.0);
      expect(colonists[0]!.ideology!.earthLoyalist).toBe(1.0);
    });

    test("canLobby returns true for council member", () => {
      const colonists = [
        createTestColonist("c1", "Council Member", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.9,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);

      const result = manager.canLobby("c1");
      expect(result.canLobby).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test("canLobby returns false for non-council member", () => {
      const colonists = [
        createTestColonist("c1", "Council Member", {
          earthLoyalist: 0.9,
          marsIndependence: 0.1,
          corporateInterests: 0.1,
          conviction: 0.9,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);

      const result = manager.canLobby("nonexistent");
      expect(result.canLobby).toBe(false);
      expect(result.reason).toBe("Target is not a council member");
    });
  });

  describe("capstone projects", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    describe("getPassedProjectsForFaction", () => {
      test("returns empty array when no projects passed", () => {
        expect(manager.getPassedProjectsForFaction(NPCFaction.EarthLoyalists)).toEqual([]);
      });

      test("returns only projects for specified faction", () => {
        manager.completeProject(ProjectId.EARTH_MEMORIAL);
        manager.completeProject(ProjectId.UNIVERSAL_HOUSING);

        const earthProjects = manager.getPassedProjectsForFaction(NPCFaction.EarthLoyalists);
        expect(earthProjects).toContain(ProjectId.EARTH_MEMORIAL);
        expect(earthProjects).not.toContain(ProjectId.UNIVERSAL_HOUSING);
      });
    });

    describe("canProposeCapstone", () => {
      test("returns false when prerequisites not met", () => {
        const colonists = [
          createTestColonist("c1", "Colonist 1", {
            earthLoyalist: 0.9,
            marsIndependence: 0.1,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
        ];
        relationshipManager.recalculateCentrality(0);
        manager.selectCouncil(colonists, relationshipManager, 0);

        expect(manager.canProposeCapstone(NPCFaction.EarthLoyalists)).toEqual({
          canPropose: false,
          reason: "Prerequisites not met: 0/3 projects passed",
        });
      });

      test("returns false when council support insufficient", () => {
        // Complete all Earth Loyalist prerequisites
        manager.completeProject(ProjectId.EARTH_MEMORIAL);
        manager.completeProject(ProjectId.HERITAGE_ARCHIVE);
        manager.completeProject(ProjectId.IMMIGRATION_PROGRAM);

        // But council is mostly Mars Independence
        const colonists = [
          createTestColonist("c1", "Colonist 1", {
            earthLoyalist: 0.1,
            marsIndependence: 0.9,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
          createTestColonist("c2", "Colonist 2", {
            earthLoyalist: 0.1,
            marsIndependence: 0.9,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
          createTestColonist("c3", "Colonist 3", {
            earthLoyalist: 0.9,
            marsIndependence: 0.1,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
        ];
        relationshipManager.recalculateCentrality(0);
        manager.selectCouncil(colonists, relationshipManager, 0);

        expect(manager.canProposeCapstone(NPCFaction.EarthLoyalists)).toEqual({
          canPropose: false,
          reason: "Insufficient council support: 33% (need 65%)",
        });
      });

      test("returns true when prerequisites met and council support sufficient", () => {
        manager.completeProject(ProjectId.EARTH_MEMORIAL);
        manager.completeProject(ProjectId.HERITAGE_ARCHIVE);
        manager.completeProject(ProjectId.IMMIGRATION_PROGRAM);

        // Council is mostly Earth Loyalists
        const colonists = [
          createTestColonist("c1", "Colonist 1", {
            earthLoyalist: 0.9,
            marsIndependence: 0.1,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
          createTestColonist("c2", "Colonist 2", {
            earthLoyalist: 0.9,
            marsIndependence: 0.1,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
          createTestColonist("c3", "Colonist 3", {
            earthLoyalist: 0.9,
            marsIndependence: 0.1,
            corporateInterests: 0.1,
            conviction: 0.8,
          }),
        ];
        relationshipManager.recalculateCentrality(0);
        manager.selectCouncil(colonists, relationshipManager, 0);

        expect(manager.canProposeCapstone(NPCFaction.EarthLoyalists)).toEqual({
          canPropose: true,
        });
      });
    });

    describe("isCapstoneProject", () => {
      test("returns true for capstone projects", () => {
        expect(manager.isCapstoneProject(ProjectId.RETURN_MISSION)).toBe(true);
        expect(manager.isCapstoneProject(ProjectId.DECLARATION_OF_SOVEREIGNTY)).toBe(true);
        expect(manager.isCapstoneProject(ProjectId.PLANETARY_ACQUISITION)).toBe(true);
      });

      test("returns false for regular projects", () => {
        expect(manager.isCapstoneProject(ProjectId.EARTH_MEMORIAL)).toBe(false);
        expect(manager.isCapstoneProject(ProjectId.UNIVERSAL_HOUSING)).toBe(false);
      });
    });
  });
});
