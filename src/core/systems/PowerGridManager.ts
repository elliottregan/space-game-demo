// src/core/systems/PowerGridManager.ts

import {
  POWER_GRID_COMFORTABLE,
  POWER_GRID_CRITICAL,
  POWER_GRID_MAX_EFFICIENCY_PENALTY,
} from "../balance/PowerGridBalance";

/**
 * Manages power grid strain as a 0-1 metric.
 * Similar to AirQualityManager, but for power production vs consumption.
 *
 * Grid strain = production / consumption
 * - >= 0.8: Full efficiency (comfortable)
 * - 0.5-0.8: Warning but full efficiency
 * - < 0.5: Reduced efficiency (critical)
 */
export class PowerGridManager {
  private gridStrain: number = 1;
  private production: number = 0;
  private consumption: number = 0;

  /**
   * Calculate grid strain as production/consumption ratio.
   * Updates internal state and returns the new value.
   */
  calculate(production: number, consumption: number): number {
    this.production = production;
    this.consumption = consumption;

    if (consumption <= 0) {
      this.gridStrain = 1;
      return this.gridStrain;
    }

    if (production <= 0) {
      this.gridStrain = 0;
      return this.gridStrain;
    }

    this.gridStrain = Math.max(0, Math.min(1, production / consumption));
    return this.gridStrain;
  }

  getGridStrain(): number {
    return this.gridStrain;
  }

  getProduction(): number {
    return this.production;
  }

  getConsumption(): number {
    return this.consumption;
  }

  /**
   * Get efficiency multiplier based on current grid strain.
   * Returns 1 when comfortable or warning, <1 when critical.
   */
  getEfficiencyMultiplier(): number {
    if (this.gridStrain >= POWER_GRID_CRITICAL) {
      return 1;
    }

    // Scale from 1 at critical threshold to (1 - MAX_PENALTY) at 0
    const severity = 1 - this.gridStrain / POWER_GRID_CRITICAL;
    return 1 - severity * POWER_GRID_MAX_EFFICIENCY_PENALTY;
  }

  /**
   * Check if grid is in comfortable state (>= 0.8)
   */
  isComfortable(): boolean {
    return this.gridStrain >= POWER_GRID_COMFORTABLE;
  }

  /**
   * Check if grid is in critical state (< 0.5)
   */
  isCritical(): boolean {
    return this.gridStrain < POWER_GRID_CRITICAL;
  }

  toJSON() {
    return {
      gridStrain: this.gridStrain,
      production: this.production,
      consumption: this.consumption,
    };
  }

  static fromJSON(data: {
    gridStrain: number;
    production?: number;
    consumption?: number;
  }): PowerGridManager {
    const manager = new PowerGridManager();
    manager.gridStrain = data.gridStrain;
    manager.production = data.production ?? 0;
    manager.consumption = data.consumption ?? 0;
    return manager;
  }
}
