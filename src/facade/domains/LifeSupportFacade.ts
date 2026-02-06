import type { GameState } from "../../core/GameState";
import type { Queryable } from "../types/interfaces";
import type { LifeSupportSnapshot } from "../types/lifeSupport";

/**
 * Facade for life support queries.
 * Life support quality is calculated during the tick phase based on
 * habitat capacity vs population + industrial load.
 *
 * Implements: Queryable<LifeSupportSnapshot>
 */
export class LifeSupportFacade implements Queryable<LifeSupportSnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete life support state snapshot.
   */
  snapshot(): LifeSupportSnapshot {
    const totalCapacity = this.gameState.buildings.getTotalLifeSupportCapacity();
    const totalLoad = this.gameState.buildings.getTotalLifeSupportLoad();
    const population = this.gameState.colony.getPopulation();
    const quality = this.gameState.lifeSupport.getQuality();

    return {
      quality,
      totalCapacity,
      totalLoad,
      population,
      healthEffect: this.gameState.lifeSupport.getHealthEffect(),
      moraleEffect: this.gameState.lifeSupport.getMoraleEffect(),
      efficiencyMultiplier: this.gameState.lifeSupport.getEfficiencyMultiplier(),
    };
  }
}
