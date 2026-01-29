import { definePhase } from "../TickPhase";

/**
 * Process Random Events Phase
 *
 * Checks for and triggers random game events based on current game state.
 * Events are only triggered if no event is currently active and timing
 * constraints (minimum sols between events) are satisfied.
 */
export const processRandomEvents = definePhase({
  id: "events:processRandomEvents",
  name: "Process Random Events",
  reads: ["currentSol", "events"],
  writes: ["events"],
  execute(ctx) {
    return ctx.events.tick(ctx.currentSol);
  },
});
