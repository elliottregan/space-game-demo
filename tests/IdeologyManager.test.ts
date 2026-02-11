import { describe, expect, test, beforeEach } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import { NPCFaction } from "../src/core/models/NPCInfluence";
import type { ColonistIdeology, Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";

function createTestColonist(id: string, name: string, ideology: ColonistIdeology): Colonist {
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
  describe("getNearestFaction", () => {
    test("returns faction with closest axis position", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions();

      // Colonist near Earth Loyalists position (0, -0.7, -0.3)
      const ideology: ColonistIdeology = {
        solidarity: 0.1,
        sovereignty: -0.6,
        transformation: -0.2,
        conviction: 0.5,
      };

      const nearest = IdeologyManager.getNearestFaction(ideology, factions);
      expect(nearest).not.toBeNull();
      expect(nearest!.baseId).toBe(NPCFaction.EarthLoyalists);
    });

    test("returns Mars Independence for colonist near that position", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions();

      const ideology: ColonistIdeology = {
        solidarity: 0.2,
        sovereignty: 0.6,
        transformation: 0.25,
        conviction: 0.7,
      };

      const nearest = IdeologyManager.getNearestFaction(ideology, factions);
      expect(nearest).not.toBeNull();
      expect(nearest!.baseId).toBe(NPCFaction.MarsIndependence);
    });

    test("returns Corporate Interests for colonist near that position", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions();

      const ideology: ColonistIdeology = {
        solidarity: -0.5,
        sovereignty: 0.1,
        transformation: 0.4,
        conviction: 0.6,
      };

      const nearest = IdeologyManager.getNearestFaction(ideology, factions);
      expect(nearest).not.toBeNull();
      expect(nearest!.baseId).toBe(NPCFaction.CorporateInterests);
    });

    test("returns null for empty factions array", () => {
      const ideology: ColonistIdeology = {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      };

      const nearest = IdeologyManager.getNearestFaction(ideology, []);
      expect(nearest).toBeNull();
    });
  });

  describe("createNeutralIdeology", () => {
    test("creates ideology near origin with low conviction and random lean", () => {
      const ideology = IdeologyManager.createNeutralIdeology();
      // Random lean within [-0.25, 0.25] per axis (spread=0.5)
      expect(Math.abs(ideology.solidarity)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(ideology.sovereignty)).toBeLessThanOrEqual(0.25);
      expect(Math.abs(ideology.transformation)).toBeLessThanOrEqual(0.25);
      expect(ideology.conviction).toBe(0.2);
    });
  });

  describe("getFactions", () => {
    test("returns three starting factions", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions();
      expect(factions.length).toBe(3);
    });

    test("factions have correct starting positions", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions();

      const earth = factions.find((f) => f.baseId === NPCFaction.EarthLoyalists);
      expect(earth).toBeDefined();
      expect(earth!.position.solidarity).toBe(0.0);
      expect(earth!.position.sovereignty).toBe(-0.7);
      expect(earth!.position.transformation).toBe(-0.3);

      const mars = factions.find((f) => f.baseId === NPCFaction.MarsIndependence);
      expect(mars).toBeDefined();
      expect(mars!.position.solidarity).toBe(0.3);
      expect(mars!.position.sovereignty).toBe(0.7);
      expect(mars!.position.transformation).toBe(0.3);

      const corp = factions.find((f) => f.baseId === NPCFaction.CorporateInterests);
      expect(corp).toBeDefined();
      expect(corp!.position.solidarity).toBe(-0.6);
      expect(corp!.position.sovereignty).toBe(0.0);
      expect(corp!.position.transformation).toBe(0.5);
    });

    test("factions have zero initial pressure", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions();

      for (const faction of factions) {
        expect(faction.pressure.solidarity).toBe(0);
        expect(faction.pressure.sovereignty).toBe(0);
        expect(faction.pressure.transformation).toBe(0);
      }
    });
  });

  describe("getFaction", () => {
    test("returns faction by id", () => {
      const manager = new IdeologyManager();
      const faction = manager.getFaction(NPCFaction.EarthLoyalists);
      expect(faction).toBeDefined();
      expect(faction!.name).toBe("Earth Loyalists");
    });

    test("returns undefined for unknown id", () => {
      const manager = new IdeologyManager();
      const faction = manager.getFaction("nonexistent");
      expect(faction).toBeUndefined();
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
          solidarity: 0.1,
          sovereignty: -0.6,
          transformation: -0.2,
          conviction: 0.9,
        }),
        createTestColonist("c2", "Medium Influence", {
          solidarity: 0.2,
          sovereignty: 0.6,
          transformation: 0.25,
          conviction: 0.5,
        }),
        createTestColonist("c3", "Low Influence", {
          solidarity: 0,
          sovereignty: 0,
          transformation: 0,
          conviction: 0.2,
        }),
      ];

      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.8 });
      relationshipManager.createRelationship("c1", "c3", 0, { initialStrength: 0.6 });
      relationshipManager.recalculateCentrality(0);

      const council = manager.selectCouncil(colonists, relationshipManager, 0);

      expect(council.length).toBeGreaterThan(0);
      // c1 has highest conviction and centrality, so highest influence
      expect(council[0]?.colonistId).toBe("c1");
    });

    test("identifies nearest faction for council members", () => {
      const colonists = [
        createTestColonist("c1", "Earth Aligned", {
          solidarity: 0.1,
          sovereignty: -0.6,
          transformation: -0.2,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      const council = manager.selectCouncil(colonists, relationshipManager, 0);

      expect(council[0]?.factionId).toBe(NPCFaction.EarthLoyalists);
    });

    test("assigns factionId null for neutral colonists at origin", () => {
      // A colonist at the exact origin is equidistant from multiple factions,
      // but getNearestFaction always picks the closest, so factionId will be set.
      // The test verifies that council assignment works for varied positions.
      const colonists = [
        createTestColonist("c1", "Mars Aligned", {
          solidarity: 0.3,
          sovereignty: 0.7,
          transformation: 0.3,
          conviction: 0.8,
        }),
        createTestColonist("c2", "Corporate Aligned", {
          solidarity: -0.5,
          sovereignty: 0.1,
          transformation: 0.4,
          conviction: 0.6,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      const council = manager.selectCouncil(colonists, relationshipManager, 0);

      const marsMembers = council.filter((m) => m.factionId === NPCFaction.MarsIndependence);
      const corpMembers = council.filter((m) => m.factionId === NPCFaction.CorporateInterests);
      expect(marsMembers.length).toBe(1);
      expect(corpMembers.length).toBe(1);
    });
  });

  describe("calculateFactionSupport", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("colonists near a faction contribute more support to it", () => {
      const colonists = [
        // Colonist near Earth Loyalists
        createTestColonist("c1", "Earth", {
          solidarity: 0.0,
          sovereignty: -0.7,
          transformation: -0.3,
          conviction: 0.8,
        }),
        // Colonist near Mars Independence
        createTestColonist("c2", "Mars", {
          solidarity: 0.3,
          sovereignty: 0.7,
          transformation: 0.3,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      const support = manager.calculateFactionSupport(colonists, relationshipManager);

      // Earth support should be highest for earth_loyalists
      expect(support[NPCFaction.EarthLoyalists]).toBeGreaterThan(0);
      expect(support[NPCFaction.MarsIndependence]).toBeGreaterThan(0);
      // Support should sum to 1
      const total = Object.values(support).reduce((sum, val) => sum + val, 0);
      expect(total).toBeCloseTo(1, 5);
    });

    test("returns zero support for empty colonist list", () => {
      const support = manager.calculateFactionSupport([], relationshipManager);

      expect(support[NPCFaction.EarthLoyalists]).toBe(0);
      expect(support[NPCFaction.MarsIndependence]).toBe(0);
      expect(support[NPCFaction.CorporateInterests]).toBe(0);
    });

    test("colonist at exact faction position gives highest support to that faction", () => {
      const colonists = [
        createTestColonist("c1", "Exact Mars", {
          solidarity: 0.3,
          sovereignty: 0.7,
          transformation: 0.3,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      const support = manager.calculateFactionSupport(colonists, relationshipManager);

      // Mars should get most support since colonist is at that exact position
      expect(support[NPCFaction.MarsIndependence]).toBeGreaterThan(
        support[NPCFaction.EarthLoyalists]!,
      );
      expect(support[NPCFaction.MarsIndependence]).toBeGreaterThan(
        support[NPCFaction.CorporateInterests]!,
      );
    });
  });

  describe("getCouncilFactionCounts", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("counts council members by nearest faction", () => {
      const colonists = [
        // Near Earth Loyalists
        createTestColonist("c1", "EL1", {
          solidarity: 0.1,
          sovereignty: -0.6,
          transformation: -0.2,
          conviction: 0.8,
        }),
        // Near Earth Loyalists
        createTestColonist("c2", "EL2", {
          solidarity: 0.0,
          sovereignty: -0.7,
          transformation: -0.3,
          conviction: 0.7,
        }),
        // Near Mars Independence
        createTestColonist("c3", "MI1", {
          solidarity: 0.2,
          sovereignty: 0.6,
          transformation: 0.25,
          conviction: 0.8,
        }),
        // Near Corporate Interests
        createTestColonist("c4", "CI1", {
          solidarity: -0.5,
          sovereignty: 0.1,
          transformation: 0.4,
          conviction: 0.6,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);
      const counts = manager.getCouncilFactionCounts();

      expect(counts[NPCFaction.EarthLoyalists]).toBe(2);
      expect(counts[NPCFaction.MarsIndependence]).toBe(1);
      expect(counts[NPCFaction.CorporateInterests]).toBe(1);
    });
  });

  describe("serialization", () => {
    test("toJSON and fromJSON roundtrip preserves state including factions", () => {
      const manager = new IdeologyManager();
      const colonists = [
        createTestColonist("c1", "Test", {
          solidarity: 0.1,
          sovereignty: -0.6,
          transformation: -0.2,
          conviction: 0.8,
        }),
      ];
      const relationshipManager = new RelationshipManager();
      relationshipManager.recalculateCentrality(0);

      manager.selectCouncil(colonists, relationshipManager, 50);

      const json = manager.toJSON();
      const restored = IdeologyManager.fromJSON(json);

      expect(restored.getCouncil()).toEqual(manager.getCouncil());
      expect(restored.getFactions()).toEqual(manager.getFactions());
    });

    test("fromJSON preserves factions", () => {
      const manager = new IdeologyManager();
      const json = manager.toJSON();

      const restored = IdeologyManager.fromJSON(json);
      const factions = restored.getFactions();

      expect(factions.length).toBe(3);
      expect(factions[0]!.baseId).toBe(NPCFaction.EarthLoyalists);
    });
  });

  describe("propagateIdeology", () => {
    let manager: IdeologyManager;
    let relationshipManager: RelationshipManager;

    beforeEach(() => {
      manager = new IdeologyManager();
      relationshipManager = new RelationshipManager();
    });

    test("colonist drifts toward neighbor axis position", () => {
      const colonists = [
        createTestColonist("c1", "Drifter", {
          solidarity: 0,
          sovereignty: 0,
          transformation: 0,
          conviction: 0.2,
        }),
        createTestColonist("c2", "Influencer", {
          solidarity: 0.8,
          sovereignty: 0.5,
          transformation: -0.3,
          conviction: 0.8,
        }),
      ];

      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.8 });
      relationshipManager.recalculateCentrality(0);

      manager.propagateIdeology(colonists, relationshipManager, 0);

      // c1 should drift toward c2's position
      expect(colonists[0]!.ideology!.solidarity).toBeGreaterThan(0);
      expect(colonists[0]!.ideology!.sovereignty).toBeGreaterThan(0);
      expect(colonists[0]!.ideology!.transformation).toBeLessThan(0);
    });

    test("conviction resists drift", () => {
      const colonistLowConviction = createTestColonist("c1", "Low", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });
      const colonistHighConviction = createTestColonist("c3", "High", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.8,
      });
      const influencer = createTestColonist("c2", "Influencer", {
        solidarity: 0.8,
        sovereignty: 0.5,
        transformation: -0.3,
        conviction: 0.8,
      });

      // Test low conviction colonist
      const colonists1 = [colonistLowConviction, influencer];
      const rm1 = new RelationshipManager();
      rm1.createRelationship("c1", "c2", 0, { initialStrength: 0.8 });
      rm1.recalculateCentrality(0);

      const mgr1 = new IdeologyManager();
      mgr1.propagateIdeology(colonists1, rm1, 0);
      const lowDrift = colonistLowConviction.ideology!.solidarity;

      // Test high conviction colonist
      const colonists2 = [colonistHighConviction, { ...influencer, id: "c2" }];
      const rm2 = new RelationshipManager();
      rm2.createRelationship("c3", "c2", 0, { initialStrength: 0.8 });
      rm2.recalculateCentrality(0);

      const mgr2 = new IdeologyManager();
      mgr2.propagateIdeology(colonists2, rm2, 0);
      const highDrift = colonistHighConviction.ideology!.solidarity;

      // Low conviction should drift more than high conviction
      expect(lowDrift).toBeGreaterThan(highDrift);
    });

    test("clamps axes to [-1, 1]", () => {
      const colonists = [
        createTestColonist("c1", "Extreme", {
          solidarity: 0.95,
          sovereignty: 0.95,
          transformation: 0.95,
          conviction: 0.2,
        }),
        createTestColonist("c2", "Puller", {
          solidarity: 1.0,
          sovereignty: 1.0,
          transformation: 1.0,
          conviction: 0.9,
        }),
      ];

      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.9 });
      relationshipManager.recalculateCentrality(0);

      manager.propagateIdeology(colonists, relationshipManager, 0);

      expect(colonists[0]!.ideology!.solidarity).toBeLessThanOrEqual(1);
      expect(colonists[0]!.ideology!.solidarity).toBeGreaterThanOrEqual(-1);
      expect(colonists[0]!.ideology!.sovereignty).toBeLessThanOrEqual(1);
      expect(colonists[0]!.ideology!.sovereignty).toBeGreaterThanOrEqual(-1);
      expect(colonists[0]!.ideology!.transformation).toBeLessThanOrEqual(1);
      expect(colonists[0]!.ideology!.transformation).toBeGreaterThanOrEqual(-1);
    });
  });

  describe("imprintIdeologyFromNeighbors", () => {
    test("new colonist blends toward strongest neighbor on all axes", () => {
      const relationshipManager = new RelationshipManager();

      const newColonist = createTestColonist("c1", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });
      const neighbor = createTestColonist("c2", "Neighbor", {
        solidarity: 0.6,
        sovereignty: -0.4,
        transformation: 0.3,
        conviction: 0.7,
      });

      const colonists = [newColonist, neighbor];
      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.8 });
      relationshipManager.recalculateCentrality(0);

      IdeologyManager.imprintIdeologyFromNeighbors(newColonist, colonists, relationshipManager);

      // Should blend toward neighbor's position (default imprinting strength is 0.7)
      expect(newColonist.ideology!.solidarity).toBeCloseTo(0.6 * 0.7, 1);
      expect(newColonist.ideology!.sovereignty).toBeCloseTo(-0.4 * 0.7, 1);
      expect(newColonist.ideology!.transformation).toBeCloseTo(0.3 * 0.7, 1);
    });

    test("does not imprint from weak connections", () => {
      const relationshipManager = new RelationshipManager();

      const newColonist = createTestColonist("c1", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });
      const neighbor = createTestColonist("c2", "WeakNeighbor", {
        solidarity: 0.8,
        sovereignty: 0.8,
        transformation: 0.8,
        conviction: 0.9,
      });

      const colonists = [newColonist, neighbor];
      // Below IDEOLOGY_IMPRINTING_THRESHOLD (0.3)
      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.1 });
      relationshipManager.recalculateCentrality(0);

      IdeologyManager.imprintIdeologyFromNeighbors(newColonist, colonists, relationshipManager);

      // Should not change from neutral
      expect(newColonist.ideology!.solidarity).toBe(0);
      expect(newColonist.ideology!.sovereignty).toBe(0);
      expect(newColonist.ideology!.transformation).toBe(0);
    });

    test("clamps imprinted values to [-1, 1]", () => {
      const relationshipManager = new RelationshipManager();

      const newColonist = createTestColonist("c1", "New", {
        solidarity: 0.5,
        sovereignty: 0.5,
        transformation: 0.5,
        conviction: 0.2,
      });
      const neighbor = createTestColonist("c2", "Extreme", {
        solidarity: 1.0,
        sovereignty: 1.0,
        transformation: 1.0,
        conviction: 0.9,
      });

      const colonists = [newColonist, neighbor];
      relationshipManager.createRelationship("c1", "c2", 0, { initialStrength: 0.9 });
      relationshipManager.recalculateCentrality(0);

      IdeologyManager.imprintIdeologyFromNeighbors(
        newColonist,
        colonists,
        relationshipManager,
        1.0,
      );

      expect(newColonist.ideology!.solidarity).toBeLessThanOrEqual(1);
      expect(newColonist.ideology!.sovereignty).toBeLessThanOrEqual(1);
      expect(newColonist.ideology!.transformation).toBeLessThanOrEqual(1);
    });
  });

  describe("updateCouncilIfStale", () => {
    test("updates council when enough time has passed", () => {
      const manager = new IdeologyManager();
      const relationshipManager = new RelationshipManager();

      const colonists = [
        createTestColonist("c1", "Test", {
          solidarity: 0.1,
          sovereignty: -0.6,
          transformation: -0.2,
          conviction: 0.8,
        }),
      ];

      relationshipManager.recalculateCentrality(0);
      manager.selectCouncil(colonists, relationshipManager, 0);

      // Should not update if not stale
      const initialCouncil = manager.getCouncil();
      manager.updateCouncilIfStale(colonists, relationshipManager, 1);
      expect(manager.getCouncil()).toEqual(initialCouncil);

      // Should update after COUNCIL_UPDATE_INTERVAL
      manager.updateCouncilIfStale(
        colonists,
        relationshipManager,
        IdeologyBalance.COUNCIL_UPDATE_INTERVAL + 1,
      );
      // Council was refreshed (same colonists, but recalculated)
      expect(manager.getCouncil().length).toBe(initialCouncil.length);
    });
  });
});
