import {
  LS_QUALITY_COMFORTABLE,
  LS_QUALITY_CRISIS,
  LS_MAX_HEALTH_PENALTY,
  LS_MAX_MORALE_PENALTY,
  LS_MAX_EFFICIENCY_PENALTY,
} from "../balance/LifeSupportBalance";

export class LifeSupportManager {
  private quality: number = 1;

  /**
   * Calculate life support quality from utilization and resource supply.
   * Quality curve (from utilization ratio):
   *   <0.6  -> 95-100%
   *   0.6-0.8 -> 80-95%
   *   0.8-0.95 -> 55-80%
   *   0.95-1.0 -> 35-55%
   *   >1.0  -> 0-35%
   */
  calculate(
    population: number,
    industrialLoad: number,
    totalCapacity: number,
    resourceFactor: number = 1,
  ): number {
    if (totalCapacity <= 0) {
      this.quality = population > 0 ? 0 : 1;
      return this.quality;
    }

    const utilization = (population + industrialLoad) / totalCapacity;

    let baseQuality: number;
    if (utilization <= 0.6) {
      baseQuality = 1.0 - (utilization / 0.6) * 0.05;
    } else if (utilization <= 0.8) {
      baseQuality = 0.95 - ((utilization - 0.6) / 0.2) * 0.15;
    } else if (utilization <= 0.95) {
      baseQuality = 0.8 - ((utilization - 0.8) / 0.15) * 0.25;
    } else if (utilization <= 1.0) {
      baseQuality = 0.55 - ((utilization - 0.95) / 0.05) * 0.2;
    } else {
      const overAmount = Math.min(utilization - 1.0, 1.0);
      baseQuality = 0.35 * (1 - overAmount);
    }

    this.quality = Math.max(0, Math.min(1, baseQuality * resourceFactor));
    return this.quality;
  }

  getQuality(): number {
    return this.quality;
  }

  getHealthEffect(): number {
    if (this.quality >= LS_QUALITY_COMFORTABLE) return 0;
    const severity = 1 - this.quality / LS_QUALITY_COMFORTABLE;
    return -severity * LS_MAX_HEALTH_PENALTY;
  }

  getMoraleEffect(): number {
    if (this.quality >= LS_QUALITY_COMFORTABLE) return 0;
    const severity = 1 - this.quality / LS_QUALITY_COMFORTABLE;
    return -severity * LS_MAX_MORALE_PENALTY;
  }

  getEfficiencyMultiplier(): number {
    if (this.quality >= LS_QUALITY_CRISIS) return 1;
    const severity = 1 - this.quality / LS_QUALITY_CRISIS;
    return 1 - severity * LS_MAX_EFFICIENCY_PENALTY;
  }

  toJSON() {
    return { quality: this.quality };
  }

  static fromJSON(data: { quality?: number; airQuality?: number }): LifeSupportManager {
    const manager = new LifeSupportManager();
    manager.quality = data.quality ?? data.airQuality ?? 1;
    return manager;
  }
}
