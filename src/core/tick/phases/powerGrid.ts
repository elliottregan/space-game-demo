import {
  POWER_GRID_COMFORTABLE,
  POWER_GRID_CRITICAL,
  POWER_GRID_MAX_EFFICIENCY_PENALTY,
} from "../../balance/PowerGridBalance";
import type { GameEvent } from "../../models/GameEvent";
import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";

/**
 * Calculate Power Grid Phase
 *
 * Computes power grid strain from building power production vs consumption.
 * Populates derived.powerGrid and derived.powerGridEffects for use by later phases.
 */
export const calculatePowerGrid = definePhase({
  id: "powerGrid:calculate",
  name: "Calculate Power Grid",
  reads: ["buildings"],
  writes: ["derived.powerGrid", "derived.powerGridEffects", "buildings", "powerGridManager"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    // Get power production and consumption from buildings
    const production = ctx.buildings.getTotalPowerProduction();
    const consumption = ctx.buildings.getTotalPowerConsumption();

    // Calculate grid strain using the manager (updates its internal state)
    const gridStrain = ctx.powerGridManager.calculate(production, consumption);

    ctx.derived.powerGrid = gridStrain;

    // Calculate efficiency based on thresholds
    let efficiency = 1;

    if (gridStrain < POWER_GRID_CRITICAL) {
      const severity = 1 - gridStrain / POWER_GRID_CRITICAL;
      efficiency = 1 - severity * POWER_GRID_MAX_EFFICIENCY_PENALTY;
    }

    ctx.derived.powerGridEffects = { efficiency };

    // Apply efficiency to buildings
    ctx.buildings.setPowerGridEfficiency(efficiency);

    // Generate warning events
    if (gridStrain < POWER_GRID_CRITICAL) {
      events.push({
        type: "POWER_GRID_CRITICAL",
        gridStrain,
        severity: "critical",
        message: `Power grid critical: ${Math.round(gridStrain * 100)}% capacity`,
      });
    } else if (gridStrain < POWER_GRID_COMFORTABLE) {
      events.push({
        type: "POWER_GRID_STRAINED",
        gridStrain,
        severity: "warning",
        message: `Power grid strained: ${Math.round(gridStrain * 100)}% capacity`,
      });
    }

    return events;
  },
});
