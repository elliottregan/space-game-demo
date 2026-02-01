// src/core/systems/IdeologyManager.ts

import type { Colonist, ColonistIdeology } from "../models/Colonist";
import { NPCFaction, type Project, type ProjectId } from "../models/NPCInfluence";
import type { RelationshipManager } from "./RelationshipManager";
import type { ColonistMoraleManager } from "./ColonistMoraleManager";
import * as IdeologyBalance from "../balance/IdeologyBalance";
import { getProject, getProjectsByFaction } from "../data/projects";
import { rng } from "../utils/random";

/**
 * A council member selected from high-influence colonists.
 */
export interface CouncilMember {
  colonistId: string;
  name: string;
  centrality: number;
  conviction: number;
  /** Political influence score = centrality × conviction */
  influence: number;
  /** Primary faction affiliation (or null if neutral) */
  faction: NPCFaction | null;
}

/**
 * Result of a lobby attempt.
 */
export interface LobbyResult {
  success: boolean;
  reason?: string;
  newAffinity?: number;
}

/**
 * Colony-wide faction support levels.
 */
export interface FactionSupport {
  earthLoyalists: number;
  marsIndependence: number;
  corporateInterests: number;
}

/**
 * A project proposal awaiting council vote.
 */
export interface PendingProposal {
  projectId: ProjectId;
  faction: NPCFaction;
  proposedSol: number;
  voteSol: number;
}

/**
 * Result of a council vote on a project.
 */
export interface VoteResult {
  projectId: ProjectId;
  passed: boolean;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
}

/**
 * Manages colonist ideology, council selection, and faction support.
 * Ideology spreads through the social network similar to morale.
 */
export class IdeologyManager {
  private council: CouncilMember[] = [];
  private lastCouncilUpdateSol: number = -1;
  private lastSpreadSol: number = -1;
  private completedProjects: Set<ProjectId> = new Set();
  private pendingProposals: Map<ProjectId, PendingProposal> = new Map();
  private failedProposals: Set<ProjectId> = new Set();

  // ============ Static Helpers ============

  /**
   * Get the primary faction for a colonist's ideology.
   * Returns null if all affinities are below the neutral threshold.
   * When multiple factions are tied for highest, randomly selects one.
   */
  static getPrimaryFaction(ideology: ColonistIdeology): NPCFaction | null {
    const { earthLoyalist, marsIndependence, corporateInterests } = ideology;
    const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);

    if (max < IdeologyBalance.IDEOLOGY_NEUTRAL_THRESHOLD) return null;

    // Collect all factions tied for the maximum
    const tiedFactions: NPCFaction[] = [];
    if (earthLoyalist === max) tiedFactions.push(NPCFaction.EarthLoyalists);
    if (marsIndependence === max) tiedFactions.push(NPCFaction.MarsIndependence);
    if (corporateInterests === max) tiedFactions.push(NPCFaction.CorporateInterests);

