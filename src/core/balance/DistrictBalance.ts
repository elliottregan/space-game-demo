/** Cost to found a new district */
export const DISTRICT_FOUNDING_COST = 100;

/** Starting housing capacity when a district is founded */
export const DISTRICT_INITIAL_CAPACITY = 20;

/** Occupancy ratio that triggers automatic growth */
export const DISTRICT_GROWTH_TRIGGER = 0.8;

/** Occupancy ratio that pauses growth */
export const DISTRICT_GROWTH_PAUSE = 0.6;

/** Capacity units added per growth tick */
export const DISTRICT_GROWTH_AMOUNT = 1;

/** Sols between each growth tick */
export const DISTRICT_GROWTH_INTERVAL = 5;

/** Materials consumed per sol while growing */
export const DISTRICT_GROWTH_MATERIAL_COST = 2;

/** Overcrowding soft cap per district */
export const DISTRICT_OVERCROWDING_CAP = 40;

/** Overcrowding penalty tiers: [threshold, moralePenalty] */
export const DISTRICT_OVERCROWDING_TIERS = [
  { min: 40, max: 50, moralePenalty: 5, healthRisk: 0.01 },
  { min: 50, max: 60, moralePenalty: 15, healthRisk: 0.03 },
  { min: 60, max: Infinity, moralePenalty: 25, healthRisk: 0.05 },
] as const;

/** Morale cost when a colonist is forcibly transferred */
export const DISTRICT_TRANSFER_MORALE_COST = 5;

/** Productivity penalty for cross-district work (0-1) */
export const CROSS_DISTRICT_WORK_PENALTY = 0.2;

/** Neighborhood bonding rate (per sol, same district) */
export const NEIGHBORHOOD_BONDING_RATE = 0.005;

/** Initial relationship strength for new neighbors */
export const INITIAL_NEIGHBORHOOD_RELATIONSHIP = 0.08;

/** Cross-district bonding rate (per sol, different districts) */
export const CROSS_DISTRICT_BONDING_RATE = 0.001;

/** Critical power deficit threshold (fraction of total demand) */
export const POWER_CRITICAL_THRESHOLD = 0.5;

/**
 * Population growth scaling.
 * Effective rate = BASE_RATE * (1 - population / SCALING_DENOMINATOR)
 */
export const POPULATION_SCALING_DENOMINATOR = 200;
