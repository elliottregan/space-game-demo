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
 * Calculate Policy Effects Phase
 *
 * Computes policy effects (morale and health modifiers) from operations.
 * Populates derived.policyEffects for use by later phases.
 */
export const calculatePolicyEffects = definePhase({
  id: "colony:calculatePolicyEffects",
  name: "Calculate Policy Effects",
  reads: ["operations"],
  writes: ["derived.policyEffects"],
  execute(ctx: TickContext): GameEvent[] {
    ctx.derived.policyEffects = {
      morale: ctx.operations.getMoraleEffect(),
      health: ctx.operations.getHealthEffect(),
    };
    return [];
  },
});

/**
 * Process Colony Tick Phase
 *
 * Handles population growth, health changes, morale changes, and consumption.
 * Uses derived.socialCohesion, derived.policyEffects, and derived.airQualityEffects
 * computed by earlier phases.
 */
export const processColonyTick = definePhase({
  id: "colony:processColonyTick",
  name: "Process Colony Tick",
  reads: [
    "colony",
    "resources",
    "buildings",
    "derived.socialCohesion",
    "derived.policyEffects",
    "derived.airQualityEffects",
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

    // Combine policy effects with air quality effects
    const policyEffects = ctx.derived.policyEffects ?? { morale: 0, health: 0 };
    const airQualityEffects = ctx.derived.airQualityEffects ?? { health: 0, morale: 0 };

    const combinedEffects = {
      morale: policyEffects.morale + airQualityEffects.morale,
      health: policyEffects.health + airQualityEffects.health,
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
 * Assign Housing Phase
 *
 * Assigns colonists to available housing.
 */
export const assignHousing = definePhase({
  id: "colony:assignHousing",
  name: "Assign Housing",
  reads: ["colony", "buildings"],
  writes: ["colony"],
  execute(ctx: TickContext): GameEvent[] {
    ctx.colony.assignHousing(ctx.buildings);
    return [];
  },
});
