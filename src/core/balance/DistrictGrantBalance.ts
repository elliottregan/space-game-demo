/** Number of grant cards shown in the panel */
export const GRANT_PANEL_SIZE = 3;

/** Resource cost to refresh all panel cards (materials) */
export const GRANT_REFRESH_COST = 0;

/** Earliest sol grants can appear */
export const GRANT_MIN_SOL = 15;

/** Base duration for infrastructure grants (sols) */
export const INFRASTRUCTURE_BASE_DURATION = 25;

/** Identity grant base duration (sols, before ideology scaling) */
export const IDENTITY_BASE_DURATION = 40;

/** Minimum speed multiplier for identity grants (barely qualifying ideology) */
export const IDENTITY_MIN_SPEED = 0.5;

/** Maximum speed multiplier for identity grants (perfect ideology alignment) */
export const IDENTITY_MAX_SPEED = 2.0;

/** Per-axis ideology shift strength for infrastructure grants */
export const INFRA_IDEOLOGY_SHIFT = 0.06;

/** How much conviction resists ideology shift (0-1) */
export const GRANT_CONVICTION_RESISTANCE = 0.7;

/** Specialization synergy threshold tier 1 (same-axis tags in one district) */
export const SPECIALIZATION_TIER_1 = 3;

/** Specialization synergy threshold tier 2 */
export const SPECIALIZATION_TIER_2 = 5;

/** Specialization bonus multiplier tier 1 (+10%) */
export const SPECIALIZATION_BONUS_1 = 0.1;

/** Specialization bonus multiplier tier 2 (+20%) */
export const SPECIALIZATION_BONUS_2 = 0.2;

/** Victory progress threshold to unlock capstone grant */
export const CAPSTONE_UNLOCK_THRESHOLD = 8;
