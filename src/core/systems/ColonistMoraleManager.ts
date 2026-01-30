// src/core/systems/ColonistMoraleManager.ts
import { COLONIST_MORALE } from "../balance/MoraleBalance";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { ColonyManager } from "./ColonyManager";
import type { RelationshipManager } from "./RelationshipManager";
import type { ResourceManager } from "./ResourceManager";

/**
 * Manages per-colonist morale with needs hierarchy and network propagation.
 */
export class ColonistMoraleManager {
  private moraleState: Map<string, number> = new Map();

  /**
   * Calculate base morale for a colonist from their needs satisfaction.
   * Does not include social propagation effects.
   */
  calculateBaseMorale(
    colonist: Colonist,
    resources: ResourceManager,
    relationships: RelationshipManager,
    colony: ColonyManager,
    currentSol: number = 0,
    airQuality: number = 1,
  ): number {
    const weights = COLONIST_MORALE.NEEDS_WEIGHTS;

    const physiological = this.calculatePhysiologicalNeed(
      resources,
      colony,
      currentSol,
      airQuality,
    );
    const safety = this.calculateSafetyNeed(colonist);
    const social = this.calculateSocialNeed(colonist.id, relationships);
    const esteem = this.calculateEsteemNeed(colonist);

    const satisfaction =
      physiological * weights.physiological +
      safety * weights.safety +
      social * weights.social +
      esteem * weights.esteem;

    return satisfaction * 100;
  }

  /**
   * Physiological need: food, water, air quality availability.
   * Returns 0-1 satisfaction.
   *
   * Uses stockpile levels rather than net flow - colonists feel secure when
   * resources are plentiful, even if production temporarily lags consumption.
   * Air quality is a ratio (0-1) rather than a stockpile.
   *
   * During the grace period (first N sols), colonists are optimistic while
   * the colony bootstraps and return full satisfaction.
   */
  private calculatePhysiologicalNeed(
    resources: ResourceManager,
    colony: ColonyManager,
    currentSol: number,
    airQuality: number,
  ): number {
    const population = colony.getPopulation();

    if (population === 0) return 1.0;

    // Grace period: colonists are optimistic while colony bootstraps
    if (currentSol < COLONIST_MORALE.PHYSIOLOGICAL_GRACE_PERIOD) {
      return 1.0;
    }

    const stockpile = resources.getResources();
    const satisfied = COLONIST_MORALE.STOCKPILE_SATISFIED;
    const critical = COLONIST_MORALE.STOCKPILE_CRITICAL;

    // Calculate satisfaction for each essential resource based on stockpile level
    // >= satisfied threshold = 1.0, <= critical threshold = 0.0, linear interpolation between
    const calcSatisfaction = (amount: number): number => {
      if (amount >= satisfied) return 1.0;
      if (amount <= critical) return 0.0;
      return (amount - critical) / (satisfied - critical);
    };

    const foodSat = calcSatisfaction(stockpile.food);
    const waterSat = calcSatisfaction(stockpile.water);
    // Air quality is already a 0-1 ratio, use directly as satisfaction
    const airSat = airQuality;

    // Average satisfaction across all three essentials
    return (foodSat + waterSat + airSat) / 3;
  }

  /**
   * Safety need: housing.
   * Returns 0-1 satisfaction.
   */
  private calculateSafetyNeed(colonist: Colonist): number {
    return colonist.housingId ? 1.0 : 0.0;
  }

  /**
   * Social need: connection count and strength.
   * Returns 0-1 satisfaction.
   */
  private calculateSocialNeed(colonistId: string, relationships: RelationshipManager): number {
    const connectionCount = relationships.getConnectionCount(colonistId);

    if (connectionCount <= COLONIST_MORALE.SOCIAL_ISOLATED_THRESHOLD) {
      return 0.0;
    }

    // Get average relationship strength
    const neighbors = relationships.getNeighbors(colonistId);
    if (neighbors.size === 0) return 0.0;

    let totalStrength = 0;
    for (const neighborId of neighbors) {
      totalStrength += relationships.getRelationshipStrength(colonistId, neighborId);
    }
    const avgStrength = totalStrength / neighbors.size;

    // Scale based on both count and strength
    const countSatisfaction = Math.min(
      1.0,
      connectionCount / COLONIST_MORALE.SOCIAL_SATISFIED_CONNECTIONS,
    );
    const strengthSatisfaction = Math.min(
      1.0,
      avgStrength / COLONIST_MORALE.SOCIAL_SATISFIED_STRENGTH,
    );

    return (countSatisfaction + strengthSatisfaction) / 2;
  }

