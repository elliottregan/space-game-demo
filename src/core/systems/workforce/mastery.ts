import { MasteryLevel } from "../../models/Colonist";
import { MASTERY_THRESHOLDS, MASTERY_EFFICIENCY } from "../../balance/WorkforceBalance";

/**
 * Calculate mastery level from experience points.
 * Pure function.
 */
export function calculateMasteryLevel(experience: number): MasteryLevel {
  if (experience >= MASTERY_THRESHOLDS.MASTER) return MasteryLevel.MASTER;
  if (experience >= MASTERY_THRESHOLDS.EXPERT) return MasteryLevel.EXPERT;
  if (experience >= MASTERY_THRESHOLDS.SKILLED) return MasteryLevel.SKILLED;
  return MasteryLevel.NOVICE;
}

/**
 * Get efficiency multiplier for a mastery level.
 * Pure function.
 */
export function getMasteryEfficiency(level: MasteryLevel): number {
  return MASTERY_EFFICIENCY[level] ?? 1.0;
}

/**
 * Get display name for a mastery level.
 * Pure function.
 */
export function getMasteryName(level: MasteryLevel): string {
  switch (level) {
    case MasteryLevel.NOVICE:
      return "Novice";
    case MasteryLevel.SKILLED:
      return "Skilled";
    case MasteryLevel.EXPERT:
      return "Expert";
    case MasteryLevel.MASTER:
      return "Master";
  }
}
