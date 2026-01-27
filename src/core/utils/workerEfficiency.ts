import {
  MASTERY_EFFICIENCY,
  MAX_SKILL_EFFICIENCY_BONUS,
  ROLE_MISMATCH_PENALTY,
  STAFFING_CURVE_EXPONENT,
  TRAINING_WORK_PENALTY,
} from "../balance/WorkforceBalance";
import { SKILLS } from "../data/skills";
import type { Colonist, ColonistRole } from "../models/Colonist";

/**
 * Calculate staffing efficiency using diminishing returns curve.
 * Formula: 1 - (1 - staffingRatio)^STAFFING_CURVE_EXPONENT
 *
 * @param assignedCount - Number of workers assigned to the building
 * @param workerSlots - Total worker slots available (0 or undefined means no slots)
 * @returns Efficiency multiplier between 0 and 1
 */
export function calculateStaffingEfficiency(
  assignedCount: number,
  workerSlots: number | undefined,
): number {
  if (!workerSlots) return 1; // No worker slots = always full efficiency
  if (assignedCount === 0) return 0;

  const staffingRatio = assignedCount / workerSlots;
  return 1 - (1 - staffingRatio) ** STAFFING_CURVE_EXPONENT;
}

/**
 * Calculate efficiency for a single colonist working at a building.
 * Factors in: mastery level, skill bonuses, role mismatch penalty, training penalty.
 *
 * @param colonist - The colonist working
 * @param requiredRole - The role the building requires (if any)
 * @returns Efficiency multiplier (typically 0.5 to 1.5)
 */
export function calculateColonistEfficiency(
  colonist: Colonist,
  requiredRole?: ColonistRole,
): number {
  // Base mastery efficiency
  let efficiency = MASTERY_EFFICIENCY[colonist.masteryLevel] ?? 1;

  // Add skill bonus (capped)
  const skillBonus = calculateSkillBonus(colonist);
  efficiency += skillBonus;

  // Role mismatch penalty
  if (requiredRole && colonist.role !== requiredRole) {
    efficiency *= 1 - ROLE_MISMATCH_PENALTY;
  }

  // Training penalty
  if (colonist.trainingTarget) {
    efficiency *= 1 - TRAINING_WORK_PENALTY;
  }

  return efficiency;
}

/**
 * Calculate the skill bonus for a colonist based on their skills and role.
 * Only skills with affinity for the colonist's current role provide bonuses.
 *
 * @param colonist - The colonist to calculate bonus for
 * @returns Capped skill bonus value
 */
function calculateSkillBonus(colonist: Colonist): number {
  let bonus = 0;

  for (const skillId of colonist.skills) {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (skill?.affinity.includes(colonist.role)) {
      bonus += skill.efficiencyBonus;
    }
  }

  return Math.min(bonus, MAX_SKILL_EFFICIENCY_BONUS);
}

/**
 * Calculate average worker efficiency for a set of colonists at a building.
 *
 * Note: This averages over the provided colonists array only. If some assigned
 * worker IDs fail to resolve to colonists, they should be filtered out before
 * calling this function. This is intentional - invalid/missing colonist IDs
 * should not penalize efficiency.
 *
 * @param colonists - Array of colonists assigned to the building
 * @param requiredRole - The role the building requires (if any)
 * @returns Average efficiency across all workers, or 1 if no workers
 */
export function calculateAverageWorkerEfficiency(
  colonists: Colonist[],
  requiredRole?: ColonistRole,
): number {
  if (colonists.length === 0) return 1;

  let totalEfficiency = 0;
  for (const colonist of colonists) {
    totalEfficiency += calculateColonistEfficiency(colonist, requiredRole);
  }

  return totalEfficiency / colonists.length;
}
