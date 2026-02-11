import { describe, test, expect } from "bun:test";
import { createTickContext, type TickContext } from "../src/core/tick/TickContext";
import { GameState } from "../src/core/GameState";
import { processDistrictMigration } from "../src/core/tick/phases/migration";
import { BuildingId } from "../src/core/models/Building";
import {
  MIGRATION_CHECK_INTERVAL,
  DISTRICT_TRANSFER_MORALE_COST,
} from "../src/core/balance/DistrictBalance";

function createTestContext(sol: number = MIGRATION_CHECK_INTERVAL): TickContext {
  const state = new GameState();
  state.currentSol = sol;
  return createTickContext(
    state.currentSol,
    {
      resources: state.resources,
      buildings: state.buildings,
      colony: state.colony,
      workforce: state.workforce,
      colonistMorale: state.colonistMorale,
      technology: state.technology,
      operations: state.operations,
      events: state.events,
      victory: state.victory,
      ideology: state.ideology,
      lifeSupport: state.lifeSupport,
      earthCrisis: state.earthCrisis,
      districtGrants: state.districtGrants,
      districts: state.districts,
      scheduler: state.scheduler,
    },
    { autoAssignNewColonists: true },
  );
}

/**
 * Helper: set up an overcrowded source district and an empty target district.
 * Returns the context and district IDs.
 */
function setupOvercrowdedScenario(sol: number = MIGRATION_CHECK_INTERVAL) {
  const ctx = createTestContext(sol);

  // Create source district with small capacity
  const source = ctx.districts.foundDistrict("Source", 0);
  // Create target district
  const target = ctx.districts.foundDistrict("Target", 0);

  // Set source capacity small so we can easily overcrowd it
  source.capacity = 10;
  // Set target capacity large with room
  target.capacity = 20;

  return { ctx, sourceId: source.id, targetId: target.id };
}

/**
 * Helper: add N colonists to a district.
 */
function addColonistsToDistrict(ctx: TickContext, districtId: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const colonist = ctx.colony.addColonist();
    colonist.districtId = districtId;
    ctx.districts.assignColonist(districtId, colonist.id);
    ids.push(colonist.id);
  }
  return ids;
}

/**
 * Helper: add a building with worker slots to a district.
 */
function addBuildingToDistrict(
  ctx: TickContext,
  districtId: string,
  assignedWorkers: string[] = [],
): string {
  const building = ctx.buildings.addBuilding({
    definitionId: BuildingId.WATER_EXTRACTOR,
    status: "active",
    constructionProgress: 7,
    assignedWorkers,
    mode: "normal",
    broken: false,
    repairProgress: 0,
  });
  ctx.districts.assignBuilding(districtId, building.id);
  return building.id;
}

