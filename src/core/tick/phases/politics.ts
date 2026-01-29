import { definePhase } from "../TickPhase";

/**
 * Process NPC Influence Phase
 *
 * Updates NPC relationships, support levels, faction demands, and political pressure.
 * This phase handles all political simulation including support decay, demand deadlines,
 * and relationship drift.
 */
export const processNPCInfluence = definePhase({
  id: "politics:processNPCInfluence",
  name: "Process NPC Influence",
  reads: ["npcInfluence", "currentSol"],
  writes: ["npcInfluence", "events"],
  execute(ctx) {
    return ctx.npcInfluence.tick(ctx.currentSol);
  },
});
