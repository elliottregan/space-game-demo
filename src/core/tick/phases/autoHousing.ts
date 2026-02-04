import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Auto-Housing Phase
 *
 * Checks if colony is at 85%+ housing capacity and automatically
 * starts a Basic Habitat if Prefab Construction tech is researched.
 */
export const checkAutoHousing = definePhase({
  id: "buildings:checkAutoHousing",
  name: "Check Auto-Housing",
  reads: ["buildings", "resources", "technology", "colony"],
  writes: ["buildings", "resources", "events"],
  execute(ctx: TickContext): GameEvent[] {
    const population = ctx.colony.getPopulation();
    const housingCapacity = ctx.colony.getHousingCapacity(ctx.buildings);

    return ctx.buildings.checkAutoHousing(
      ctx.resources,
      ctx.technology,
      population,
      housingCapacity,
    );
  },
});
