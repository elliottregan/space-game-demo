import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";
import { getDistrictGrantTemplate } from "../../data/districtGrants";
import { rng } from "../../utils/random";

/**
 * Process District Grants Phase
 *
 * 1. Auto-fill empty panel slots
 * 2. Tick active grants (decrement timers)
 * 3. Complete grants that have finished
 * 4. Apply grant completion effects
 */
export const processDistrictGrants = definePhase({
  id: "districtGrants:process",
  name: "Process District Grants",
  reads: ["districtGrants"],
  writes: ["districtGrants", "resources", "colony", "colonistMorale", "victory"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];

    // Auto-fill empty panel slots
    ctx.districtGrants.fillEmptySlots(ctx.currentSol, rng);

    // Tick active grants
    ctx.districtGrants.tick();

    // Process completed grants
    const completed = ctx.districtGrants.getCompletedThisTick();
    for (const grant of completed) {
      const template = getDistrictGrantTemplate(grant.templateId);
      if (!template) continue;

      // Record completion in district identity
      ctx.districtGrants.addCompletedGrant(grant.districtId, grant.templateId);

      // Apply effects
      if (template.effect.colonyMoraleBoost) {
        ctx.colonistMorale.adjustAllColonistsMorale(template.effect.colonyMoraleBoost);
      }
      if (template.effect.populationBonus && template.effect.populationBonus > 0) {
        for (let i = 0; i < template.effect.populationBonus; i++) {
          ctx.colony.addColonist();
        }
      }
      if (template.effect.foodBonus) {
        ctx.resources.addProduction({ food: template.effect.foodBonus });
      }
      if (template.effect.materialsBonus) {
        ctx.resources.addProduction({ materials: template.effect.materialsBonus });
      }

      // Check for capstone completion
      if (template.isCapstone) {
        const capstoneEvent = ctx.victory.checkCapstoneGrant(grant.templateId);
        if (capstoneEvent) {
          events.push(capstoneEvent);
        }
      }

      events.push({
        type: "grant_completed",
        severity: "info",
        message: `Grant "${template.name}" completed in district`,
        details: {
          grantId: grant.templateId,
          districtId: grant.districtId,
          category: template.category,
        },
      });
    }

    // Remove completed grants from active list
    ctx.districtGrants.removeCompletedGrants();

    return events;
  },
});
