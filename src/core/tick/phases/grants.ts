import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";
import { rng } from "../../utils/random";

/**
 * Process Grants Phase
 *
 * 1. Refresh available grants when interval elapses
 * 2. Process timed grants (decrement timers, remove expired, unregister production bonuses)
 */
export const processGrants = definePhase({
  id: "grants:process",
  name: "Process Grants",
  reads: ["grants", "resources"],
  writes: ["grants", "resources"],
  execute(ctx: TickContext): GameEvent[] {
    // Refresh available grants on schedule
    if (ctx.grants.shouldRefresh(ctx.currentSol)) {
      ctx.grants.refreshGrants(ctx.currentSol, rng);
    }

    // Process timed grants: decrement timers, collect expired
    const expiredIds = ctx.grants.processTimedGrants();

    // Unregister production bonuses for expired grants
    for (const grantId of expiredIds) {
      ctx.resources.removeProductionBonus(`grant_${grantId}`);
    }

    return [];
  },
});
