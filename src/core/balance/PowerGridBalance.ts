// src/core/balance/PowerGridBalance.ts

/**
 * Power grid strain thresholds and efficiency penalties.
 * Power works like air quality - it's a 0-1 ratio of production/consumption.
 */

/** Grid strain above this is comfortable (full efficiency) */
export const POWER_GRID_COMFORTABLE = 0.8;

/** Grid strain below this triggers reduced efficiency */
export const POWER_GRID_CRITICAL = 0.5;

/** Maximum efficiency penalty at grid strain = 0 (0.5 = 50% reduction) */
export const POWER_GRID_MAX_EFFICIENCY_PENALTY = 0.5;
