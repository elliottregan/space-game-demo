import { definePhase } from "../TickPhase";

export const processResearch = definePhase({
  id: "technology:processResearch",
  name: "Process Research",
  reads: ["technology", "resources", "buildings"],
  writes: ["technology", "events"],
  execute(ctx) {
    const researchRate = ctx.buildings.getTotalResearchOutput();
    return ctx.technology.tick(ctx.resources, researchRate);
  },
});
