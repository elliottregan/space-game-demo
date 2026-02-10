import type { Colonist, ColonistIdeology } from "../../models/Colonist";
import { getProject } from "../../data/projects";
import type { GameEvent } from "../../models/GameEvent";
import {
  ProjectEffectType,
  AXIS_KEYS,
  type ProductionModifierParams,
  type Project,
  type ProjectId,
  type RecurringEventParams,
} from "../../models/NPCInfluence";
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
 * Process onCompletionEffects for a project.
 * This handles recurring events and production modifiers.
 */
function processProjectOnCompletionEffects(
  project: Project,
  ctx: {
    scheduler: {
      register: (projectId: ProjectId, params: RecurringEventParams, currentSol: number) => void;
    };
    resources: {
      addProductionBonus: (
        sourceId: string,
        resource: "food" | "water" | "materials",
        amount: number,
      ) => void;
    };
    currentSol: number;
  },
): void {
  if (!project.onCompletionEffects) return;

  for (const effect of project.onCompletionEffects) {
    switch (effect.type) {
      case ProjectEffectType.RECURRING_EVENT: {
        const params = effect.params as RecurringEventParams;
        ctx.scheduler.register(project.id, params, ctx.currentSol);
        break;
      }
      case ProjectEffectType.PRODUCTION_MODIFIER: {
        const params = effect.params as ProductionModifierParams;
        // Power is handled by the grid system, not resource production
        if (params.resource !== "power") {
          ctx.resources.addProductionBonus(project.id, params.resource, params.amount);
        }
        break;
      }
      case ProjectEffectType.CONVICTION_BOOST: {
        // No longer handled here - conviction is managed by the axis-based ideology system
        break;
      }
      case ProjectEffectType.IMMIGRATION_IDEOLOGY_BIAS: {
        // Handled elsewhere during immigration events
        break;
      }
    }
  }
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

/**
 * Process Project Votes Phase
 *
 * Processes any pending project proposals that have reached their vote date.
 * The council votes based on faction alignment - projects pass if their
 * faction has more council votes than all other factions combined.
 */
export const processProjectVotes = definePhase({
  id: "ideology:processProjectVotes",
  name: "Process Project Votes",
  reads: ["ideology", "colony", "workforce", "currentSol", "victory", "scheduler"],
  writes: ["ideology", "victory", "resources", "scheduler"],
  execute(ctx) {
    const events: GameEvent[] = [];

    // Process any votes that are due
    const voteResults = ctx.ideology.processVotes(ctx.currentSol);

    for (const result of voteResults) {
      const project = getProject(result.projectId);
      if (!project) continue;

      if (result.passed) {
        // Check for capstone completion (unlocks megastructure building)
        const capstoneEvent = ctx.victory.checkCapstoneVictory(result.projectId);
        if (capstoneEvent) {
          events.push(capstoneEvent);
          // Don't return - capstones unlock megastructures but don't win the game
        }

        // Apply colony-wide morale boost if specified
        if (project.effects?.colonyMoraleBoost) {
          ctx.colonistMorale.adjustAllColonistsMorale(project.effects.colonyMoraleBoost);
        }

        // Apply population bonus if specified
        if (project.effects?.populationBonus && project.effects.populationBonus > 0) {
          for (let i = 0; i < project.effects.populationBonus; i++) {
            ctx.colony.addColonist();
          }
        }

        // Apply resource production bonuses if specified
        if (project.effects?.foodBonus) {
          ctx.resources.addProduction({ food: project.effects.foodBonus });
        }
        if (project.effects?.materialsBonus) {
          ctx.resources.addProduction({ materials: project.effects.materialsBonus });
        }

        // Process onCompletionEffects (recurring events, production modifiers, etc.)
        processProjectOnCompletionEffects(project, ctx);

        events.push({
          type: "project_passed",
          severity: "info",
          message: `Project "${project.name}" passed the council vote (${result.votesFor}-${result.votesAgainst})`,
          details: {
            projectId: result.projectId,
            votesFor: result.votesFor,
            votesAgainst: result.votesAgainst,
          },
        });
      } else {
        events.push({
          type: "project_failed",
          severity: "info",
          message: `Project "${project.name}" failed the council vote (${result.votesFor}-${result.votesAgainst})`,
          details: {
            projectId: result.projectId,
            votesFor: result.votesFor,
            votesAgainst: result.votesAgainst,
          },
        });
      }
    }

    return events;
  },
});
