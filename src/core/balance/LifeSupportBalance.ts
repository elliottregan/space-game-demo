/** Utilization below this = excellent quality (95-100%) */
export const LS_UTILIZATION_COMFORTABLE = 0.6;
/** Utilization above this = strained quality, factions grumble */
export const LS_UTILIZATION_STRAINED = 0.8;
/** Utilization above this = critical quality, political pressure */
export const LS_UTILIZATION_CRITICAL = 0.95;
/** Quality threshold: above this, no penalties */
export const LS_QUALITY_COMFORTABLE = 0.8;
/** Quality threshold: below this, political pressure + morale impact */
export const LS_QUALITY_PRESSURE = 0.55;
/** Quality threshold: below this, crisis with health/morale penalties */
export const LS_QUALITY_CRISIS = 0.35;
/** Maximum health penalty per sol at 0% quality */
export const LS_MAX_HEALTH_PENALTY = 10;
/** Maximum morale penalty per sol at 0% quality */
export const LS_MAX_MORALE_PENALTY = 5;
/** Maximum efficiency penalty at 0% quality (buildings run at 50%) */
export const LS_MAX_EFFICIENCY_PENALTY = 0.5;
