import type { GameEvent } from "../../models/GameEvent";
import { TechnologyId } from "../../models/Technology";
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
  reads: ["technology", "buildings"],
  writes: ["grid"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    // Check if player has the improved power grid technology
    // Note: NUCLEAR_FISSION provides power efficiency bonus
    const hasTechBonus = ctx.technology.isResearched(TechnologyId.NUCLEAR_FISSION);

    // Get active building IDs - only active buildings can provide power
    const activeBuildings = ctx.buildings.getActiveBuildings();
    const activeBuildingIds = new Set(activeBuildings.map((b) => b.id));

    // Update power connections (in case buildings were added/removed)
    ctx.grid.updatePowerConnections(hasTechBonus, activeBuildingIds);

    // Tick the grid (drains batteries for unpowered buildings)
    ctx.grid.tick();

    return events;
  },
});
