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
  reads: ["ideology", "colony", "workforce", "currentSol"],
  writes: ["ideology"],
  execute(ctx) {
    const events: GameEvent[] = [];
    const colonists = ctx.colony.getColonists();

    // Process any votes that are due
    const voteResults = ctx.ideology.processVotes(ctx.currentSol);

    for (const result of voteResults) {
      const project = getProject(result.projectId);
      if (!project) continue;

      if (result.passed) {
        // Apply morale effects for passed projects
        ctx.ideology.applyProjectMoraleEffects(project.type, colonists, ctx.colonistMorale);

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
