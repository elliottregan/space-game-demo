import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";
import { COLONIST_MORALE } from "../../balance/MoraleBalance";

/**
 * Visit Social Buildings Phase
 *
 * Colonists visiting social buildings (third places) receive a per-sol morale boost.
 * Boost = building's moraleBoost / SOCIAL_BUILDING_BOOST_DIVISOR.
 */
export const visitSocialBuildings = definePhase({
  id: "colony:visitSocialBuildings",
  name: "Visit Social Buildings",
  reads: ["colony", "buildings", "colonistMorale"],
  writes: ["colonistMorale"],
  execute(ctx: TickContext): GameEvent[] {
    const colonists = ctx.colony.getColonists();

    for (const colonist of colonists) {
      if (!colonist.socialBuildingIds?.length) continue;

      let totalBoost = 0;
      for (const buildingId of colonist.socialBuildingIds) {
        const building = ctx.buildings.getBuilding(buildingId);
        if (!building || building.status !== "active") continue;

        const def = ctx.buildings.getDefinition(building.definitionId);
        if (def?.moraleBoost) {
          totalBoost += def.moraleBoost / COLONIST_MORALE.SOCIAL_BUILDING_BOOST_DIVISOR;
        }
      }

      if (totalBoost > 0) {
        const current = ctx.colonistMorale.getMorale(colonist.id);
        ctx.colonistMorale.setMorale(colonist.id, Math.min(100, current + totalBoost));
      }
    }
    return [];
  },
});

/**
 * Propagate Colonist Morale Phase
 *
 * Recalculates centrality if stale and propagates individual morale
 * through the social network. Updates colony-wide morale from individual morales.
 */
export const propagateColonistMorale = definePhase({
  id: "colony:propagateColonistMorale",
  name: "Propagate Colonist Morale",
  reads: ["colony", "workforce", "resources", "colonistMorale"],
  writes: ["colony", "colonistMorale"],
  execute(ctx: TickContext): GameEvent[] {
    const relationships = ctx.workforce.getRelationshipManager();
    const colonists = ctx.colony.getColonists();

    // Recalculate centrality if stale
    relationships.recalculateCentralityIfStale(
      ctx.currentSol,
      COLONIST_MORALE.CENTRALITY_RECALC_INTERVAL,
    );

    // Propagate individual morale through social network
    ctx.colonistMorale.propagateMorale(colonists, ctx.resources, relationships, ctx.colony);

    // Sync colony-wide morale from individual morales
    const colonyMorale = ctx.colonistMorale.getColonyMorale(colonists, relationships);
    ctx.colony.setMorale(colonyMorale);

    return [];
  },
});
