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
  ): number {
    const weights = COLONIST_MORALE.NEEDS_WEIGHTS;

    const physiological = this.calculatePhysiologicalNeed(resources, colony);
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
   * Physiological need: food, water, oxygen availability.
   * Returns 0-1 satisfaction.
   */
  private calculatePhysiologicalNeed(resources: ResourceManager, colony: ColonyManager): number {
    const netFlow = resources.getNetFlow();
    const population = colony.getPopulation();

    if (population === 0) return 1.0;

    // Check if we have positive net flow for essentials
    const foodOk = (netFlow.food ?? 0) >= 0;
    const waterOk = (netFlow.water ?? 0) >= 0;
    const oxygenOk = (netFlow.oxygen ?? 0) >= 0;

    // All three must be positive for full satisfaction
    const satisfiedCount = [foodOk, waterOk, oxygenOk].filter(Boolean).length;
    return satisfiedCount / 3;
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
