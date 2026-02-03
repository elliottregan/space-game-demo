// src/core/balance/GridBalance.ts

/** Base range for all power sources */
export const POWER_RANGE_BASE = 2;

/** Additional range per 20 power output */
export const POWER_RANGE_PER_OUTPUT = 20;

/** Range bonus from Improved Power Grid technology */
export const TECH_RANGE_BONUS = 1;

/** Battery backup duration in sols */
export const BATTERY_BACKUP_SOLS = 3;

/** Low battery threshold (below this shows warning) */
export const LOW_BATTERY_THRESHOLD = 0.33;

/**
 * Calculate power range for a power source.
 * Range = base + floor(output/20) + tech bonus
 */
export function calculatePowerRange(powerOutput: number, hasTechBonus: boolean): number {
  const outputBonus = Math.floor(powerOutput / POWER_RANGE_PER_OUTPUT);
  const techBonus = hasTechBonus ? TECH_RANGE_BONUS : 0;
  return POWER_RANGE_BASE + outputBonus + techBonus;
}

// Transit connectivity
/** Base range for transit depots */
export const DEPOT_RANGE_BASE = 3;

/**
 * Calculate depot range for transit connectivity.
 * Range = base + tech bonus
 */
export function calculateDepotRange(hasTechBonus: boolean): number {
  const techBonus = hasTechBonus ? 1 : 0;
  return DEPOT_RANGE_BASE + techBonus;
}
