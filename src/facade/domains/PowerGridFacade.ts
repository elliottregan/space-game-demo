// src/facade/domains/PowerGridFacade.ts

import type { GameState } from "../../core/GameState";
import type { Queryable } from "../types/interfaces";
import type { PowerGridSnapshot } from "../types/powerGrid";

/**
 * Facade for power grid queries.
 * Power grid strain is calculated during the tick phase based on building power production/consumption.
 *
 * Implements: Queryable<PowerGridSnapshot>
 */
export class PowerGridFacade implements Queryable<PowerGridSnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete power grid state snapshot.
   */
  snapshot(): PowerGridSnapshot {
    const production = this.gameState.buildings.getTotalPowerProduction();
    const consumption = this.gameState.buildings.getTotalPowerConsumption();
    const gridStrain = this.gameState.powerGrid.getGridStrain();

    return {
      gridStrain,
      production,
      consumption,
      efficiencyMultiplier: this.gameState.powerGrid.getEfficiencyMultiplier(),
      isComfortable: this.gameState.powerGrid.isComfortable(),
      isCritical: this.gameState.powerGrid.isCritical(),
    };
  }
}
