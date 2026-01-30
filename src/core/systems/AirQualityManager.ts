// src/core/systems/AirQualityManager.ts

import {
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  AIR_QUALITY_MAX_EFFICIENCY_PENALTY,
  AIR_QUALITY_MAX_HEALTH_PENALTY,
  AIR_QUALITY_MAX_MORALE_PENALTY,
} from "../balance/AirQualityBalance";

export class AirQualityManager {
  private airQuality: number = 1;

  /**
   * Calculate air quality as production/consumption ratio.
   * Updates internal state and returns the new value.
   */
  calculate(production: number, consumption: number): number {
    if (consumption <= 0) {
      this.airQuality = 1;
      return this.airQuality;
    }

    if (production <= 0) {
      this.airQuality = 0;
      return this.airQuality;
    }

    this.airQuality = Math.max(0, Math.min(1, production / consumption));
    return this.airQuality;
  }

  getAirQuality(): number {
    return this.airQuality;
  }

  /**
   * Get health effect based on current air quality.
   * Returns 0 when comfortable, negative when strained/critical.
   */
  getHealthEffect(): number {
    if (this.airQuality >= AIR_QUALITY_COMFORTABLE) {
      return 0;
    }

    // Scale from 0 at comfortable to -MAX at 0
    const severity = 1 - this.airQuality / AIR_QUALITY_COMFORTABLE;
    return -severity * AIR_QUALITY_MAX_HEALTH_PENALTY;
  }

  /**
   * Get morale effect based on current air quality.
   * Returns 0 when comfortable, negative when strained/critical.
   */
  getMoraleEffect(): number {
    if (this.airQuality >= AIR_QUALITY_COMFORTABLE) {
      return 0;
    }

    const severity = 1 - this.airQuality / AIR_QUALITY_COMFORTABLE;
    return -severity * AIR_QUALITY_MAX_MORALE_PENALTY;
  }

  /**
   * Get efficiency multiplier based on current air quality.
   * Returns 1 when comfortable or strained, <1 when critical.
   */
  getEfficiencyMultiplier(): number {
    if (this.airQuality >= AIR_QUALITY_CRITICAL) {
      return 1;
    }

    // Scale from 1 at critical threshold to (1 - MAX_PENALTY) at 0
    const severity = 1 - this.airQuality / AIR_QUALITY_CRITICAL;
    return 1 - severity * AIR_QUALITY_MAX_EFFICIENCY_PENALTY;
  }

  toJSON() {
    return {
      airQuality: this.airQuality,
    };
  }

  static fromJSON(data: { airQuality: number }): AirQualityManager {
    const manager = new AirQualityManager();
    manager.airQuality = data.airQuality;
    return manager;
  }
}
