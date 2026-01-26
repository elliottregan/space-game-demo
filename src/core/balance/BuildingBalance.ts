// src/core/balance/BuildingBalance.ts

/** Sol after which building condition decay begins */
export const MAINTENANCE_START_SOL = 100;

/** Condition decay rate: 1% per this many sols */
export const CONDITION_DECAY_INTERVAL = 5;

/** Amount of condition lost per decay interval */
export const CONDITION_DECAY_AMOUNT = 1;

/** Condition threshold below which efficiency penalty applies */
export const CONDITION_EFFICIENCY_THRESHOLD = 50;

/** Efficiency penalty multiplier when condition is below threshold (0.25 = -25%) */
export const CONDITION_EFFICIENCY_PENALTY = 0.25;

/** Maintenance cost as multiplier of building cost (0.1 = 10%) */
export const MAINTENANCE_COST_MULTIPLIER = 0.1;

/** Condition below which "Maintain" button is prominently shown */
export const MAINTENANCE_WARNING_THRESHOLD = 80;

/** Efficiency penalty when colony oxygen contribution is negative (0.5 = -50%) */
export const OXYGEN_DEFICIT_EFFICIENCY_PENALTY = 0.5;
