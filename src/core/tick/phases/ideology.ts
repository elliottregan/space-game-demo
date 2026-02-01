import { getProject } from "../../data/projects";
import type { GameEvent } from "../../events/GameEvent";
import { definePhase } from "../TickPhase";

/**
 * Propagate Ideology Phase
 *
 * Spreads ideology through the colonist social network.
 * Colonists' ideologies drift toward their neighbors' weighted average.
 * Also updates the council based on centrality × conviction.
 */
export const propagateIdeology = definePhase({
  id: "ideology:propagateIdeology",
  name: "Propagate Ideology",
  reads: ["ideology", "colony", "workforce", "currentSol"],
  writes: ["ideology"],
  execute(ctx) {
    const colonists = ctx.colony.getColonists();
    const relationshipManager = ctx.workforce.getRelationshipManager();

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
  reads: ["ideology", "colony", "workforce", "currentSol", "victory"],
  writes: ["ideology", "victory"],
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

        events.push({
          type: "project_passed",
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
