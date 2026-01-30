// src/core/systems/AirQualityManager.ts

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
}
