import { describe, expect, test, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { BUILDINGS } from "../src/core/data/buildings";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import type { Building } from "../src/core/models/Building";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import { NPCFaction } from "../src/core/models/NPCInfluence";
import type { ColonistQueries } from "../src/core/interfaces/Queries";
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";

function createTestColonist(id: string, name: string, ideology?: ColonistIdeology): Colonist {
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

describe("Building Sponsorship", () => {
  let buildings: BuildingManager;
  let ideology: IdeologyManager;
  let resources: ResourceManager;
  let technology: TechnologyTree;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    ideology = new IdeologyManager();
    resources = new ResourceManager({ food: 500, water: 500, materials: 2000 });
    technology = new TechnologyTree(TECHNOLOGIES);
    buildings.setTechnologyTree(technology);
    buildings.setIdeologyQueries(ideology);
  });

  describe("sponsor/unsponsor", () => {
    test("sponsorBuilding sets sponsorFactionBaseId on active building", () => {
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });

      const success = buildings.sponsorBuilding(building.id, NPCFaction.MarsIndependence);
      expect(success).toBe(true);

      const b = buildings.getBuilding(building.id);
      expect(b?.sponsorFactionBaseId).toBe(NPCFaction.MarsIndependence);
    });

    test("sponsorBuilding fails on non-active building", () => {
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "pending",
        constructionProgress: 0,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });

      const success = buildings.sponsorBuilding(building.id, NPCFaction.MarsIndependence);
      expect(success).toBe(false);
    });

    test("sponsorBuilding fails on nonexistent building", () => {
      const success = buildings.sponsorBuilding("nonexistent", NPCFaction.MarsIndependence);
      expect(success).toBe(false);
    });

    test("unsponsorBuilding clears sponsorFactionBaseId", () => {
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });

      buildings.sponsorBuilding(building.id, NPCFaction.EarthLoyalists);
      expect(buildings.getBuilding(building.id)?.sponsorFactionBaseId).toBe(
        NPCFaction.EarthLoyalists,
      );

      const success = buildings.unsponsorBuilding(building.id);
      expect(success).toBe(true);
      expect(buildings.getBuilding(building.id)?.sponsorFactionBaseId).toBeUndefined();
    });

    test("unsponsorBuilding fails on nonexistent building", () => {
      const success = buildings.unsponsorBuilding("nonexistent");
      expect(success).toBe(false);
    });

    test("can change sponsor faction", () => {
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });

      buildings.sponsorBuilding(building.id, NPCFaction.EarthLoyalists);
      buildings.sponsorBuilding(building.id, NPCFaction.CorporateInterests);

      expect(buildings.getBuilding(building.id)?.sponsorFactionBaseId).toBe(
        NPCFaction.CorporateInterests,
      );
    });
  });

  describe("affinity scoring in autoAssignWorkers", () => {
    test("sponsored building prefers ideologically aligned colonists", () => {
      // Mars Independence position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 }
      const alignedColonist = createTestColonist("aligned", "Aligned", {
        solidarity: 0.3,
        sovereignty: 0.7,
        transformation: 0.3,
        conviction: 0.5,
      });
      const neutralColonist = createTestColonist("neutral", "Neutral", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.5,
      });
      const oppositeColonist = createTestColonist("opposite", "Opposite", {
        solidarity: -0.6,
        sovereignty: -0.7,
        transformation: -0.5,
        conviction: 0.5,
      });

      const colonists = [oppositeColonist, neutralColonist, alignedColonist];
      const mockQueries: ColonistQueries = {
        getColonist: (id: string) => colonists.find((c) => c.id === id),
        getColonists: () => colonists,
      };
      buildings.setColonistQueries(mockQueries);

      // Create a building with 1 worker slot, sponsored by Mars Independence
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "pending",
        constructionProgress: 0,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      buildings.sponsorBuilding(building.id, NPCFaction.MarsIndependence);
      // sponsorBuilding requires active status, so set it directly for this test
      const b = buildings.getBuilding(building.id)!;
      b.status = "active";
      b.sponsorFactionBaseId = NPCFaction.MarsIndependence;

      // Now manually trigger the auto-assign by completing construction
      b.status = "pending";
      b.constructionProgress = 0;

      // Tick until construction completes
      const def = buildings.getDefinition(BuildingId.BASIC_FARM)!;
      for (let i = 0; i <= def.constructionTime; i++) {
        buildings.tick(resources);
      }

      const result = buildings.getBuilding(building.id)!;
      expect(result.status).toBe("active");
      // The aligned colonist should be assigned due to ideology affinity
      expect(result.assignedWorkers).toContain("aligned");
    });

    test("unsponsored building ignores ideology in assignment", () => {
      const alignedColonist = createTestColonist("aligned", "Aligned", {
        solidarity: 0.3,
        sovereignty: 0.7,
        transformation: 0.3,
        conviction: 0.5,
      });
      const neutralColonist = createTestColonist("neutral", "Neutral", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.5,
      });

      const colonists = [alignedColonist, neutralColonist];
      const mockQueries: ColonistQueries = {
        getColonist: (id: string) => colonists.find((c) => c.id === id),
        getColonists: () => colonists,
      };
      buildings.setColonistQueries(mockQueries);

      // Build without sponsorship — both colonists should score the same on ideology
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "pending",
        constructionProgress: 0,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });

      const def = buildings.getDefinition(BuildingId.BASIC_FARM)!;
      for (let i = 0; i <= def.constructionTime; i++) {
        buildings.tick(resources);
      }

      const result = buildings.getBuilding(building.id)!;
      expect(result.status).toBe("active");
      // Without sponsorship, order is based on skill/district only
      // Both should be assigned if enough slots
      expect(result.assignedWorkers.length).toBeGreaterThan(0);
    });
  });

  describe("sponsorship nudge", () => {
    test("applySponsorshipNudge drifts worker ideology toward faction", () => {
      const colonist = createTestColonist("worker1", "Worker", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0,
      });

      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: ["worker1"],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      buildings.sponsorBuilding(building.id, NPCFaction.MarsIndependence);

      // Mars Independence position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 }
      ideology.applySponsorshipNudge(buildings, [colonist]);

      // Ideology should have drifted toward Mars Independence position
      expect(colonist.ideology!.sovereignty).toBeGreaterThan(0);
      expect(colonist.ideology!.solidarity).toBeGreaterThan(0);
      expect(colonist.ideology!.transformation).toBeGreaterThan(0);
    });

    test("high conviction resists nudge", () => {
      const lowConviction = createTestColonist("low", "Low Conv", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.1,
      });
      const highConviction = createTestColonist("high", "High Conv", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.9,
      });

      const b1 = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: ["low"],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      buildings.sponsorBuilding(b1.id, NPCFaction.MarsIndependence);

      const b2 = buildings.addBuilding({
        definitionId: BuildingId.WATER_EXTRACTOR,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: ["high"],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      buildings.sponsorBuilding(b2.id, NPCFaction.MarsIndependence);

      ideology.applySponsorshipNudge(buildings, [lowConviction, highConviction]);

      // Low conviction colonist should drift more
      expect(Math.abs(lowConviction.ideology!.sovereignty)).toBeGreaterThan(
        Math.abs(highConviction.ideology!.sovereignty),
      );
    });

    test("nudge does not affect unsponsored buildings", () => {
      const colonist = createTestColonist("worker1", "Worker", {
        solidarity: 0.5,
        sovereignty: 0.5,
        transformation: 0.5,
        conviction: 0.3,
      });

      buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: ["worker1"],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      // No sponsorship

      const originalSolidarity = colonist.ideology!.solidarity;
      ideology.applySponsorshipNudge(buildings, [colonist]);

      expect(colonist.ideology!.solidarity).toBe(originalSolidarity);
    });

    test("nudge does not affect colonists without ideology", () => {
      const colonist = createTestColonist("worker1", "Worker");

      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: ["worker1"],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      buildings.sponsorBuilding(building.id, NPCFaction.EarthLoyalists);

      // Should not throw
      ideology.applySponsorshipNudge(buildings, [colonist]);
      expect(colonist.ideology).toBeUndefined();
    });

    test("nudge clamps ideology to [-1, 1]", () => {
      const colonist = createTestColonist("worker1", "Worker", {
        solidarity: 0.99,
        sovereignty: 0.99,
        transformation: 0.99,
        conviction: 0,
      });

      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: ["worker1"],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      // Corporate position has transformation: 0.5 — nudge should push it toward 0.5,
      // but let's use a faction with high values to test clamping
      buildings.sponsorBuilding(building.id, NPCFaction.MarsIndependence);

      // Apply many nudges
      for (let i = 0; i < 1000; i++) {
        ideology.applySponsorshipNudge(buildings, [colonist]);
      }

      expect(colonist.ideology!.solidarity).toBeLessThanOrEqual(1);
      expect(colonist.ideology!.sovereignty).toBeLessThanOrEqual(1);
      expect(colonist.ideology!.transformation).toBeLessThanOrEqual(1);
      expect(colonist.ideology!.solidarity).toBeGreaterThanOrEqual(-1);
    });
  });

  describe("IdeologyManager.getFactionByBaseId", () => {
    test("returns faction position by baseId", () => {
      const result = ideology.getFactionByBaseId(NPCFaction.MarsIndependence);
      expect(result).toBeDefined();
      expect(result!.position.sovereignty).toBeCloseTo(0.7, 1);
    });

    test("returns undefined for unknown baseId", () => {
      const result = ideology.getFactionByBaseId("nonexistent" as NPCFaction);
      expect(result).toBeUndefined();
    });
  });

  describe("serialization", () => {
    test("sponsorFactionBaseId persists through toJSON/fromJSON", () => {
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });
      buildings.sponsorBuilding(building.id, NPCFaction.CorporateInterests);

      const json = buildings.toJSON();
      const restored = BuildingManager.fromJSON(json, BUILDINGS);

      const restoredBuilding = restored.getBuilding(building.id);
      expect(restoredBuilding?.sponsorFactionBaseId).toBe(NPCFaction.CorporateInterests);
    });

    test("buildings without sponsorship serialize correctly", () => {
      const building = buildings.addBuilding({
        definitionId: BuildingId.BASIC_FARM,
        status: "active",
        constructionProgress: 10,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
      });

      const json = buildings.toJSON();
      const restored = BuildingManager.fromJSON(json, BUILDINGS);

      const restoredBuilding = restored.getBuilding(building.id);
      expect(restoredBuilding?.sponsorFactionBaseId).toBeUndefined();
    });
  });

  describe("balance constants", () => {
    test("sponsorship constants have expected values", () => {
      expect(IdeologyBalance.SPONSORSHIP_AFFINITY_WEIGHT).toBe(2);
      expect(IdeologyBalance.SPONSORSHIP_NUDGE_RATE).toBe(0.008);
      expect(IdeologyBalance.SPONSORSHIP_NUDGE_CONVICTION_RESISTANCE).toBe(0.6);
    });
  });
});
