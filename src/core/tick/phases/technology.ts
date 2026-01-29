import { definePhase } from "../TickPhase";

export const processResearch = definePhase({
  id: "technology:processResearch",
  name: "Process Research",
  reads: ["technology", "resources"],
  writes: ["technology", "events"],
  execute(ctx) {
    return ctx.technology.tick(ctx.resources);
  },
});
