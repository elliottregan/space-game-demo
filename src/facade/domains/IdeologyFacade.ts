// src/facade/domains/IdeologyFacade.ts

import type { GameState } from "../../core/GameState";
import { getProject } from "../../core/data/projects";
import type { NPCFaction, ProjectId } from "../../core/models/NPCInfluence";
import type { Result } from "../types/common";
import type { Queryable } from "../types/interfaces";
import type {
  IdeologySnapshot,
  FactionSupportSnapshot,
  CouncilMemberSnapshot,
  ProjectEligibility,
  LobbyEligibility,
} from "../types/ideology";

/**
 * Facade for ideology system queries.
 * Provides access to council, faction support, and project eligibility.
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

    return {
      council,
      councilFactionCounts,
      factionSupport,
    };
  }

  /**
   * Get current council members.
   */
  getCouncil(): CouncilMemberSnapshot[] {
    return [...this.gameState.ideology.getCouncil()];
  }

  /**
   * Get colony-wide faction support levels.
   */
  getFactionSupport(): FactionSupportSnapshot {
    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    return this.gameState.ideology.calculateFactionSupport(colonists, relationshipManager);
  }

  /**
   * Get support level for a specific faction.
   */
  getFactionSupportFor(faction: NPCFaction): number {
    const support = this.getFactionSupport();
    switch (faction) {
      case "earth_loyalists":
        return support.earthLoyalists;
      case "mars_independence":
        return support.marsIndependence;
      case "corporate_interests":
        return support.corporateInterests;
      default:
        return 0;
    }
  }

  /**
   * Check if a project can be proposed based on faction support.
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
      const currentSupport = this.getFactionSupportFor(project.type);
      return {
        canPropose: false,
        currentSupport,
        requiredSupport: project.requiredSupport,
        reason: "Project already completed",
        isCompleted: true,
      };
    }

    // Check if pending vote
    if (this.gameState.ideology.isPendingProposal(projectId)) {
      const currentSupport = this.getFactionSupportFor(project.type);
      return {
        canPropose: false,
        currentSupport,
        requiredSupport: project.requiredSupport,
        reason: "Project awaiting council vote",
        isPending: true,
      };
    }

    // Check if failed vote (can be retried later)
    if (this.gameState.ideology.isFailedProposal(projectId)) {
      const currentSupport = this.getFactionSupportFor(project.type);
      return {
        canPropose: false,
        currentSupport,
        requiredSupport: project.requiredSupport,
        reason: "Project failed council vote",
        isFailed: true,
      };
    }

    const currentSupport = this.getFactionSupportFor(project.type);
    const canAfford = this.gameState.resources.canAfford(project.proposalCost);

    if (!canAfford) {
      return {
        canPropose: false,
        currentSupport,
        requiredSupport: project.requiredSupport,
        reason: "Cannot afford proposal cost",
      };
    }

    if (currentSupport < project.requiredSupport) {
      return {
        canPropose: false,
        currentSupport,
        requiredSupport: project.requiredSupport,
        reason: `Insufficient faction support (need ${Math.round(project.requiredSupport * 100)}%)`,
      };
    }

    // Check capstone-specific requirements
    if (project.isCapstone) {
      const capstoneCheck = this.gameState.ideology.canProposeCapstone(project.type);
      if (!capstoneCheck.canPropose) {
        return {
          canPropose: false,
          currentSupport,
          requiredSupport: project.requiredCouncilSupport ?? 0.65,
          reason: capstoneCheck.reason,
        };
      }
    }

    return {
      canPropose: true,
      currentSupport,
      requiredSupport: project.requiredSupport,
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

    const project = getProject(projectId)!;

    // Deduct cost
    this.gameState.resources.deduct(project.proposalCost);

    // Submit for vote
    const currentSol = this.gameState.currentSol;
    this.gameState.ideology.submitProposal(projectId, project.type, currentSol);

    const proposal = this.gameState.ideology.getPendingProposal(projectId);
    return { success: true, data: { projectId, voteSol: proposal?.voteSol ?? currentSol + 10 } };
  }

  /**
   * Get the vote projection for a faction.
   */
  getVoteProjection(faction: NPCFaction): {
    votesFor: number;
    votesAgainst: number;
    wouldPass: boolean;
  } {
    return this.gameState.ideology.getVoteProjection(faction);
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

  // ============ Ideological Pressure ============

  /**
   * Get the ideological pressure a colonist experiences from their neighbors.
   * Returns the weighted average ideology neighbors are pushing toward,
   * along with pressure strength and conviction growth/decay rate.
   */
  getIdeologicalPressure(colonistId: string): {
    pressure: { earthLoyalist: number; marsIndependence: number; corporateInterests: number };
    totalWeight: number;
    neighborCount: number;
    convictionPressure: { growth: boolean; rate: number };
  } | null {
    const colonist = this.gameState.colony.getColonists().find((c) => c.id === colonistId);
    if (!colonist) return null;

    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    return this.gameState.ideology.calculateIdeologicalPressure(
      colonist,
      colonists,
      relationshipManager,
    );
  }

  // ============ Lobbying ============

  /**
   * Check if a council member can be lobbied.
   */
  canLobby(colonistId: string, faction: NPCFaction, affinityBoost: number): LobbyEligibility {
    const check = this.gameState.ideology.canLobby(colonistId);
    if (!check.canLobby) {
      return { canLobby: false, cost: Infinity, reason: check.reason };
    }

    const cost = this.gameState.ideology.getLobbyCost(colonistId, faction, affinityBoost);
    const canAfford = this.gameState.resources.canAfford({ materials: cost });

    if (!canAfford) {
      return { canLobby: false, cost, reason: "Cannot afford lobbying cost" };
    }

    return { canLobby: true, cost };
  }

  /**
   * Get the cost to lobby a council member.
   */
  getLobbyCost(colonistId: string, faction: NPCFaction, affinityBoost: number): number {
    return this.gameState.ideology.getLobbyCost(colonistId, faction, affinityBoost);
  }

  /**
   * Lobby a council member to boost their faction affinity.
   */
  lobbyCouncilMember(
    colonistId: string,
    faction: NPCFaction,
    affinityBoost: number,
  ): Result<{ newAffinity: number }> {
    const eligibility = this.canLobby(colonistId, faction, affinityBoost);
    if (!eligibility.canLobby) {
      return {
        success: false,
        error: {
          type: "INVALID_STATE",
          current: "ineligible",
          expected: "eligible",
          reason: eligibility.reason || "Cannot lobby",
        },
      };
    }

    // Deduct cost
    this.gameState.resources.deduct({ materials: eligibility.cost });

    // Apply lobby effect
    const colonists = this.gameState.colony.getColonists();
    const result = this.gameState.ideology.lobbyColonist(
      colonistId,
      faction,
      affinityBoost,
      colonists,
    );

    if (!result.success || result.newAffinity === undefined) {
      return {
        success: false,
        error: {
          type: "INVALID_STATE",
          current: "failed",
          expected: "success",
          reason: result.reason || "Lobby failed",
        },
      };
    }

    return { success: true, data: { newAffinity: result.newAffinity } };
  }
}
