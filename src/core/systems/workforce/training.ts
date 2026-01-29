// src/core/systems/workforce/training.ts
import { ColonistRole, ROLE_DISPLAY_NAMES } from "../../models/Colonist";
import { ROLE_AFFINITY } from "../../balance/WorkforceBalance";

/**
 * Get training time in sols to transition between roles.
 * Pure function.
 */
export function getTrainingTime(currentRole: ColonistRole, targetRole: ColonistRole): number {
  const affinities = ROLE_AFFINITY[currentRole];
  return affinities?.[targetRole] ?? 10;
}

/**
 * Get display name for a colonist role.
 * Pure function.
 */
export function getRoleName(role: ColonistRole): string {
  return ROLE_DISPLAY_NAMES[role];
}
