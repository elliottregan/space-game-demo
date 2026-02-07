// src/facade/domains/IdeologyFacade.ts

import type { GameState } from "../../core/GameState";
import { getProject, meetsAxisRequirements } from "../../core/data/projects";
import type { ProjectId } from "../../core/models/NPCInfluence";
import type { Result } from "../types/common";
import type { Queryable } from "../types/interfaces";
import type {
  IdeologySnapshot,
  FactionSnapshot,
  CouncilMemberSnapshot,
  ProjectEligibility,
} from "../types/ideology";

/**
 * Facade for ideology system queries.
 * Provides access to council, faction support, project eligibility, and policy declarations.
 *
 * Implements: Queryable<IdeologySnapshot>
 */
export class IdeologyFacade implements Queryable<IdeologySnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete ideology state snapshot.
   */
  snapshot(): IdeologySnapshot {
    const council = this.getCouncil();
    const councilFactionCounts = this.gameState.ideology.getCouncilFactionCounts();
    const factionSupport = this.getFactionSupport();
    const factions = this.getFactions();

    return {
      council,
      councilFactionCounts,
      factionSupport,
      factions,
    };
  }

  /**
   * Get current council members.
   */
  getCouncil(): CouncilMemberSnapshot[] {
    return [...this.gameState.ideology.getCouncil()];
  }

  /**
   * Get colony-wide faction support levels keyed by faction id.
   */
  getFactionSupport(): Record<string, number> {
    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    return this.gameState.ideology.calculateFactionSupport(colonists, relationshipManager);
  }

  /**
   * Get current faction states.
   */
  getFactions(): FactionSnapshot[] {
    return this.gameState.ideology.getFactions().map((f) => ({
      id: f.id,
      name: f.name,
      baseId: f.baseId,
      position: { ...f.position },
      pressure: { ...f.pressure },
    }));
  }

  /**
   * Get the currently active policy, or null.
   */
  getActivePolicy(): { policy: { id: string; name: string; axis: string; direction: number; strength: number; duration: number }; startSol: number } | null {
    return this.gameState.ideology.getActivePolicy();
  }

  /**
   * Declare a policy, replacing any existing one.
   * Returns true if the policy was successfully declared.
   */
  declarePolicy(policyId: string): boolean {
    return this.gameState.ideology.declarePolicy(policyId, this.gameState.currentSol);
  }

  /**
   * Find the faction best suited to champion a project based on axis requirements.
   * Returns the first faction whose position meets all axis requirements, or undefined.
   */
  private findChampionFaction(projectId: ProjectId): { factionId: string } | undefined {
    const project = getProject(projectId);
    if (!project) return undefined;

    const factions = this.gameState.ideology.getFactions();
    for (const faction of factions) {
      if (meetsAxisRequirements(faction.position, project)) {
        return { factionId: faction.id };
      }
    }

    return undefined;
  }

  /**
   * Check if a project can be proposed.
   * Finds a faction that meets axis requirements and delegates to IdeologyManager.
   */
  canProposeProject(projectId: ProjectId): ProjectEligibility {
    const project = getProject(projectId);
    if (!project) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "Project not found",
      };
    }

    // Check if already completed
    if (this.gameState.ideology.isProjectCompleted(projectId)) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "Project already completed",
        isCompleted: true,
      };
    }

    // Check if pending vote
    if (this.gameState.ideology.isPendingProposal(projectId)) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "Project awaiting council vote",
        isPending: true,
      };
    }

    // Check if failed vote (can be retried later)
    if (this.gameState.ideology.isFailedProposal(projectId)) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "Project failed council vote",
        isFailed: true,
      };
    }

    // Find a faction that can champion this project
    const champion = this.findChampionFaction(projectId);
    if (!champion) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "No faction meets axis requirements for this project",
      };
    }

    const canAfford = this.gameState.resources.canAfford(project.proposalCost);
    if (!canAfford) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "Cannot afford proposal cost",
      };
    }

    // Delegate to core IdeologyManager for prerequisite/requirement checks
    const coreCheck = this.gameState.ideology.canProposeProject(
      project,
      champion.factionId,
      {
        technology: this.gameState.technology,
        buildings: this.gameState.buildings,
        colony: this.gameState.colony,
        resources: this.gameState.resources,
      },
    );

    if (!coreCheck.canPropose) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: coreCheck.reason,
      };
    }

    return {
      canPropose: true,
      currentSupport: 0,
      requiredSupport: 0,
    };
  }

  /**
   * Submit a project proposal for council vote.
   * Deducts cost and starts the voting period.
   * The vote will be processed after PROJECT_VOTING_PERIOD sols.
   */
  proposeProject(projectId: ProjectId): Result<{ projectId: ProjectId; voteSol: number }> {
    const eligibility = this.canProposeProject(projectId);
    if (!eligibility.canPropose) {
      return {
        success: false,
        error: {
          type: "INVALID_STATE",
          current: "ineligible",
          expected: "eligible",
          reason: eligibility.reason || "Cannot propose project",
        },
      };
    }

    const project = getProject(projectId);
    if (!project) {
      return {
        success: false,
        error: {
          type: "INVALID_STATE",
          current: "not_found",
          expected: "exists",
          reason: "Project not found",
        },
      };
    }

    // Deduct cost
    this.gameState.resources.deduct(project.proposalCost);

    // Find the champion faction to submit on behalf of
    const champion = this.findChampionFaction(projectId);
    const factionId = champion?.factionId ?? "";

    // Submit for vote
    const currentSol = this.gameState.currentSol;
    this.gameState.ideology.submitProposal(projectId, factionId, currentSol);

    const proposal = this.gameState.ideology.getPendingProposal(projectId);
    return { success: true, data: { projectId, voteSol: proposal?.voteSol ?? currentSol + 10 } };
  }

  /**
   * Get the vote projection for a faction.
   */
  getVoteProjection(factionId: string): {
    votesFor: number;
    votesAgainst: number;
    wouldPass: boolean;
  } {
    return this.gameState.ideology.getVoteProjection(factionId);
  }

  /**
   * Get all pending proposals.
   */
  getPendingProposals(): readonly import("../../core/systems/IdeologyManager").PendingProposal[] {
    return this.gameState.ideology.getPendingProposals();
  }

  /**
   * Get list of failed project IDs.
   */
  getFailedProposals(): readonly ProjectId[] {
    return this.gameState.ideology.getFailedProposals();
  }

  /**
   * Clear a failed proposal so it can be proposed again.
   */
  clearFailedProposal(projectId: ProjectId): void {
    this.gameState.ideology.clearFailedProposal(projectId);
  }

  /**
   * Get list of completed project IDs.
   */
  getCompletedProjects(): readonly ProjectId[] {
    return this.gameState.ideology.getCompletedProjects();
  }
}
