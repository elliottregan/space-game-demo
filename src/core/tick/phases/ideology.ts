import type { Colonist, ColonistIdeology } from "../../models/Colonist";
import type { GameEvent } from "../../models/GameEvent";
import { AXIS_KEYS } from "../../models/NPCInfluence";
import { definePhase } from "../TickPhase";
import { IdeologyManager } from "../../systems/IdeologyManager";
import * as IdeologyBalance from "../../balance/IdeologyBalance";

/**
 * Check if a colonist has neutral/unimprinted ideology.
 * Returns true if all axis values are near 0 (within NEUTRAL_AXIS_THRESHOLD)
 * AND conviction is low (<= NEW_COLONIST_IDEOLOGY.conviction).
 */
function isNeutralIdeology(colonist: { ideology?: ColonistIdeology }): boolean {
  if (!colonist.ideology) return false;

  const ideology = colonist.ideology;
  const allAxesNearZero = AXIS_KEYS.every(
    (axis) => Math.abs(ideology[axis]) <= IdeologyBalance.NEUTRAL_AXIS_THRESHOLD,
  );

  return allAxesNearZero && ideology.conviction <= IdeologyBalance.NEW_COLONIST_IDEOLOGY.conviction;
}

/**
 * Propagate Ideology Phase
 *
 * Spreads ideology through the colonist social network.
 * Colonists' ideologies drift toward their neighbors' weighted average.
 * Also updates the council based on centrality x conviction.
 *
 * Additionally, new colonists with neutral ideology get "imprinted"
 * with the ideology of their strongest connection, creating ideological
 * clustering in the social network.
 *
 * After propagation, runs the faction dynamics pipeline:
 * pressure update, position drift, pressure decay, naming,
 * policy processing, defections, mergers, and collapses.
 */
export const propagateIdeology = definePhase({
  id: "ideology:propagateIdeology",
  name: "Propagate Ideology",
  reads: [
    "ideology",
    "colony",
    "workforce",
    "currentSol",
    "resources",
    "buildings",
    "districts",
    "technology",
  ],
  writes: ["ideology"],
  execute(ctx) {
    const events: GameEvent[] = [];
    const colonists = ctx.colony.getColonists();
    const relationshipManager = ctx.workforce.getRelationshipManager();

    // Imprint ideology on new/neutral colonists from their strongest connection
    // This creates ideological "pockets" in the network
    for (const colonist of colonists) {
      if (isNeutralIdeology(colonist)) {
        IdeologyManager.imprintIdeologyFromNeighbors(colonist, colonists, relationshipManager);
      }
    }

    // Propagate ideology through social network
    ctx.ideology.propagateIdeology(colonists, relationshipManager, ctx.currentSol);

    // Update council if stale
    ctx.ideology.updateCouncilIfStale(colonists, relationshipManager, ctx.currentSol);

    // Update faction pressure from colony conditions
    ctx.ideology.updateFactionPressure({
      resources: ctx.resources,
      colony: ctx.colony,
      buildings: ctx.buildings,
      districts: ctx.districts,
      technology: ctx.technology,
    });

    // Drift faction positions toward accumulated pressure
    ctx.ideology.driftFactionPositions(colonists);

    // Decay faction pressure toward zero
    ctx.ideology.decayFactionPressure();

    // Update faction names based on axis positions
    events.push(...ctx.ideology.updateFactionNames());

    // Process active policy effects (policies also rally conviction of aligned colonists)
    events.push(...ctx.ideology.processActivePolicy(ctx.currentSol, colonists));

    // Process colonist defections between factions
    events.push(...ctx.ideology.processDefections(colonists));

    // Check for faction mergers (convergent factions)
    events.push(...ctx.ideology.checkFactionMerger());

    // Check for faction collapses (insufficient support)
    events.push(...ctx.ideology.checkFactionCollapse(colonists));

    return events;
  },
});
