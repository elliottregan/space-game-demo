// src/core/systems/workforce/cohort.ts
import { COHORT_WINDOW_SOLS, COHORT_BONDING_MULTIPLIER } from "../../balance/WorkforceBalance";

/**
 * Check if two colonists are in the same cohort (arrived within COHORT_WINDOW_SOLS).
 * Pure function - no side effects.
 */
export function areInSameCohort(
  arrivalSolA: number | undefined,
  arrivalSolB: number | undefined,
): boolean {
  if (arrivalSolA === undefined || arrivalSolB === undefined) {
    return false;
  }
  return Math.abs(arrivalSolA - arrivalSolB) <= COHORT_WINDOW_SOLS;
}

/**
 * Get the bonding rate multiplier for two colonists based on cohort membership.
 * Returns COHORT_BONDING_MULTIPLIER if same cohort, 1.0 otherwise.
 */
export function getCohortBondingMultiplier(
  arrivalSolA: number | undefined,
  arrivalSolB: number | undefined,
): number {
  return areInSameCohort(arrivalSolA, arrivalSolB) ? COHORT_BONDING_MULTIPLIER : 1.0;
}
