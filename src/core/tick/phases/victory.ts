import { definePhase } from "../TickPhase";

export const checkVictoryConditions = definePhase({
  id: "victory:checkConditions",
  name: "Check Victory Conditions",
  reads: ["technology", "colony", "resources"],
  writes: ["victory", "events"],
  execute(ctx) {
    return ctx.victory.tick(ctx.technology, ctx.colony, ctx.resources);
  },
});
