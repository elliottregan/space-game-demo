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

    // Randomly select from tied factions (array always has at least 1 element here)
    return tiedFactions[rng.int(0, tiedFactions.length - 1)] ?? NPCFaction.EarthLoyalists;
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

  /**
   * Imprint ideology on a new colonist based on their strongest connections.
   * This creates ideological clustering - new colonists adopt the beliefs
   * of whoever they're closest to (typically housemates/coworkers).
   *
   * @param colonist The colonist to imprint ideology on
   * @param colonists All colonists (to find neighbors' ideologies)
   * @param relationshipManager To find neighbor relationship strengths
   * @param imprinting How much to weight neighbor influence (0-1, default 0.7)
   */
  static imprintIdeologyFromNeighbors(
    colonist: Colonist,
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    imprinting: number = IdeologyBalance.IDEOLOGY_IMPRINTING_STRENGTH,
  ): void {
    if (!colonist.ideology) return;

    const neighbors = relationshipManager.getNeighbors(colonist.id);
    if (neighbors.size === 0) return;

    // Build a map for quick lookup
    const colonistMap = new Map(colonists.map((c) => [c.id, c]));

    // Find the strongest connection with ideology
    let strongestNeighbor: Colonist | null = null;
    let strongestStrength = 0;

    for (const neighborId of neighbors) {
      const neighbor = colonistMap.get(neighborId);
      if (!neighbor?.ideology) continue;

      const strength = relationshipManager.getRelationshipStrength(colonist.id, neighborId);
      if (strength > strongestStrength) {
        strongestStrength = strength;
        strongestNeighbor = neighbor;
      }
    }

    // Only imprint if there's a reasonably strong connection with ideology
    if (
      !strongestNeighbor?.ideology ||
      strongestStrength < IdeologyBalance.IDEOLOGY_IMPRINTING_THRESHOLD
    ) {
      return;
    }

    const sourceIdeology = strongestNeighbor.ideology;

    // Blend toward the neighbor's ideology (partial imprinting)
    colonist.ideology.earthLoyalist =
      colonist.ideology.earthLoyalist * (1 - imprinting) +
      sourceIdeology.earthLoyalist * imprinting;
    colonist.ideology.marsIndependence =
      colonist.ideology.marsIndependence * (1 - imprinting) +
      sourceIdeology.marsIndependence * imprinting;
    colonist.ideology.corporateInterests =
      colonist.ideology.corporateInterests * (1 - imprinting) +
      sourceIdeology.corporateInterests * imprinting;

    // New colonists keep their low conviction (they're influenced, not converted)
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
      .filter((c): c is Colonist & { ideology: ColonistIdeology } => !!c.ideology)
      .map((colonist) => {
        const centrality = relationshipManager.getCentrality(colonist.id);
        const conviction = colonist.ideology.conviction;
        const influence = centrality * conviction;
        const faction = IdeologyManager.getPrimaryFaction(colonist.ideology);

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
    const ideologicalColonists = colonists.filter(
      (c): c is Colonist & { ideology: ColonistIdeology } => !!c.ideology,
    );
    if (ideologicalColonists.length === 0) return;

    // Create snapshot to avoid order-dependent updates
    const ideologySnapshot = new Map<string, ColonistIdeology>(
      ideologicalColonists.map((c) => [c.id, { ...c.ideology }]),
    );

    for (const colonist of ideologicalColonists) {
      const ideology = colonist.ideology; // Guaranteed by filter above
      const neighbors = relationshipManager.getNeighbors(colonist.id);
      if (neighbors.size === 0) continue;

      // Calculate weighted average of neighbor ideologies
      let totalWeight = 0;
      const avgInfluence = {
        earthLoyalist: 0,
        marsIndependence: 0,
        corporateInterests: 0,
      };

      for (const neighborId of neighbors) {
        const neighborIdeology = ideologySnapshot.get(neighborId);
        if (!neighborIdeology) continue;

        const relationshipStrength = relationshipManager.getRelationshipStrength(
          colonist.id,
          neighborId,
        );

        // Skip weak connections - ideology only spreads through strong ties
        // This creates ideological "pockets" in the social network
        if (relationshipStrength < IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD) {
          continue;
        }

        const neighborCentrality = relationshipManager.getCentrality(neighborId);
        const neighborConviction = neighborIdeology.conviction;

        // Weight = relationship² × (centrality + baseline) × conviction
        // Squaring relationship strength makes strong bonds disproportionately more influential
        const weight = relationshipStrength ** 2 * (neighborCentrality + 0.1) * neighborConviction;
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
      const resistance = ideology.conviction * IdeologyBalance.CONVICTION_RESISTANCE_FACTOR;
      const effectiveRate = IdeologyBalance.IDEOLOGY_SPREAD_RATE * (1 - resistance);

      // Drift toward neighbor average
      ideology.earthLoyalist +=
        effectiveRate * (avgInfluence.earthLoyalist - ideology.earthLoyalist);
      ideology.marsIndependence +=
        effectiveRate * (avgInfluence.marsIndependence - ideology.marsIndependence);
      ideology.corporateInterests +=
        effectiveRate * (avgInfluence.corporateInterests - ideology.corporateInterests);

      // Clamp values to [0, 1]
      ideology.earthLoyalist = Math.max(0, Math.min(1, ideology.earthLoyalist));
      ideology.marsIndependence = Math.max(0, Math.min(1, ideology.marsIndependence));
      ideology.corporateInterests = Math.max(0, Math.min(1, ideology.corporateInterests));
    }

    // Evolve conviction after ideology spread
    this.evolveConviction(ideologicalColonists, relationshipManager);
  }

  /**
   * Evolve conviction based on ideology pressure from neighbors.
   * Conviction grows when neighbors reinforce the colonist's primary faction
   * and decays proportionally to how strongly neighbors oppose it.
   */
  private evolveConviction(colonists: Colonist[], relationshipManager: RelationshipManager): void {
    const colonistMap = new Map(colonists.map((c) => [c.id, c]));

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const primaryFaction = IdeologyManager.getPrimaryFaction(colonist.ideology);
      if (!primaryFaction) {
        // Neutral colonists don't evolve conviction
        continue;
      }

      const neighbors = relationshipManager.getNeighbors(colonist.id);
      if (neighbors.size === 0) {
        // Isolated colonists decay toward minimum
        colonist.ideology.conviction = Math.max(
          IdeologyBalance.CONVICTION_MIN,
          colonist.ideology.conviction - IdeologyBalance.CONVICTION_DECAY_RATE,
        );
        continue;
      }

      // Calculate weighted average neighbor ideology for the primary faction
      let totalWeight = 0;
      let weightedFactionSum = 0;

      for (const neighborId of neighbors) {
        const relationshipStrength = relationshipManager.getRelationshipStrength(
          colonist.id,
          neighborId,
        );

        // Only consider strong connections
        if (relationshipStrength < IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD) {
          continue;
        }

        const neighbor = colonistMap.get(neighborId);
        if (!neighbor?.ideology) continue;

        const neighborCentrality = relationshipManager.getCentrality(neighborId);
        const neighborConviction = neighbor.ideology.conviction;

        // Use squared relationship strength (consistent with spread formula)
        const weight = relationshipStrength ** 2 * (neighborCentrality + 0.1) * neighborConviction;
        totalWeight += weight;

        // Get neighbor's value for this colonist's primary faction
        const neighborFactionValue =
          primaryFaction === "earth"
            ? neighbor.ideology.earthLoyalist
            : primaryFaction === "mars"
              ? neighbor.ideology.marsIndependence
              : neighbor.ideology.corporateInterests;

        weightedFactionSum += weight * neighborFactionValue;
      }

      if (totalWeight === 0) {
        // No strong connections with ideology, decay
        colonist.ideology.conviction = Math.max(
          IdeologyBalance.CONVICTION_MIN,
          colonist.ideology.conviction - IdeologyBalance.CONVICTION_DECAY_RATE,
        );
        continue;
      }

      // Normalize
      const neighborFactionPressure = weightedFactionSum / totalWeight;

      // Conviction grows when neighbors support your faction (high pressure value)
      // Conviction decays when neighbors oppose your faction (low pressure value)
      // Threshold: 0.4 = neighbors moderately support your faction
      const supportThreshold = 0.35;

      if (neighborFactionPressure >= supportThreshold) {
        // Neighbors support this faction - conviction grows based on support level
        // Growth doesn't depend on neighbor conviction - just alignment
        const supportStrength = neighborFactionPressure - supportThreshold; // 0 to 0.65
        const growth = IdeologyBalance.CONVICTION_GROWTH_RATE * (supportStrength * 2 + 0.2);
        colonist.ideology.conviction = Math.min(
          IdeologyBalance.CONVICTION_MAX,
          colonist.ideology.conviction + growth,
        );
      } else {
        // Neighbors don't support this faction - conviction decays
        const oppositionStrength = supportThreshold - neighborFactionPressure; // 0 to 0.35
        const decay = IdeologyBalance.CONVICTION_DECAY_RATE + oppositionStrength * 0.1;
        colonist.ideology.conviction = Math.max(
          IdeologyBalance.CONVICTION_MIN,
          colonist.ideology.conviction - decay,
        );
      }
    }
  }

  // ============ Ideological Pressure ============

  /**
   * Calculate the ideological pressure a colonist experiences from their neighbors.
   * Returns the weighted average ideology neighbors are pushing toward,
   * along with the total pressure strength.
   */
  calculateIdeologicalPressure(
    colonist: Colonist,
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
  ): {
    pressure: {
      earthLoyalist: number;
      marsIndependence: number;
      corporateInterests: number;
    };
    totalWeight: number;
    neighborCount: number;
    convictionPressure: { growth: boolean; rate: number };
  } | null {
    if (!colonist.ideology) return null;

    const neighbors = relationshipManager.getNeighbors(colonist.id);
    if (neighbors.size === 0) {
      return {
        pressure: {
          earthLoyalist: 0,
          marsIndependence: 0,
          corporateInterests: 0,
        },
        totalWeight: 0,
        neighborCount: 0,
        convictionPressure: {
          growth: false,
          rate: IdeologyBalance.CONVICTION_DECAY_RATE,
        },
      };
    }

    const colonistMap = new Map(colonists.map((c) => [c.id, c]));
    const primaryFaction = IdeologyManager.getPrimaryFaction(colonist.ideology);

    let totalWeight = 0;
    let neighborCount = 0;
    const avgInfluence = {
      earthLoyalist: 0,
      marsIndependence: 0,
      corporateInterests: 0,
    };

    for (const neighborId of neighbors) {
      const neighbor = colonistMap.get(neighborId);
      if (!neighbor?.ideology) continue;

      const relationshipStrength = relationshipManager.getRelationshipStrength(
        colonist.id,
        neighborId,
      );

      // Skip weak connections
      if (relationshipStrength < IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD) {
        continue;
      }

      neighborCount++;

      const neighborCentrality = relationshipManager.getCentrality(neighborId);
      const neighborConviction = neighbor.ideology.conviction;

      // Weight = relationship² × (centrality + baseline) × conviction
      // Squaring relationship strength makes strong bonds disproportionately more influential
      const weight = relationshipStrength ** 2 * (neighborCentrality + 0.1) * neighborConviction;
      totalWeight += weight;

      avgInfluence.earthLoyalist += weight * neighbor.ideology.earthLoyalist;
      avgInfluence.marsIndependence += weight * neighbor.ideology.marsIndependence;
      avgInfluence.corporateInterests += weight * neighbor.ideology.corporateInterests;
    }

    // Normalize
    if (totalWeight > 0) {
      avgInfluence.earthLoyalist /= totalWeight;
      avgInfluence.marsIndependence /= totalWeight;
      avgInfluence.corporateInterests /= totalWeight;
    }

    // Calculate conviction pressure based on ideology pressure delta
    let convictionPressure: { growth: boolean; rate: number };
    if (!primaryFaction || neighborCount === 0) {
      convictionPressure = { growth: false, rate: 0 };
    } else {
      const neighborFactionPressure =
        primaryFaction === NPCFaction.EarthLoyalists
          ? avgInfluence.earthLoyalist
          : primaryFaction === NPCFaction.MarsIndependence
            ? avgInfluence.marsIndependence
            : avgInfluence.corporateInterests;

      // Conviction grows when neighbors support your faction (high pressure value)
      // Conviction decays when neighbors don't support your faction (low pressure value)
      const supportThreshold = 0.35;

      if (neighborFactionPressure >= supportThreshold) {
        const supportStrength = neighborFactionPressure - supportThreshold;
        convictionPressure = {
          growth: true,
          rate: IdeologyBalance.CONVICTION_GROWTH_RATE * (supportStrength * 2 + 0.2),
        };
      } else {
        const oppositionStrength = supportThreshold - neighborFactionPressure;
        convictionPressure = {
          growth: false,
          rate: IdeologyBalance.CONVICTION_DECAY_RATE + oppositionStrength * 0.1,
        };
      }
    }

    return {
      pressure: avgInfluence,
      totalWeight,
      neighborCount,
      convictionPressure,
    };
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
      return {
        success: false,
        reason: "Colonist not found or has no ideology",
      };
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
  canProposeCapstone(faction: NPCFaction): {
    canPropose: boolean;
    reason?: string;
  } {
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
