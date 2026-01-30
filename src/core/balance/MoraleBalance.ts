// src/core/balance/MoraleBalance.ts

export const COLONIST_MORALE = {
  // Needs hierarchy weights (must sum to 1.0)
  NEEDS_WEIGHTS: {
    physiological: 0.4,
    safety: 0.25,
    social: 0.2,
    esteem: 0.15,
  },

  // Social need thresholds
  SOCIAL_ISOLATED_THRESHOLD: 1,
  SOCIAL_SATISFIED_CONNECTIONS: 3,
  SOCIAL_SATISFIED_STRENGTH: 0.5,

  // Propagation parameters
  PROPAGATION_ALPHA: 0.15,
  BASE_MORALE_WEIGHT: 0.7,
  SOCIAL_INFLUENCE_WEIGHT: 0.3,

  // Centrality recalculation
  CENTRALITY_RECALC_INTERVAL: 20,
  CENTRALITY_MAX_ITERATIONS: 20,
  CENTRALITY_TOLERANCE: 0.0001,

  // Event thresholds
  HIGH_CENTRALITY_THRESHOLD: 0.15,
  LOW_MORALE_SPREAD_WARNING: 40,

  // Initial morale for new colonists
  INITIAL_MORALE: 70,

  // Social building (third place) boost
  SOCIAL_BUILDING_BOOST_DIVISOR: 10, // moraleBoost / this = per-sol gain

  // Grace period for physiological needs (colonists don't penalize negative net flow early game)
  PHYSIOLOGICAL_GRACE_PERIOD: 100, // sols before net flow affects morale

  // Stockpile thresholds for physiological satisfaction
  STOCKPILE_SATISFIED: 50, // resources above this = fully satisfied
  STOCKPILE_CRITICAL: 10, // resources below this = unsatisfied
};
