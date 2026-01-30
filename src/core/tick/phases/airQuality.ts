import {
  BASE_OXYGEN_PER_COLONIST,
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  AIR_QUALITY_MAX_HEALTH_PENALTY,
  AIR_QUALITY_MAX_MORALE_PENALTY,
  AIR_QUALITY_MAX_EFFICIENCY_PENALTY,
} from "../../balance/AirQualityBalance";
import type { GameEvent } from "../../models/GameEvent";
import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";

/**
 * Calculate Air Quality Phase
 *
 * Computes air quality from building oxygen contributions vs. population consumption.
 * Populates derived.airQuality and derived.airQualityEffects for use by later phases.
 */
export const calculateAirQuality = definePhase({
  id: "airQuality:calculate",
  name: "Calculate Air Quality",
  reads: ["buildings", "colony"],
  writes: ["derived.airQuality", "derived.airQualityEffects", "buildings"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    // Get oxygen production from buildings
    const production = ctx.buildings.getTotalOxygenContribution();

    // Get oxygen consumption from population
    const population = ctx.colony.getPopulation();
    const consumption = population * BASE_OXYGEN_PER_COLONIST;

    // Calculate air quality
    let airQuality: number;
    if (consumption <= 0) {
      airQuality = 1;
    } else if (production <= 0) {
      airQuality = 0;
    } else {
      airQuality = Math.max(0, Math.min(1, production / consumption));
    }

    ctx.derived.airQuality = airQuality;

    // Calculate effects based on thresholds
    let health = 0;
    let morale = 0;
    let efficiency = 1;

    if (airQuality < AIR_QUALITY_COMFORTABLE) {
      const severity = 1 - airQuality / AIR_QUALITY_COMFORTABLE;
      health = -severity * AIR_QUALITY_MAX_HEALTH_PENALTY;
      morale = -severity * AIR_QUALITY_MAX_MORALE_PENALTY;
    }

    if (airQuality < AIR_QUALITY_CRITICAL) {
      const severity = 1 - airQuality / AIR_QUALITY_CRITICAL;
      efficiency = 1 - severity * AIR_QUALITY_MAX_EFFICIENCY_PENALTY;
    }

    ctx.derived.airQualityEffects = { health, morale, efficiency };

    // Apply efficiency to buildings
    ctx.buildings.setAirQualityEfficiency(efficiency);

    // Generate warning events
    if (airQuality < AIR_QUALITY_CRITICAL) {
      events.push({
        type: "AIR_QUALITY_CRITICAL",
        airQuality,
        severity: "critical",
        message: `Air quality critical: ${Math.round(airQuality * 100)}%`,
      });
    } else if (airQuality < AIR_QUALITY_COMFORTABLE) {
      events.push({
        type: "AIR_QUALITY_LOW",
        airQuality,
        severity: "warning",
        message: `Air quality strained: ${Math.round(airQuality * 100)}%`,
      });
    }

    return events;
  },
});
