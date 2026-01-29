import type { GameEvent } from "../../models/GameEvent";
import { RESOURCE_KEYS } from "../../models/Resources";
import { definePhase } from "../TickPhase";

export const applyResourceFlows = definePhase({
  id: "resources:applyFlows",
  name: "Apply Resource Flows",
  reads: ["resources"],
  writes: ["resources"],
  execute(ctx) {
    const resources = ctx.resources;
    const production = resources.getProduction();
    const consumption = resources.getConsumption();

    for (const key of RESOURCE_KEYS) {
      const produced = production[key] || 0;
      const consumed = consumption[key] || 0;
      const net = produced - consumed;

      if (net !== 0) {
        resources.add({ [key]: net });
        // Clamp to 0 if it went negative
        if (resources.getResources()[key] < 0) {
          resources.add({ [key]: -resources.getResources()[key] });
        }
      }
    }

    return [];
  },
});

export const checkResourceDepletion = definePhase({
  id: "resources:checkDepletion",
  name: "Check Resource Depletion",
  reads: ["resources"],
  writes: ["events"],
  execute(ctx) {
    const events: GameEvent[] = [];
    const resources = ctx.resources.getResources();

    for (const key of RESOURCE_KEYS) {
      const amount = resources[key];

      if (amount === 0) {
        events.push({
          type: "RESOURCE_DEPLETED",
          resource: key,
          severity: "critical",
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} depleted!`,
        });
      } else if (amount < 20) {
        events.push({
          type: "RESOURCE_LOW",
          resource: key,
          severity: "warning",
          currentAmount: amount,
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} running low: ${Math.floor(amount)}`,
        });
      }
    }

    return events;
  },
});