    // Randomly select from tied factions
    return tiedFactions[rng.int(0, tiedFactions.length - 1)]!;
  }

  /**
   * Convert a faction enum to the corresponding ideology key.
   */
  static factionToKey(faction: NPCFaction): keyof Omit<ColonistIdeology, "conviction"> {
    switch (faction) {
      case NPCFaction.EarthLoyalists:
        return "earthLoyalist";
      case NPCFaction.MarsIndependence:
        return "marsIndependence";
      case NPCFaction.CorporateInterests:
        return "corporateInterests";
    }
  }

  /**
   * Create a neutral ideology for new colonists.
   */
  static createNeutralIdeology(): ColonistIdeology {
    return { ...IdeologyBalance.NEW_COLONIST_IDEOLOGY };
  }

  // ============ Council Selection ============

  /**
   * Select council members from colonists with highest political influence.
   * Political influence = centrality × conviction.
   * Uses the RelationshipManager's centrality cache.
   */
  selectCouncil(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number,
  ): CouncilMember[] {
    // Determine council size based on population
    const councilSize = Math.min(
      IdeologyBalance.COUNCIL_SIZE_MAX,
      Math.max(
        IdeologyBalance.COUNCIL_SIZE_MIN,
        Math.floor(colonists.length / IdeologyBalance.COUNCIL_SIZE_PER_POPULATION),
      ),
    );

    // Calculate political influence for each colonist
    const candidates = colonists
      .filter((c) => c.ideology) // Only colonists with ideology
      .map((colonist) => {
        const centrality = relationshipManager.getCentrality(colonist.id);
        const conviction = colonist.ideology!.conviction;
        const influence = centrality * conviction;
        const faction = IdeologyManager.getPrimaryFaction(colonist.ideology!);

        return {
          colonistId: colonist.id,
          name: colonist.name,
          centrality,
          conviction,
          influence,
          faction,
        };
      });

    // Sort by influence, take top N
    this.council = candidates.sort((a, b) => b.influence - a.influence).slice(0, councilSize);

    this.lastCouncilUpdateSol = currentSol;
    return this.council;
  }

  /**
   * Update council if enough time has passed since last update.
   */
  updateCouncilIfStale(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number,
  ): void {
    if (
      this.lastCouncilUpdateSol < 0 ||
      currentSol - this.lastCouncilUpdateSol >= IdeologyBalance.COUNCIL_UPDATE_INTERVAL
    ) {
      // Ensure centrality is fresh
      relationshipManager.recalculateCentralityIfStale(
        currentSol,
        IdeologyBalance.COUNCIL_UPDATE_INTERVAL,
      );
      this.selectCouncil(colonists, relationshipManager, currentSol);
    }
  }

  /**
   * Get the current council members.
   */
  getCouncil(): readonly CouncilMember[] {
    return this.council;
  }

  /**
   * Get count of council seats by faction.
   */
  getCouncilFactionCounts(): Record<NPCFaction | "neutral", number> {
    const counts: Record<NPCFaction | "neutral", number> = {
      [NPCFaction.EarthLoyalists]: 0,
      [NPCFaction.MarsIndependence]: 0,
      [NPCFaction.CorporateInterests]: 0,
      neutral: 0,
    };

    for (const member of this.council) {
      if (member.faction) {
        counts[member.faction]++;
      } else {
        counts.neutral++;
      }
    }

    return counts;
  }

  // ============ Faction Support Calculation ============

  /**
   * Calculate colony-wide faction support levels.
   * Support is weighted by colonist centrality (influential colonists matter more).
   */
  calculateFactionSupport(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
  ): FactionSupport {
    let totalWeight = 0;
    const factionWeights = {
      earthLoyalists: 0,
      marsIndependence: 0,
      corporateInterests: 0,
    };

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      // Weight by centrality (influential colonists matter more) + baseline
      const weight = relationshipManager.getCentrality(colonist.id) + 0.1;
      totalWeight += weight;

      factionWeights.earthLoyalists += weight * colonist.ideology.earthLoyalist;
      factionWeights.marsIndependence += weight * colonist.ideology.marsIndependence;
      factionWeights.corporateInterests += weight * colonist.ideology.corporateInterests;
    }

    if (totalWeight === 0) {
      return { earthLoyalists: 0, marsIndependence: 0, corporateInterests: 0 };
    }

    return {
      earthLoyalists: factionWeights.earthLoyalists / totalWeight,
      marsIndependence: factionWeights.marsIndependence / totalWeight,
      corporateInterests: factionWeights.corporateInterests / totalWeight,
    };
  }

  /**
   * Get support level for a specific faction.
   */
  getFactionSupportForFaction(
    faction: NPCFaction,
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
  ): number {
    const support = this.calculateFactionSupport(colonists, relationshipManager);
    switch (faction) {
      case NPCFaction.EarthLoyalists:
        return support.earthLoyalists;
      case NPCFaction.MarsIndependence:
        return support.marsIndependence;
      case NPCFaction.CorporateInterests:
        return support.corporateInterests;
    }
  }

  // ============ Ideology Spread ============

  /**
   * Propagate ideology through the social network.
   * Each colonist's ideology drifts toward their neighbors' weighted average.
   * Influence is weighted by relationship strength, neighbor centrality, and neighbor conviction.
   * Resistance is based on the colonist's own conviction.
   */
  propagateIdeology(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number,
  ): void {
    // Only spread every N sols for performance
    if (
      this.lastSpreadSol >= 0 &&
      currentSol - this.lastSpreadSol < IdeologyBalance.IDEOLOGY_SPREAD_INTERVAL
    ) {
      return;
    }

    this.lastSpreadSol = currentSol;

    // Filter to colonists with ideology
    const ideologicalColonists = colonists.filter((c) => c.ideology);
    if (ideologicalColonists.length === 0) return;

    // Create snapshot to avoid order-dependent updates
    const ideologySnapshot = new Map<string, ColonistIdeology>(
      ideologicalColonists.map((c) => [c.id, { ...c.ideology! }]),
    );

    for (const colonist of ideologicalColonists) {
      const neighbors = relationshipManager.getNeighbors(colonist.id);
      if (neighbors.size === 0) continue;

      // Calculate weighted average of neighbor ideologies
      let totalWeight = 0;
      const avgInfluence = { earthLoyalist: 0, marsIndependence: 0, corporateInterests: 0 };

      for (const neighborId of neighbors) {
        const neighborIdeology = ideologySnapshot.get(neighborId);
        if (!neighborIdeology) continue;

        const relationshipStrength = relationshipManager.getRelationshipStrength(
          colonist.id,
          neighborId,
        );
        const neighborCentrality = relationshipManager.getCentrality(neighborId);
        const neighborConviction = neighborIdeology.conviction;

        // Weight = relationship × (centrality + baseline) × conviction
        const weight = relationshipStrength * (neighborCentrality + 0.1) * neighborConviction;
        totalWeight += weight;

        avgInfluence.earthLoyalist += weight * neighborIdeology.earthLoyalist;
        avgInfluence.marsIndependence += weight * neighborIdeology.marsIndependence;
        avgInfluence.corporateInterests += weight * neighborIdeology.corporateInterests;
      }

      if (totalWeight === 0) continue;

      // Normalize
      avgInfluence.earthLoyalist /= totalWeight;
      avgInfluence.marsIndependence /= totalWeight;
      avgInfluence.corporateInterests /= totalWeight;

      // Resistance based on own conviction
      const resistance =
        colonist.ideology!.conviction * IdeologyBalance.CONVICTION_RESISTANCE_FACTOR;
      const effectiveRate = IdeologyBalance.IDEOLOGY_SPREAD_RATE * (1 - resistance);

      // Drift toward neighbor average
      colonist.ideology!.earthLoyalist +=
        effectiveRate * (avgInfluence.earthLoyalist - colonist.ideology!.earthLoyalist);
      colonist.ideology!.marsIndependence +=
        effectiveRate * (avgInfluence.marsIndependence - colonist.ideology!.marsIndependence);
      colonist.ideology!.corporateInterests +=
        effectiveRate * (avgInfluence.corporateInterests - colonist.ideology!.corporateInterests);

      // Clamp values to [0, 1]
      colonist.ideology!.earthLoyalist = Math.max(0, Math.min(1, colonist.ideology!.earthLoyalist));
      colonist.ideology!.marsIndependence = Math.max(
        0,
        Math.min(1, colonist.ideology!.marsIndependence),
      );
      colonist.ideology!.corporateInterests = Math.max(
        0,
        Math.min(1, colonist.ideology!.corporateInterests),
      );
    }
  }

  // ============ Project Morale Effects ============

  /**
   * Apply morale and conviction effects when a project passes.
   * - Morale boost/penalty based on faction affinity (base effects)
   * - Project-specific supporter morale/conviction boosts (from project.effects)
   * - Conviction boost for council members who voted for it
   */
  applyProjectMoraleEffects(
    project: Project,
    colonists: Colonist[],
    moraleManager: ColonistMoraleManager,
  ): void {
    const projectFaction = project.type;
    const factionKey = IdeologyManager.factionToKey(projectFaction);

    // Get project-specific boosts (or use 0 if not specified)
    const projectMoraleBoost = project.effects?.supporterMoraleBoost ?? 0;
    const projectConvictionBoost = project.effects?.supporterConvictionBoost ?? 0;

    // Build a set of council member IDs who voted for this project
    const voterIds = new Set<string>();
    for (const member of this.council) {
      if (member.faction === projectFaction) {
        voterIds.add(member.colonistId);
      }
    }

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const affinity = colonist.ideology[factionKey];
      const primaryFaction = IdeologyManager.getPrimaryFaction(colonist.ideology);

      let moraleDelta = 0;
      let convictionDelta = 0;

      // Morale effects based on affinity (base + project-specific)
      if (affinity >= 0.7) {
        moraleDelta = IdeologyBalance.PROJECT_MORALE_STRONG_SUPPORTER + projectMoraleBoost;
        convictionDelta =
          IdeologyBalance.PROJECT_CONVICTION_BOOST_STRONG_SUPPORTER + projectConvictionBoost;
      } else if (affinity >= 0.4) {
        moraleDelta = IdeologyBalance.PROJECT_MORALE_SUPPORTER + projectMoraleBoost * 0.5;
        convictionDelta =
          IdeologyBalance.PROJECT_CONVICTION_BOOST_SUPPORTER + projectConvictionBoost * 0.5;
      } else if (primaryFaction && primaryFaction !== projectFaction) {
        // They belong to a different faction
        moraleDelta =
          colonist.ideology.conviction >= IdeologyBalance.PROJECT_MORALE_CONVICTION_THRESHOLD
            ? IdeologyBalance.PROJECT_MORALE_STRONGLY_OPPOSED
            : IdeologyBalance.PROJECT_MORALE_OPPOSED;
      }

      // Extra conviction boost for council members who voted for the project
      if (voterIds.has(colonist.id)) {
        convictionDelta = Math.max(convictionDelta, IdeologyBalance.PROJECT_CONVICTION_BOOST_VOTER);
      }

      // Apply morale effect
      if (moraleDelta !== 0) {
        moraleManager.adjustColonistMorale(colonist.id, moraleDelta);
      }

      // Apply conviction boost (capped at 1.0)
      if (convictionDelta > 0) {
        colonist.ideology.conviction = Math.min(
          1.0,
          colonist.ideology.conviction + convictionDelta,
        );
      }
    }
  }

  // ============ Lobbying ============

  /**
   * Calculate the cost in materials to lobby a council member.
   * Cost scales with the colonist's influence (centrality × conviction).
   */
  getLobbyCost(colonistId: string, _faction: NPCFaction, affinityBoost: number): number {
    const member = this.council.find((m) => m.colonistId === colonistId);
    if (!member) return Infinity;

    // Base cost + influence scaling
    const influenceCost = member.influence * IdeologyBalance.LOBBY_INFLUENCE_COST_MULTIPLIER;
    const boostMultiplier = affinityBoost / IdeologyBalance.LOBBY_AFFINITY_BOOST;

    return Math.ceil(IdeologyBalance.LOBBY_BASE_COST + influenceCost * boostMultiplier);
  }

  /**
   * Lobby a council member to boost their affinity for a faction.
   * The boosted affinity will naturally spread through the social network.
   */
  lobbyColonist(
    colonistId: string,
    faction: NPCFaction,
    affinityBoost: number,
    colonists: Colonist[],
  ): LobbyResult {
    // Verify target is a council member
    const member = this.council.find((m) => m.colonistId === colonistId);
    if (!member) {
      return { success: false, reason: "Target is not a council member" };
    }

    // Find the colonist
    const colonist = colonists.find((c) => c.id === colonistId);
    if (!colonist || !colonist.ideology) {
      return { success: false, reason: "Colonist not found or has no ideology" };
    }

    // Apply the affinity boost
    const factionKey = IdeologyManager.factionToKey(faction);
    const currentAffinity = colonist.ideology[factionKey];
    const newAffinity = Math.min(1.0, currentAffinity + affinityBoost);
    colonist.ideology[factionKey] = newAffinity;

    return { success: true, newAffinity };
  }

  /**
   * Check if a colonist can be lobbied (must be council member).
   */
  canLobby(colonistId: string): { canLobby: boolean; reason?: string } {
    const member = this.council.find((m) => m.colonistId === colonistId);
    if (!member) {
      return { canLobby: false, reason: "Target is not a council member" };
    }
    return { canLobby: true };
  }

  // ============ Projects ============

  /**
   * Check if a project has been completed.
   */
  isProjectCompleted(projectId: ProjectId): boolean {
    return this.completedProjects.has(projectId);
  }

  /**
   * Mark a project as completed.
   */
  completeProject(projectId: ProjectId): void {
    this.completedProjects.add(projectId);
  }

  /**
   * Get list of completed project IDs.
   */
  getCompletedProjects(): readonly ProjectId[] {
    return [...this.completedProjects];
  }

  /**
   * Submit a project proposal for council vote.
   */
  submitProposal(projectId: ProjectId, faction: NPCFaction, currentSol: number): boolean {
    // Can't propose if already pending, completed, or failed
    if (
      this.pendingProposals.has(projectId) ||
      this.completedProjects.has(projectId) ||
      this.failedProposals.has(projectId)
    ) {
      return false;
    }

    this.pendingProposals.set(projectId, {
      projectId,
      faction,
      proposedSol: currentSol,
      voteSol: currentSol + IdeologyBalance.PROJECT_VOTING_PERIOD,
    });

    return true;
  }

  /**
   * Check if a project is pending vote.
   */
  isPendingProposal(projectId: ProjectId): boolean {
    return this.pendingProposals.has(projectId);
  }

  /**
   * Check if a project has failed a vote.
   */
  isFailedProposal(projectId: ProjectId): boolean {
    return this.failedProposals.has(projectId);
  }

  /**
   * Get all pending proposals.
   */
  getPendingProposals(): readonly PendingProposal[] {
    return [...this.pendingProposals.values()];
  }

  /**
   * Get a specific pending proposal.
   */
  getPendingProposal(projectId: ProjectId): PendingProposal | undefined {
    return this.pendingProposals.get(projectId);
  }

  /**
   * Preview what the vote outcome would be for a project.
   */
  getVoteProjection(faction: NPCFaction): {
    votesFor: number;
    votesAgainst: number;
    wouldPass: boolean;
  } {
    const counts = this.getCouncilFactionCounts();
    const votesFor = counts[faction] ?? 0;
    const totalVotes = this.council.length;
    const votesAgainst = totalVotes - votesFor;
    const wouldPass = votesFor > votesAgainst;

    return { votesFor, votesAgainst, wouldPass };
  }

  /**
   * Process votes for proposals that have reached their vote sol.
   * Returns the results of any votes that occurred.
   */
  processVotes(currentSol: number): VoteResult[] {
    const results: VoteResult[] = [];

    for (const [projectId, proposal] of this.pendingProposals) {
      if (currentSol >= proposal.voteSol) {
        const projection = this.getVoteProjection(proposal.faction);

        const result: VoteResult = {
          projectId,
          passed: projection.wouldPass,
          votesFor: projection.votesFor,
          votesAgainst: projection.votesAgainst,
          totalVotes: this.council.length,
        };

        results.push(result);

        // Remove from pending
        this.pendingProposals.delete(projectId);

        // Add to completed or failed
        if (result.passed) {
          this.completedProjects.add(projectId);
        } else {
          this.failedProposals.add(projectId);
        }
      }
    }

    return results;
  }

  /**
   * Clear a failed proposal so it can be proposed again.
   */
  clearFailedProposal(projectId: ProjectId): void {
    this.failedProposals.delete(projectId);
  }

  /**
   * Get list of failed project IDs.
   */
  getFailedProposals(): readonly ProjectId[] {
    return [...this.failedProposals];
  }

  // ============ Capstone Projects ============

  /**
   * Get all passed projects for a specific faction.
   */
  getPassedProjectsForFaction(faction: NPCFaction): ProjectId[] {
    const factionProjects = getProjectsByFaction(faction);
    return factionProjects
      .filter((p) => !p.isCapstone && this.completedProjects.has(p.id))
      .map((p) => p.id);
  }

  /**
   * Check if a project is a capstone victory project.
   */
  isCapstoneProject(projectId: ProjectId): boolean {
    const project = getProject(projectId);
    return project?.isCapstone === true;
  }

  /**
   * Check if a capstone project can be proposed.
   * Requires all prerequisites passed AND sufficient council support.
   */
  canProposeCapstone(faction: NPCFaction): { canPropose: boolean; reason?: string } {
    // Find the capstone for this faction
    const factionProjects = getProjectsByFaction(faction);
    const capstone = factionProjects.find((p) => p.isCapstone);
    if (!capstone) {
      return { canPropose: false, reason: "No capstone project for faction" };
    }

    // Check prerequisites
    const prerequisites = capstone.prerequisites ?? [];
    const passedPrereqs = prerequisites.filter((p) => this.completedProjects.has(p));
    if (passedPrereqs.length < prerequisites.length) {
      return {
        canPropose: false,
        reason: `Prerequisites not met: ${passedPrereqs.length}/${prerequisites.length} projects passed`,
      };
    }

    // Check council support
    const requiredSupport = capstone.requiredCouncilSupport ?? 0.65;
    const counts = this.getCouncilFactionCounts();
    const factionSeats = counts[faction] ?? 0;
    const totalSeats = this.council.length;
    const supportRatio = totalSeats > 0 ? factionSeats / totalSeats : 0;

    if (supportRatio < requiredSupport) {
      return {
        canPropose: false,
        reason: `Insufficient council support: ${Math.round(supportRatio * 100)}% (need ${Math.round(requiredSupport * 100)}%)`,
      };
    }

    return { canPropose: true };
  }

  // ============ Serialization ============

  toJSON(): {
    council: CouncilMember[];
    lastCouncilUpdateSol: number;
    lastSpreadSol: number;
    completedProjects: ProjectId[];
    pendingProposals: PendingProposal[];
    failedProposals: ProjectId[];
  } {
    return {
      council: this.council,
      lastCouncilUpdateSol: this.lastCouncilUpdateSol,
      lastSpreadSol: this.lastSpreadSol,
      completedProjects: [...this.completedProjects],
      pendingProposals: [...this.pendingProposals.values()],
      failedProposals: [...this.failedProposals],
    };
  }

  static fromJSON(data: ReturnType<IdeologyManager["toJSON"]>): IdeologyManager {
    const manager = new IdeologyManager();
    if (data.council) manager.council = data.council;
    if (data.lastCouncilUpdateSol !== undefined)
      manager.lastCouncilUpdateSol = data.lastCouncilUpdateSol;
    if (data.lastSpreadSol !== undefined) manager.lastSpreadSol = data.lastSpreadSol;
    if (data.completedProjects) {
      manager.completedProjects = new Set(data.completedProjects);
    }
    if (data.pendingProposals) {
      manager.pendingProposals = new Map(data.pendingProposals.map((p) => [p.projectId, p]));
    }
    if (data.failedProposals) {
      manager.failedProposals = new Set(data.failedProposals);
    }
    return manager;
  }
}
