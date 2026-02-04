import type { Colonist } from "../../models/Colonist";
import { getProject } from "../../data/projects";
import type { GameEvent } from "../../models/GameEvent";
import {
  NPCFaction,
  ProjectEffectType,
  type ConvictionBoostParams,
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
 * Returns true if all three affinities are close to 0.33 (neutral).
 */
function isNeutralIdeology(colonist: {
  ideology?: {
    earthLoyalist: number;
    marsIndependence: number;
    corporateInterests: number;
    conviction: number;
  };
}): boolean {
  if (!colonist.ideology) return false;
  const { earthLoyalist, marsIndependence, corporateInterests, conviction } = colonist.ideology;

  // Check if ideology is still near neutral (within 0.05 of 0.33)
  const neutralThreshold = 0.05;
  const isNeutral =
    Math.abs(earthLoyalist - 0.33) < neutralThreshold &&
    Math.abs(marsIndependence - 0.33) < neutralThreshold &&
    Math.abs(corporateInterests - 0.33) < neutralThreshold;

  // Only imprint if conviction is low (new colonist)
  return isNeutral && conviction <= IdeologyBalance.NEW_COLONIST_IDEOLOGY.conviction;
}

/**
 * Process onCompletionEffects for a project.
 * This handles recurring events, production modifiers, and conviction boosts.
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
    ideology: {
      boostFactionConviction: (faction: NPCFaction, amount: number, colonists: Colonist[]) => void;
    };
    colony: { getColonists: () => Colonist[] };
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
        const params = effect.params as ConvictionBoostParams;
        ctx.ideology.boostFactionConviction(
          params.faction,
          params.amount,
          ctx.colony.getColonists(),
        );
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
 * Also updates the council based on centrality × conviction.
 *
 * Additionally, new colonists with neutral ideology get "imprinted"
 * with the ideology of their strongest connection, creating ideological
 * clustering in the social network.
 */
export const propagateIdeology = definePhase({
  id: "ideology:propagateIdeology",
  name: "Propagate Ideology",
  reads: ["ideology", "colony", "workforce", "currentSol"],
  writes: ["ideology"],
  execute(ctx) {
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

    return [];
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
    const colonists = ctx.colony.getColonists();

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

        // Apply morale and conviction effects for passed projects
        ctx.ideology.applyProjectMoraleEffects(project, colonists, ctx.colonistMorale);

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
