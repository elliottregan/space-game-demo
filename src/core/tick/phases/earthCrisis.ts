import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Process Earth Crisis Phase
 *
 * Increases crisis severity, triggers refugee waves, checks for point of no return.
 */
export const processEarthCrisis = definePhase({
  id: "earthCrisis:process",
  name: "Process Earth Crisis",
  reads: ["earthCrisis", "currentSol"],
  writes: ["earthCrisis", "colony", "events"],
  execute(ctx: TickContext): GameEvent[] {
    const effects = ctx.earthCrisis.tick(ctx.currentSol);
    const events: GameEvent[] = [];

    for (const effect of effects) {
      if (effect.type === "refugee_wave" && effect.params?.count) {
        const count = effect.params.count as number;
        const refugeeEvents = ctx.colony.addRefugees(count);
        events.push({
          type: "REFUGEE_WAVE",
          severity: "info",
          message: `${count} climate refugees arrived from Earth`,
        });
        events.push(...refugeeEvents);
      } else if (effect.type === "earth_collapse") {
        events.push({
          type: "EARTH_COLLAPSE",
          severity: "critical",
          message: effect.message || "Earth's climate has collapsed",
        });
      }
    }

    return events;
  },
});
