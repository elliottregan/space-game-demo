import type { GameEvent } from "../../models/GameEvent";
import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";

/**
 * Process Grid Tick Phase
 *
 * Updates power connections and drains batteries for unpowered buildings.
 * Should run early in the tick, after air quality and power grid calculations.
 */
export const processGridTick = definePhase({
  id: "grid:tick",
  name: "Process Grid Tick",
  reads: ["technology"],
  writes: ["grid"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    // Check if player has the improved power grid technology
    const hasTechBonus = ctx.technology.isResearched("improved-power-grid");

    // Update power connections (in case buildings were added/removed)
    ctx.grid.updatePowerConnections(hasTechBonus);

    // Tick the grid (drains batteries for unpowered buildings)
    ctx.grid.tick();

    return events;
  },
});
