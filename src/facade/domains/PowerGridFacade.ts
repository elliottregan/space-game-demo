// src/facade/domains/PowerGridFacade.ts

import type { GameState } from "../../core/GameState";
import { PowerState } from "../../core/models/Grid";
import type { Queryable } from "../types/interfaces";
import type { PowerGridSnapshot } from "../types/powerGrid";

/**
 * Facade for power grid queries.
 * Provides statistics about the grid-based power system.
 */
export class PowerGridFacade implements Queryable<PowerGridSnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get power grid statistics snapshot.
   */
  snapshot(): PowerGridSnapshot {
    const production = this.gameState.buildings.getTotalPowerProduction();
    const consumption = this.gameState.buildings.getTotalPowerConsumption();

    // Count buildings by power state
    const counts = { powered: 0, onBattery: 0, lowBattery: 0, unpowered: 0 };

    for (const building of this.gameState.buildings.getActiveBuildings()) {
      const state = this.gameState.grid.getPowerState(building.id);
      switch (state) {
        case PowerState.POWERED:
          counts.powered++;
          break;
        case PowerState.ON_BATTERY:
          counts.onBattery++;
          break;
        case PowerState.LOW_BATTERY:
          counts.lowBattery++;
          break;
        case PowerState.UNPOWERED:
          counts.unpowered++;
          break;
      }
    }

    return {
      totalProduction: production,
      totalConsumption: consumption,
      buildingCounts: counts,
    };
  }
}
