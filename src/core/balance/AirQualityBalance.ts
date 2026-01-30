// src/core/balance/AirQualityBalance.ts

/** Base oxygen consumption per colonist per tick */
export const BASE_OXYGEN_PER_COLONIST = 1;

/** Air quality threshold: above this is comfortable (no penalties) */
export const AIR_QUALITY_COMFORTABLE = 0.8;

/** Air quality threshold: below this is critical (severe penalties) */
export const AIR_QUALITY_CRITICAL = 0.5;

/** Air quality threshold: below this death risk begins */
export const AIR_QUALITY_DEADLY = 0.2;

/** Maximum health loss per tick at air quality = 0 */
export const AIR_QUALITY_MAX_HEALTH_PENALTY = 10;

/** Maximum morale loss per tick at air quality = 0 */
export const AIR_QUALITY_MAX_MORALE_PENALTY = 5;

/** Maximum efficiency penalty at air quality = 0 (0.5 = 50% reduction) */
export const AIR_QUALITY_MAX_EFFICIENCY_PENALTY = 0.5;