  /**
   * Esteem need: skill utilization and mastery.
   * Returns 0-1 satisfaction.
   */
  private calculateEsteemNeed(colonist: Colonist): number {
    // Base on whether colonist has an assigned role and mastery level
    const hasRole = colonist.role !== ColonistRole.UNASSIGNED;
    const hasMastery = colonist.masteryLevel !== MasteryLevel.NOVICE;

    if (hasRole && hasMastery) return 1.0;
    if (hasRole || hasMastery) return 0.5;
    return 0.2; // Base esteem from being part of colony
  }

  /**
   * Propagate morale through the social network for one tick.
   * Each colonist's morale moves toward a blend of their base morale
   * and their neighbors' morale (weighted by relationship strength and centrality).
   */
  propagateMorale(
    colonists: Colonist[],
    resources: ResourceManager,
    relationships: RelationshipManager,
    colony: ColonyManager,
    currentSol: number = 0,
    airQuality: number = 1,
  ): void {
    const alpha = COLONIST_MORALE.PROPAGATION_ALPHA;
    const baseWeight = COLONIST_MORALE.BASE_MORALE_WEIGHT;
    const socialWeight = COLONIST_MORALE.SOCIAL_INFLUENCE_WEIGHT;

    // Calculate new morale for each colonist
    const newMorale = new Map<string, number>();

    for (const colonist of colonists) {
      const currentMorale = this.getMorale(colonist.id);
      const baseMorale = this.calculateBaseMorale(
        colonist,
        resources,
        relationships,
        colony,
        currentSol,
        airQuality,
      );

      const neighbors = relationships.getNeighbors(colonist.id);

      if (neighbors.size === 0) {
        // Isolated: drift toward base morale only
        const target = baseMorale;
        newMorale.set(colonist.id, currentMorale + alpha * (target - currentMorale));
        continue;
      }

      // Weighted average of neighbors' morale
      let neighborInfluence = 0;
      let totalWeight = 0;

      for (const neighborId of neighbors) {
        const strength = relationships.getRelationshipStrength(colonist.id, neighborId);
        const neighborCentrality = relationships.getCentrality(neighborId);
        const weight = strength * Math.max(0.1, neighborCentrality); // Floor to prevent zero weight

        neighborInfluence += this.getMorale(neighborId) * weight;
        totalWeight += weight;
      }

      const socialMorale = totalWeight > 0 ? neighborInfluence / totalWeight : baseMorale;

      // Blend base needs with social influence
      const targetMorale = baseWeight * baseMorale + socialWeight * socialMorale;

      // Gradual drift toward target
      const nextMorale = currentMorale + alpha * (targetMorale - currentMorale);
      newMorale.set(colonist.id, Math.max(0, Math.min(100, nextMorale)));
    }

    // Apply all updates
    for (const [id, morale] of newMorale) {
      this.moraleState.set(id, morale);
    }
  }

  /**
   * Calculate colony-wide morale as centrality-weighted average.
   * High-centrality colonists contribute more to the overall "vibe".
   */
  getColonyMorale(colonists: Colonist[], relationships: RelationshipManager): number {
    if (colonists.length === 0) return 50;

    let weightedSum = 0;
    let totalCentrality = 0;

    for (const colonist of colonists) {
      const morale = this.getMorale(colonist.id);
      const centrality = relationships.getCentrality(colonist.id);

      // Use centrality as weight, with floor of 1/n for colonists without centrality
      const weight = centrality > 0 ? centrality : 1 / colonists.length;

      weightedSum += morale * weight;
      totalCentrality += weight;
    }

    return totalCentrality > 0 ? weightedSum / totalCentrality : 50;
  }

  /**
   * Get current morale for a colonist.
   */
  getMorale(colonistId: string): number {
    return this.moraleState.get(colonistId) ?? COLONIST_MORALE.INITIAL_MORALE;
  }

  /**
   * Set morale for a colonist (used during initialization/loading).
   */
  setMorale(colonistId: string, morale: number): void {
    this.moraleState.set(colonistId, Math.max(0, Math.min(100, morale)));
  }

  /**
   * Remove a colonist from morale tracking.
   */
  removeColonist(colonistId: string): void {
    this.moraleState.delete(colonistId);
  }

  toJSON(): { moraleState: Record<string, number> } {
    return {
      moraleState: Object.fromEntries(this.moraleState),
    };
  }

  static fromJSON(data: { moraleState?: Record<string, number> }): ColonistMoraleManager {
    const manager = new ColonistMoraleManager();
    if (data.moraleState) {
      manager.moraleState = new Map(Object.entries(data.moraleState));
    }
    return manager;
  }
}
