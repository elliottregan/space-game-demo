import {
  RECYCLING_RECOVERY_RATES,
  RECYCLING_TIME_MULTIPLIER,
  REPAIR_COST_MULTIPLIER,
  REPURPOSE_COST_MULTIPLIER,
  REPURPOSE_TIME_MULTIPLIER,
  RUSH_RECYCLING_PENALTY,
} from "../balance/OperationsBalance";
import type { Building, BuildingDefinition } from "../models/Building";
import type { ResourceDelta } from "../models/Resources";

/**
 * Apply a multiplier to a resource cost, returning a scaled copy.
 *
 * @param baseCost - The original cost to scale
 * @param multiplier - The scaling factor
 * @param roundingFn - Function to round values (Math.ceil or Math.floor)
 * @returns Scaled resource delta
 */
export function scaleCost(
  baseCost: ResourceDelta,
  multiplier: number,
  roundingFn: (x: number) => number = Math.ceil,
): ResourceDelta {
  const result: ResourceDelta = {};
  for (const [key, value] of Object.entries(baseCost)) {
    if (value) {
      result[key as keyof ResourceDelta] = roundingFn(value * multiplier);
    }
  }
  return result;
}

/**
 * Calculate repair cost for a building (fraction of original cost).
 */
export function calculateRepairCost(def: BuildingDefinition): ResourceDelta {
  return scaleCost(def.cost, REPAIR_COST_MULTIPLIER);
}

/**
 * Calculate repurpose cost for a target building definition.
 */
export function calculateRepurposeCost(targetDef: BuildingDefinition): ResourceDelta {
  return scaleCost(targetDef.cost, REPURPOSE_COST_MULTIPLIER);
}

/**
 * Calculate repurpose time for a target building definition.
 */
export function calculateRepurposeTime(targetDef: BuildingDefinition): number {
  return Math.ceil(targetDef.constructionTime * REPURPOSE_TIME_MULTIPLIER);
}

/**
 * Determine the recycling recovery rate based on building state.
 */
export function getRecyclingRate(building: Building): number {
  if (building.broken) {
    return RECYCLING_RECOVERY_RATES.damaged;
  }
  if (building.status === "idle") {
    return RECYCLING_RECOVERY_RATES.depleted;
  }
  if (building.status === "active" && building.depositId) {
    return RECYCLING_RECOVERY_RATES.active;
  }
  return RECYCLING_RECOVERY_RATES.standard;
}

/**
 * Calculate recycle value for a building.
 */
export function calculateRecycleValue(building: Building, def: BuildingDefinition): ResourceDelta {
  const rate = getRecyclingRate(building);
  return scaleCost(def.cost, rate, Math.floor);
}

/**
 * Calculate recycle time for a building.
 */
export function calculateRecycleTime(def: BuildingDefinition): number {
  return Math.ceil(def.constructionTime * RECYCLING_TIME_MULTIPLIER);
}

/**
 * Apply rush recycling penalty to a recycle value.
 */
export function applyRushRecyclingPenalty(recycleValue: ResourceDelta): ResourceDelta {
  return scaleCost(recycleValue, 1 - RUSH_RECYCLING_PENALTY, Math.floor);
}
