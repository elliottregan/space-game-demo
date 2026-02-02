// src/facade/domains/AirQualityFacade.ts

import type { GameState } from "../../core/GameState";
import { BASE_AIR_PER_COLONIST } from "../../core/balance/AirQualityBalance";
import type { Queryable } from "../types/interfaces";
import type { AirQualitySnapshot } from "../types/airQuality";

/**
 * Facade for air quality queries.
 * Air quality is calculated during the tick phase based on oxygen production/consumption.
 *
 * Implements: Queryable<AirQualitySnapshot>
 */
export class AirQualityFacade implements Queryable<AirQualitySnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete air quality state snapshot.
   */
  snapshot(): AirQualitySnapshot {
    const production = this.gameState.buildings.getTotalAirContribution();
    const consumption = this.gameState.colony.getPopulation() * BASE_AIR_PER_COLONIST;
    const airQuality = this.gameState.airQuality.getAirQuality();

    return {
      airQuality,
      production,
      consumption,
      healthEffect: this.gameState.airQuality.getHealthEffect(),
      moraleEffect: this.gameState.airQuality.getMoraleEffect(),
      efficiencyMultiplier: this.gameState.airQuality.getEfficiencyMultiplier(),
    };
  }
}
