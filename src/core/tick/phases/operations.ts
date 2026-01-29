import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";
import {
  canExtract,
  getBaseProductionForDeposit,
  getDepletionEvents,
} from "../../utils/depositExtraction";

/**
 * Process Operations Phase
 *
 * Updates expedition timers, resolves completed expeditions, and processes
 * policy effects on expeditions and resource gathering.
 */
export const processOperations = definePhase({
  id: "operations:processOperations",
  name: "Process Operations",
  reads: ["operations", "currentSol", "resources", "colony"],
  writes: ["operations", "events"],
  execute(ctx: TickContext): GameEvent[] {
    return ctx.operations.tick(ctx.currentSol, ctx.resources, ctx.colony);
  },
});

/**
 * Process Deposit Extraction Phase
 *
 * Handles resource extraction from deposits for all active mining buildings.
 * Generates depletion warning events and transitions exhausted buildings to idle.
 */
export const processDepositExtraction = definePhase({
  id: "operations:processDepositExtraction",
  name: "Process Deposit Extraction",
  reads: ["buildings", "operations"],
  writes: ["buildings", "operations", "resources", "events"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    for (const building of ctx.buildings.getActiveBuildings()) {
      const def = ctx.buildings.getDefinition(building.definitionId);
      if (!canExtract(building, def) || !def) continue;

      const site = ctx.operations.getSites().find((s) => s.id === building.depositId);
      if (!site) continue;

      const baseProduction = getBaseProductionForDeposit(def, site.resourceType);
      if (baseProduction === 0) continue;

      const warningBefore = ctx.operations.getDepletionWarningLevel(site.id);
      ctx.operations.processExtraction(building.id, baseProduction);
      const warningAfter = ctx.operations.getDepletionWarningLevel(site.id);

      events.push(...getDepletionEvents(warningBefore, warningAfter, site, building, def.name));

      if (warningAfter === "depleted") {
        // Transition building to idle and remove resource flow
        building.status = "idle";

        const effectiveProd = ctx.buildings.getEffectiveProduction(building.id);
        const effectiveCons = ctx.buildings.getEffectiveConsumption(building.id);

        if (Object.keys(effectiveProd).length > 0) {
          ctx.resources.removeProduction(effectiveProd);
        }
        if (Object.keys(effectiveCons).length > 0) {
          ctx.resources.removeConsumption(effectiveCons);
        }
      }
    }

    return events;
  },
});
