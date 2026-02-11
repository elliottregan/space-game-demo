import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Calculate Social Cohesion Phase
 *
 * Computes social cohesion metrics from workforce relationships.
 * Populates derived.socialCohesion for use by later phases.
 */
export const calculateSocialCohesion = definePhase({
  id: "colony:calculateSocialCohesion",
  name: "Calculate Social Cohesion",
  reads: ["colony", "workforce"],
  writes: ["derived.socialCohesion"],
  execute(ctx: TickContext): GameEvent[] {
    const colonistIds = ctx.colony.getColonists().map((c) => c.id);

    // WorkforceManager.getColonySocialCohesion returns a single cohesion number
    const cohesion = ctx.workforce.getColonySocialCohesion(colonistIds);
    const isolatedColonists = ctx.workforce.getIsolatedColonists(colonistIds);

    ctx.derived.socialCohesion = {
      averageClusteringCoefficient: cohesion,
      averageConnectionCount: 0, // Not used by ColonyManager, but part of SocialCohesionData interface
      isolatedCount: isolatedColonists.length,
      isolatedColonists,
    };
    return [];
  },
});

/**
 * Process Colony Tick Phase
 *
 * Handles population growth, health changes, morale changes, and consumption.
 * Uses derived.socialCohesion and derived.lifeSupportEffects computed by earlier phases.
 */
export const processColonyTick = definePhase({
  id: "colony:processColonyTick",
  name: "Process Colony Tick",
  reads: [
    "colony",
    "resources",
    "buildings",
    "derived.socialCohesion",
    "derived.lifeSupportEffects",
  ],
  writes: ["colony", "resources", "events"],
  execute(ctx: TickContext): GameEvent[] {
    // Convert SocialCohesionData to the format ColonyManager.tick expects
    const socialCohesionForColony = ctx.derived.socialCohesion
      ? {
          cohesion: ctx.derived.socialCohesion.averageClusteringCoefficient,
          isolatedColonists: ctx.derived.socialCohesion.isolatedColonists,
        }
      : { cohesion: 0, isolatedColonists: [] };

    // Use life support effects (no policy effects since policies were removed)
    const lifeSupportEffects = ctx.derived.lifeSupportEffects ?? { health: 0, morale: 0 };

    const combinedEffects = {
      morale: lifeSupportEffects.morale,
      health: lifeSupportEffects.health,
    };

    return ctx.colony.tick(ctx.resources, ctx.buildings, combinedEffects, socialCohesionForColony);
  },
});

/**
 * Auto-Assign Workers Phase
 *
 * Automatically assigns newly born colonists to understaffed buildings.
 * Only runs when auto-assignment is enabled and there are unassigned colonists.
 */
export const autoAssignWorkers = definePhase({
  id: "colony:autoAssignWorkers",
  name: "Auto-Assign Workers",
  reads: ["colony", "buildings", "settings.autoAssignNewColonists"],
  writes: ["buildings", "events"],
  execute(ctx: TickContext): GameEvent[] {
    // Only run if auto-assignment is enabled
    if (!ctx.settings.autoAssignNewColonists) {
      return [];
    }
    return ctx.buildings.autoAssignAllWorkers(ctx.colony);
  },
});

/**
 * Assign to District Phase
 *
 * Assigns colonists without a district to available districts.
 */
export const assignToDistrict = definePhase({
  id: "colony:assignToDistrict",
  name: "Assign to District",
  reads: ["colony", "districts"],
  writes: ["districts"],
  execute(ctx: TickContext): GameEvent[] {
    const colonists = ctx.colony.getColonists();
    for (const colonist of colonists) {
      // Check if colonist already has a district
      if (ctx.districts.getColonistDistrictId(colonist.id)) continue;

      // Find a district with capacity
      const districts = ctx.districts.getDistricts();
      for (const district of districts) {
        if (ctx.districts.assignColonist(district.id, colonist.id)) {
          break;
        }
      }
    }
    return [];
  },
});
