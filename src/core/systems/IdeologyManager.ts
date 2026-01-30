// src/core/systems/IdeologyManager.ts

import type { Colonist, ColonistIdeology } from "../models/Colonist";
import { NPCFaction } from "../models/NPCInfluence";
import type { RelationshipManager } from "./RelationshipManager";
import type { ColonistMoraleManager } from "./ColonistMoraleManager";
import * as IdeologyBalance from "../balance/IdeologyBalance";

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
 * Colony-wide faction support levels.
 */
export interface FactionSupport {
  earthLoyalists: number;
  marsIndependence: number;
  corporateInterests: number;
}

/**
 * Manages colonist ideology, council selection, and faction support.
 * Ideology spreads through the social network similar to morale.
 */
export class IdeologyManager {
  private council: CouncilMember[] = [];
  private lastCouncilUpdateSol: number = -1;
  private lastSpreadSol: number = -1;

  // ============ Static Helpers ============

  /**
   * Get the primary faction for a colonist's ideology.
   * Returns null if all affinities are below the neutral threshold.
   */
  static getPrimaryFaction(ideology: ColonistIdeology): NPCFaction | null {
    const { earthLoyalist, marsIndependence, corporateInterests } = ideology;
    const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);

    if (max < IdeologyBalance.IDEOLOGY_NEUTRAL_THRESHOLD) return null;

    if (earthLoyalist === max) return NPCFaction.EarthLoyalists;
    if (marsIndependence === max) return NPCFaction.MarsIndependence;
    return NPCFaction.CorporateInterests;
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
      const resistance = colonist.ideology!.conviction * IdeologyBalance.CONVICTION_RESISTANCE_FACTOR;
      const effectiveRate = IdeologyBalance.IDEOLOGY_SPREAD_RATE * (1 - resistance);

      // Drift toward neighbor average
      colonist.ideology!.earthLoyalist +=
        effectiveRate * (avgInfluence.earthLoyalist - colonist.ideology!.earthLoyalist);
      colonist.ideology!.marsIndependence +=
        effectiveRate * (avgInfluence.marsIndependence - colonist.ideology!.marsIndependence);
      colonist.ideology!.corporateInterests +=
        effectiveRate * (avgInfluence.corporateInterests - colonist.ideology!.corporateInterests);

      // Clamp values to [0, 1]
      colonist.ideology!.earthLoyalist = Math.max(
        0,
        Math.min(1, colonist.ideology!.earthLoyalist),
      );
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
   * Apply morale effects when a project passes.
   * Colonists who support the faction get a morale boost.
   * Colonists who oppose the faction get a morale penalty.
   */
  applyProjectMoraleEffects(
    projectFaction: NPCFaction,
    colonists: Colonist[],
    moraleManager: ColonistMoraleManager,
  ): void {
    const factionKey = IdeologyManager.factionToKey(projectFaction);

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const affinity = colonist.ideology[factionKey];
      const primaryFaction = IdeologyManager.getPrimaryFaction(colonist.ideology);

      let moraleDelta = 0;

      if (affinity >= 0.7) {
        moraleDelta = IdeologyBalance.PROJECT_MORALE_STRONG_SUPPORTER;
      } else if (affinity >= 0.4) {
        moraleDelta = IdeologyBalance.PROJECT_MORALE_SUPPORTER;
      } else if (primaryFaction && primaryFaction !== projectFaction) {
        // They belong to a different faction
        moraleDelta =
          colonist.ideology.conviction >= IdeologyBalance.PROJECT_MORALE_CONVICTION_THRESHOLD
            ? IdeologyBalance.PROJECT_MORALE_STRONGLY_OPPOSED
            : IdeologyBalance.PROJECT_MORALE_OPPOSED;
      }

      if (moraleDelta !== 0) {
        moraleManager.adjustColonistMorale(colonist.id, moraleDelta);
      }
    }
  }

  // ============ Serialization ============

  toJSON(): {
    council: CouncilMember[];
    lastCouncilUpdateSol: number;
    lastSpreadSol: number;
  } {
    return {
      council: this.council,
      lastCouncilUpdateSol: this.lastCouncilUpdateSol,
      lastSpreadSol: this.lastSpreadSol,
    };
  }

  static fromJSON(data: ReturnType<IdeologyManager["toJSON"]>): IdeologyManager {
    const manager = new IdeologyManager();
    if (data.council) manager.council = data.council;
    if (data.lastCouncilUpdateSol !== undefined) manager.lastCouncilUpdateSol = data.lastCouncilUpdateSol;
    if (data.lastSpreadSol !== undefined) manager.lastSpreadSol = data.lastSpreadSol;
    return manager;
  }
}
