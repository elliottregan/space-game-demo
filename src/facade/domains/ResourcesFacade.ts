// src/facade/domains/ResourcesFacade.ts
// Resource queries facade

import type { GameState } from "../../core/GameState";
import { RESOURCE_KEYS, type ResourceDelta } from "../../core/models/Resources";
import type { CanDoResult, Queryable, ResourceSnapshot } from "../types";

/**
 * Facade for resource-related queries.
 * Resources don't have commands - they're modified through other domains.
 *
 * Implements: Queryable<ResourceSnapshot>
 */
export class ResourcesFacade implements Queryable<ResourceSnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete resource state snapshot.
   */
  snapshot(): ResourceSnapshot {
    return {
      current: Object.freeze({ ...this.gameState.resources.getResources() }),
      production: Object.freeze({ ...this.gameState.resources.getProduction() }),
      consumption: Object.freeze({ ...this.gameState.resources.getConsumption() }),
      netFlow: Object.freeze({ ...this.gameState.resources.getNetFlow() }),
    };
  }

  /**
   * Check if the player can afford a given cost.
   */
  canAfford(cost: ResourceDelta): boolean {
    return this.gameState.resources.canAfford(cost);
  }

  /**
   * Get detailed affordability check with missing resources.
   */
  checkAffordability(cost: ResourceDelta): CanDoResult {
    const current = this.gameState.resources.getResources();
    const missing: ResourceDelta = {};
    let canAfford = true;

    for (const key of RESOURCE_KEYS) {
      const required = cost[key] ?? 0;
      const available = current[key];
      if (required > available) {
        canAfford = false;
        missing[key] = required - available;
      }
    }

    if (canAfford) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Insufficient resources",
      missingResources: missing as Record<string, number>,
    };
  }
}
