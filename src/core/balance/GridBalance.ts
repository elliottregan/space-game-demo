// src/core/balance/GridBalance.ts

/** Battery backup duration in sols */
export const BATTERY_BACKUP_SOLS = 3;

/** Low battery threshold (below this shows warning) */
export const LOW_BATTERY_THRESHOLD = 0.33;

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