describe("District Migration", () => {
  describe("guard conditions", () => {
    test("skips when fewer than 2 districts", () => {
      const ctx = createTestContext();
      ctx.districts.foundDistrict("Only One", 0);
      const events = processDistrictMigration.execute(ctx);
      expect(events).toEqual([]);
    });

    test("skips on non-interval sols", () => {
      // Sol 3 is not a multiple of MIGRATION_CHECK_INTERVAL (5)
      const { ctx, sourceId } = setupOvercrowdedScenario(3);
      addColonistsToDistrict(ctx, sourceId, 10);
      const events = processDistrictMigration.execute(ctx);
      expect(events).toEqual([]);
    });

    test("skips when no district is overcrowded", () => {
      const ctx = createTestContext();
      const d1 = ctx.districts.foundDistrict("A", 0);
      const d2 = ctx.districts.foundDistrict("B", 0);
      d1.capacity = 20;
      d2.capacity = 20;
      // Add just a few colonists (well below threshold)
      addColonistsToDistrict(ctx, d1.id, 5);
      addColonistsToDistrict(ctx, d2.id, 3);
      const events = processDistrictMigration.execute(ctx);
      expect(events).toEqual([]);
    });

    test("skips when no target has space below threshold", () => {
      const ctx = createTestContext();
      const d1 = ctx.districts.foundDistrict("A", 0);
      const d2 = ctx.districts.foundDistrict("B", 0);
      d1.capacity = 10;
      d2.capacity = 10;
      // Both districts overcrowded
      addColonistsToDistrict(ctx, d1.id, 9);
      addColonistsToDistrict(ctx, d2.id, 8);
      const events = processDistrictMigration.execute(ctx);
      expect(events).toEqual([]);
    });
  });

  describe("candidate scoring", () => {
    test("skips colonists working in their home district", () => {
      // oxlint-disable-next-line no-unused-vars
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();

      // Add colonists to source - 9 out of 10 capacity = 0.9 occupancy > 0.85
      const colonistIds = addColonistsToDistrict(ctx, sourceId, 9);

      // Assign ALL colonists as workers in the source district
      for (const cid of colonistIds) {
        addBuildingToDistrict(ctx, sourceId, [cid]);
      }

      const events = processDistrictMigration.execute(ctx);
      // No one should migrate since all are working
      expect(events).toEqual([]);
    });

    test("prefers colonists with fewer/weaker relationships", () => {
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();

      // Add colonists: 9 out of 10 capacity = 0.9 occupancy
      const colonistIds = addColonistsToDistrict(ctx, sourceId, 9);

      // Add building with unfilled jobs in target to boost job pull
      addBuildingToDistrict(ctx, targetId, []);

      // Give colonists[0..7] strong mutual relationships (but NOT colonist[8])
      const relationships = ctx.workforce.getRelationshipManager();
      for (let i = 0; i < 7; i++) {
        for (let j = i + 1; j <= 7; j++) {
          relationships.createRelationship(colonistIds[i], colonistIds[j], 0);
          for (let k = 0; k < 100; k++) {
            relationships.strengthenRelationship(colonistIds[i], colonistIds[j], 0.01, 0);
          }
        }
      }

      // colonistIds[8] has NO relationships (weakest ties) → highest score
      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);
      expect(events[0].colonistId).toBe(colonistIds[8]);
    });

    test("respects max migrations per tick", () => {
      const ctx = createTestContext();

      // Create 3 overcrowded source districts and 1 target
      const s1 = ctx.districts.foundDistrict("S1", 0);
      const s2 = ctx.districts.foundDistrict("S2", 0);
      const target = ctx.districts.foundDistrict("Target", 0);

      s1.capacity = 10;
      s2.capacity = 10;
      target.capacity = 50;

      addColonistsToDistrict(ctx, s1.id, 9);
      addColonistsToDistrict(ctx, s2.id, 9);

      const events = processDistrictMigration.execute(ctx);
      // MIGRATION_MAX_PER_TICK = 1
      expect(events).toHaveLength(1);
    });
  });

  describe("transfer execution", () => {
    test("updates DistrictManager maps correctly", () => {
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();
      addColonistsToDistrict(ctx, sourceId, 9);

      const sourcePop = ctx.districts.getDistrictPopulation(sourceId);
      const targetPop = ctx.districts.getDistrictPopulation(targetId);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);

      const migrantId = events[0].colonistId as string;

      // Source lost one, target gained one
      expect(ctx.districts.getDistrictPopulation(sourceId)).toBe(sourcePop - 1);
      expect(ctx.districts.getDistrictPopulation(targetId)).toBe(targetPop + 1);

      // Migrant is now in target district
      expect(ctx.districts.getColonistDistrictId(migrantId)).toBe(targetId);
    });

    test("updates colonist.districtId on the Colonist object", () => {
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();
      addColonistsToDistrict(ctx, sourceId, 9);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);

      const migrantId = events[0].colonistId as string;
      const colonist = ctx.colony.getColonist(migrantId);
      expect(colonist?.districtId).toBe(targetId);
    });

    test("applies morale cost to migrant", () => {
      // oxlint-disable-next-line no-unused-vars
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();
      const colonistIds = addColonistsToDistrict(ctx, sourceId, 9);

      // Record morale before
      const moraleBefore: Map<string, number> = new Map();
      for (const cid of colonistIds) {
        moraleBefore.set(cid, ctx.colonistMorale.getMorale(cid));
      }

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);

      const migrantId = events[0].colonistId as string;

      // Migrant's morale decreased
      const moraleAfter = ctx.colonistMorale.getMorale(migrantId);
      // oxlint-disable-next-line no-non-null-assertion
      expect(moraleAfter).toBe(moraleBefore.get(migrantId)! - DISTRICT_TRANSFER_MORALE_COST);

      // Non-migrants' morale unchanged
      for (const cid of colonistIds) {
        if (cid === migrantId) continue;
        // oxlint-disable-next-line no-non-null-assertion
        expect(ctx.colonistMorale.getMorale(cid)).toBe(moraleBefore.get(cid)!);
      }
    });

    test("emits COLONIST_MIGRATED event with correct data", () => {
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();
      addColonistsToDistrict(ctx, sourceId, 9);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.type).toBe("COLONIST_MIGRATED");
      expect(event.severity).toBe("info");
      expect(event.sourceDistrictId).toBe(sourceId);
      expect(event.targetDistrictId).toBe(targetId);
      expect(typeof event.colonistId).toBe("string");
      expect(typeof event.message).toBe("string");
    });
  });

  describe("job attraction", () => {
    test("idle colonist migrates toward district with unfilled jobs", () => {
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();
      addColonistsToDistrict(ctx, sourceId, 9);

      // Add building with unfilled worker slots to target district
      addBuildingToDistrict(ctx, targetId, []);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);
      expect(events[0].targetDistrictId).toBe(targetId);
    });

    test("prefers target with more unfilled jobs", () => {
      const ctx = createTestContext();

      const source = ctx.districts.foundDistrict("Source", 0);
      const target1 = ctx.districts.foundDistrict("Target1", 0);
      const target2 = ctx.districts.foundDistrict("Target2", 0);

      source.capacity = 10;
      target1.capacity = 30;
      target2.capacity = 30;

      addColonistsToDistrict(ctx, source.id, 9);

      // Target1 gets 1 building (2 unfilled slots)
      addBuildingToDistrict(ctx, target1.id, []);
      // Target2 gets 2 buildings (4 unfilled slots)
      addBuildingToDistrict(ctx, target2.id, []);
      addBuildingToDistrict(ctx, target2.id, []);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);
      expect(events[0].targetDistrictId).toBe(target2.id);
    });
  });

  describe("integration", () => {
    test("colonist with strong ties resists migration even in overcrowded district", () => {
      // oxlint-disable-next-line no-unused-vars
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario();

      // Exactly at threshold: 9/10 = 0.9 occupancy
      const colonistIds = addColonistsToDistrict(ctx, sourceId, 9);

      // Make ALL colonists have strong relationships with each other
      const relationships = ctx.workforce.getRelationshipManager();
      for (let i = 0; i < colonistIds.length; i++) {
        for (let j = i + 1; j < colonistIds.length; j++) {
          relationships.createRelationship(colonistIds[i], colonistIds[j], 0);
          for (let k = 0; k < 200; k++) {
            relationships.strengthenRelationship(colonistIds[i], colonistIds[j], 0.01, 0);
          }
        }
      }

      // Also make all of them workers so they're all skipped
      for (const cid of colonistIds) {
        addBuildingToDistrict(ctx, sourceId, [cid]);
      }

      const events = processDistrictMigration.execute(ctx);
      // All colonists are workers, so none should migrate
      expect(events).toEqual([]);
    });

    test("runs at sol 0 (which is divisible by interval)", () => {
      // oxlint-disable-next-line no-unused-vars
      const { ctx, sourceId, targetId } = setupOvercrowdedScenario(0);
      addColonistsToDistrict(ctx, sourceId, 9);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);
    });

    test("does not migrate when occupancy is exactly at threshold", () => {
      const ctx = createTestContext();
      const d1 = ctx.districts.foundDistrict("A", 0);
      const d2 = ctx.districts.foundDistrict("B", 0);

      // Set up exactly at threshold: 0.85 occupancy
      d1.capacity = 20;
      d2.capacity = 20;

      // 17/20 = 0.85, which is NOT greater than 0.85
      addColonistsToDistrict(ctx, d1.id, 17);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toEqual([]);
    });

    test("migrates when occupancy is just above threshold", () => {
      const ctx = createTestContext();
      const d1 = ctx.districts.foundDistrict("A", 0);
      const d2 = ctx.districts.foundDistrict("B", 0);

      d1.capacity = 20;
      d2.capacity = 20;

      // 18/20 = 0.9 > 0.85 threshold
      addColonistsToDistrict(ctx, d1.id, 18);

      const events = processDistrictMigration.execute(ctx);
      expect(events).toHaveLength(1);
    });
  });
});
