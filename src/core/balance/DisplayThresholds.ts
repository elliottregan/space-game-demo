// src/core/balance/DisplayThresholds.ts
// Display thresholds for status indicators and variants

/** Colony health thresholds */
export const HEALTH_POSITIVE_THRESHOLD = 80;
export const HEALTH_WARNING_THRESHOLD = 50;

/** Colony morale thresholds */
export const MORALE_POSITIVE_THRESHOLD = 70;
export const MORALE_WARNING_THRESHOLD = 40;

/** Faction support thresholds (percentage 0-100) */
export const FACTION_SUPPORT_POSITIVE_THRESHOLD = 60;
export const FACTION_SUPPORT_WARNING_THRESHOLD = 40;

/** Faction support thresholds (normalized -1 to 1 scale) */
export const FACTION_SUPPORT_NORMALIZED_POSITIVE = 0.5;
export const FACTION_SUPPORT_NORMALIZED_WARNING = 0;

export type StatusVariant = "positive" | "warning" | "negative";

/** Get variant for a value using thresholds */
export function getStatusVariant(
  value: number,
  positiveThreshold: number,
  warningThreshold: number
): StatusVariant {
  if (value >= positiveThreshold) return "positive";
  if (value >= warningThreshold) return "warning";
  return "negative";
}

/** Get health status variant */
export function getHealthVariant(health: number): StatusVariant {
  return getStatusVariant(health, HEALTH_POSITIVE_THRESHOLD, HEALTH_WARNING_THRESHOLD);
}

/** Get morale status variant */
export function getMoraleVariant(morale: number): StatusVariant {
  return getStatusVariant(morale, MORALE_POSITIVE_THRESHOLD, MORALE_WARNING_THRESHOLD);
}

/** Get faction support variant (percentage scale) */
export function getFactionSupportVariant(support: number): StatusVariant {
  return getStatusVariant(support, FACTION_SUPPORT_POSITIVE_THRESHOLD, FACTION_SUPPORT_WARNING_THRESHOLD);
}

/** Get faction support variant (normalized -1 to 1 scale) */
export function getFactionSupportNormalizedVariant(support: number): StatusVariant {
  return getStatusVariant(support, FACTION_SUPPORT_NORMALIZED_POSITIVE, FACTION_SUPPORT_NORMALIZED_WARNING);
}
