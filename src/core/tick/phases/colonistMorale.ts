import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";
import { COLONIST_MORALE } from "../../balance/MoraleBalance";

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
