import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Auto-Housing Phase (no-op)
 *
 * District auto-growth replaces the old auto-housing logic.
 * This phase is kept as a no-op for now and will be removed in cleanup.
 */
export const checkAutoHousing = definePhase({
  id: "buildings:checkAutoHousing",
  name: "Check Auto-Housing",
  reads: [],
  writes: [],
  execute(_ctx: TickContext): GameEvent[] {
    return [];
  },
});
