import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Process Workforce Tick Phase (Combined)
 *
 * Handles all workforce processing including:
 * - Coworker bonding (relationships formed through working together)
 * - Housemate bonding (relationships formed through shared housing)
 * - Guild bonding (professional relationships)
 * - Social bonding (relationships formed at social buildings)
 * - Preferential attachment (network growth)
 *
 * This is a transitional combined phase that will be split into
 * finer-grained phases later.
 */
export const processWorkforceTick = definePhase({
  id: "workforce:processWorkforceTick",
  name: "Process Workforce Tick",
  reads: ["workforce", "colony", "buildings", "currentSol"],
  writes: ["workforce", "colony", "events"],
  execute(ctx: TickContext): GameEvent[] {
    return ctx.workforce.tick(ctx.colony, ctx.buildings, ctx.currentSol);
  },
});
