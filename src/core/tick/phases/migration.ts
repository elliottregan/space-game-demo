import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";
import {
  MIGRATION_CHECK_INTERVAL,
  MIGRATION_OVERCROWDING_THRESHOLD,
  MIGRATION_SPACE_THRESHOLD,
  MIGRATION_MAX_PER_TICK,
  MIGRATION_MIN_DISTRICTS,
  MIGRATION_OVERCROWDING_WEIGHT,
  MIGRATION_JOB_PULL_WEIGHT,
  MIGRATION_SOCIAL_ANCHOR_WEIGHT,
  MIGRATION_WEAK_ATTACHMENT_THRESHOLD,
  DISTRICT_TRANSFER_MORALE_COST,
} from "../../balance/DistrictBalance";

interface DistrictMetrics {
  districtId: string;
  population: number;
  capacity: number;
  occupancy: number;
  unfilledJobs: number;
}

function getDistrictUnfilledJobs(districtId: string, ctx: TickContext): number {
  const district = ctx.districts.getDistrict(districtId);
  if (!district) return 0;
  let unfilled = 0;
  for (const buildingId of district.buildingIds) {
    const building = ctx.buildings.getBuilding(buildingId);
    if (!building || building.status !== "active") continue;
    const def = ctx.buildings.getDefinition(building.definitionId);
    const slots = def?.workerSlots ?? 0;
    if (slots > 0) {
      unfilled += Math.max(0, slots - building.assignedWorkers.length);
    }
  }
  return unfilled;
}

function isWorkingInDistrict(colonistId: string, districtId: string, ctx: TickContext): boolean {
  const district = ctx.districts.getDistrict(districtId);
  if (!district) return false;
  for (const buildingId of district.buildingIds) {
    const building = ctx.buildings.getBuilding(buildingId);
    if (!building) continue;
    if (building.assignedWorkers.includes(colonistId)) return true;
  }
  return false;
}

function getDistrictRelationshipSum(
  colonistId: string,
  districtId: string,
  ctx: TickContext,
): number {
  const relationships = ctx.workforce.getRelationshipManager();
  const districtColonists = ctx.districts.getDistrictColonistIds(districtId);
  let sum = 0;
  for (const otherId of districtColonists) {
    if (otherId === colonistId) continue;
    sum += relationships.getRelationshipStrength(colonistId, otherId);
  }
  return sum;
}

/**
 * District Migration Phase
 *
 * Automatically migrates idle colonists from overcrowded districts
 * to districts with available space and jobs. Colonists with weaker
 * social ties migrate first.
 */
export const processDistrictMigration = definePhase({
  id: "colony:districtMigration",
  name: "District Migration",
  reads: ["colony", "districts", "buildings", "workforce", "colonistMorale"],
  writes: ["colony", "districts", "colonistMorale", "events"],
  execute(ctx: TickContext): GameEvent[] {
    // Guard: only run on interval
    if (ctx.currentSol % MIGRATION_CHECK_INTERVAL !== 0) return [];

    const allDistricts = ctx.districts.getDistricts();

    // Guard: need at least 2 districts
    if (allDistricts.length < MIGRATION_MIN_DISTRICTS) return [];

    // Compute per-district metrics
    const metrics: DistrictMetrics[] = allDistricts.map((d) => {
      const population = ctx.districts.getDistrictPopulation(d.id);
      const capacity = d.capacity;
      const occupancy = capacity > 0 ? population / capacity : 0;
      const unfilledJobs = getDistrictUnfilledJobs(d.id, ctx);
      return { districtId: d.id, population, capacity, occupancy, unfilledJobs };
    });

    const sources = metrics.filter((m) => m.occupancy > MIGRATION_OVERCROWDING_THRESHOLD);
    const targets = metrics.filter((m) => m.occupancy < MIGRATION_SPACE_THRESHOLD);

    // Guard: need both sources and targets
    if (sources.length === 0 || targets.length === 0) return [];

    // Find best target: most unfilled jobs, tiebreak by most available space
    const bestTarget = targets.reduce((best, t) => {
      if (t.unfilledJobs > best.unfilledJobs) return t;
      if (t.unfilledJobs === best.unfilledJobs) {
        const tSpace = t.capacity - t.population;
        const bestSpace = best.capacity - best.population;
        if (tSpace > bestSpace) return t;
      }
      return best;
    });

    const events: GameEvent[] = [];
    let migrationsThisTick = 0;

    for (const source of sources) {
      if (migrationsThisTick >= MIGRATION_MAX_PER_TICK) break;

      const colonistIds = ctx.districts.getDistrictColonistIds(source.districtId);

      // Score each candidate
      const candidates: { colonistId: string; score: number }[] = [];
      for (const colonistId of colonistIds) {
        // Skip colonists working in this district
        if (isWorkingInDistrict(colonistId, source.districtId, ctx)) continue;

        const overcrowdingPush =
          MIGRATION_OVERCROWDING_WEIGHT * (source.occupancy - MIGRATION_OVERCROWDING_THRESHOLD);

        const sourceJobs = source.unfilledJobs;
        const targetJobs = bestTarget.unfilledJobs;
        const jobRatio =
          sourceJobs === 0 && targetJobs > 0
            ? 2.0
            : Math.min(2, targetJobs / Math.max(1, sourceJobs));
        const jobPull = MIGRATION_JOB_PULL_WEIGHT * jobRatio;

        const relSum = getDistrictRelationshipSum(colonistId, source.districtId, ctx);
        const socialAnchor =
          MIGRATION_SOCIAL_ANCHOR_WEIGHT *
          Math.min(1, relSum / MIGRATION_WEAK_ATTACHMENT_THRESHOLD);

        const score = overcrowdingPush + jobPull - socialAnchor;
        if (score > 0) {
          candidates.push({ colonistId, score });
        }
      }

      if (candidates.length === 0) continue;

      // Sort by score descending (weakest ties = highest score)
      candidates.sort((a, b) => b.score - a.score);

      const migrant = candidates[0]!;

      // Execute transfer
      const transferred = ctx.districts.transferColonist(migrant.colonistId, bestTarget.districtId);
      if (!transferred) continue;

      // Update colonist.districtId
      const colonist = ctx.colony.getColonist(migrant.colonistId);
      if (colonist) {
        colonist.districtId = bestTarget.districtId;
      }

      // Apply morale cost
      ctx.colonistMorale.adjustColonistMorale(migrant.colonistId, -DISTRICT_TRANSFER_MORALE_COST);

      events.push({
        type: "COLONIST_MIGRATED",
        severity: "info",
        message: `A colonist migrated from ${ctx.districts.getDistrict(source.districtId)?.name ?? source.districtId} to ${ctx.districts.getDistrict(bestTarget.districtId)?.name ?? bestTarget.districtId}`,
        colonistId: migrant.colonistId,
        sourceDistrictId: source.districtId,
        targetDistrictId: bestTarget.districtId,
      });

      migrationsThisTick++;
    }

    return events;
  },
});
