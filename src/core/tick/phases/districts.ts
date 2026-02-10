import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Process District Growth Phase
 *
 * Handles automatic housing growth within districts when occupancy exceeds threshold.
 * Deducts materials cost for growth.
 */
export const processDistrictGrowth = definePhase({
  id: "districts:growth",
  name: "Process District Growth",
  reads: ["districts", "resources"],
  writes: ["districts", "resources"],
  execute(ctx: TickContext): GameEvent[] {
    const materialsCost = ctx.districts.processGrowth(ctx.currentSol);
    if (materialsCost > 0) {
      const available = ctx.resources.getResources().materials;
      if (available >= materialsCost) {
        ctx.resources.deduct({ materials: materialsCost });
      }
    }
    return [];
  },
});
