import {
  LABOR_POOL_BONUS_CAP,
  LABOR_POOL_BONUS_PER_COLONIST,
} from "../../balance/WorkforceBalance";
import { definePhase } from "../TickPhase";

export const updateLaborPoolBonus = definePhase({
  id: "pretick:updateLaborPoolBonus",
  name: "Update Labor Pool Bonus",
  reads: ["colony", "buildings"],
  writes: ["buildings", "derived.laborPoolBonus"],
  execute(ctx) {
    const colonists = ctx.colony.getColonists();
    const assignedIds = new Set<string>();

    for (const building of ctx.buildings.getBuildings()) {
      for (const id of building.assignedWorkers) {
        assignedIds.add(id);
      }
    }

    const unassignedCount = colonists.filter((c) => !assignedIds.has(c.id)).length;
    const bonus = Math.min(unassignedCount * LABOR_POOL_BONUS_PER_COLONIST, LABOR_POOL_BONUS_CAP);

    ctx.buildings.setConstructionSpeedBonus(bonus);
    ctx.derived.laborPoolBonus = bonus;

    return [];
  },
});
