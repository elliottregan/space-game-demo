import { ColonistRole } from "../models/Colonist";

export const BASE_TRAINING_TIME: Record<ColonistRole, number> = {
  [ColonistRole.UNASSIGNED]: 0,
  [ColonistRole.RESEARCH]: 5,
  [ColonistRole.ENGINEERING]: 5,
  [ColonistRole.CIVIL_SCIENCE]: 5,
  [ColonistRole.FARMING]: 5,
};

export const ROLE_AFFINITY: Record<ColonistRole, Partial<Record<ColonistRole, number>>> = {
  [ColonistRole.UNASSIGNED]: {
    [ColonistRole.RESEARCH]: 5,
    [ColonistRole.ENGINEERING]: 5,
    [ColonistRole.CIVIL_SCIENCE]: 5,
    [ColonistRole.FARMING]: 5,
  },
  [ColonistRole.RESEARCH]: {
    [ColonistRole.CIVIL_SCIENCE]: 3,
    [ColonistRole.ENGINEERING]: 7,
    [ColonistRole.FARMING]: 10,
  },
  [ColonistRole.ENGINEERING]: {
    [ColonistRole.FARMING]: 4,
    [ColonistRole.RESEARCH]: 7,
    [ColonistRole.CIVIL_SCIENCE]: 8,
  },
  [ColonistRole.CIVIL_SCIENCE]: {
    [ColonistRole.RESEARCH]: 3,
    [ColonistRole.FARMING]: 8,
    [ColonistRole.ENGINEERING]: 8,
  },
  [ColonistRole.FARMING]: {
    [ColonistRole.ENGINEERING]: 4,
    [ColonistRole.RESEARCH]: 10,
    [ColonistRole.CIVIL_SCIENCE]: 9,
  },
};

export const EXPERIENCE_GAIN_RATE = 0.5;

export const MASTERY_THRESHOLDS = {
  NOVICE: 0,
  SKILLED: 25,
  EXPERT: 50,
  MASTER: 75,
} as const;

export const MASTERY_EFFICIENCY: Record<number, number> = {
  0: 0.7,
  1: 1.0,
  2: 1.3,
  3: 1.6,
};

export const MASTER_EVENT_CHANCE = 0.01;

/** Maximum total efficiency bonus from skills */
export const MAX_SKILL_EFFICIENCY_BONUS = 0.2;

/** Number of skills assigned to each colonist (min, max) */
export const COLONIST_SKILL_COUNT = { min: 1, max: 2 };

// Job assignment system constants
export const ROLE_MISMATCH_PENALTY = 0.3; // 30% efficiency penalty
export const TRAINING_WORK_PENALTY = 0.5; // 50% efficiency while training
export const LABOR_POOL_BONUS_PER_COLONIST = 0.02; // +2% construction speed
export const LABOR_POOL_BONUS_CAP = 0.2; // +20% max
export const STAFFING_CURVE_EXPONENT = 1.5; // Diminishing returns curve

// ============ Coworker Relationship System ============

/** Amount relationship strength increases per sol when colonists work together */
export const COWORKER_BONDING_RATE = 0.01;

/** Maximum relationship strength between coworkers */
export const MAX_COWORKER_RELATIONSHIP = 1.0;

/** Minimum relationship strength (floor for coworkers who have worked together) */
export const MIN_COWORKER_RELATIONSHIP = 0.05;

/** Decay rate for coworker relationships when not working together */
export const COWORKER_RELATIONSHIP_DECAY = 0.002;

/** Maximum team cohesion bonus to building efficiency */
export const MAX_TEAM_COHESION_BONUS = 0.15; // +15% max

/** Minimum average relationship strength needed for any team bonus */
export const TEAM_COHESION_THRESHOLD = 0.2;

/** Initial relationship strength when colonists first work together */
export const INITIAL_COWORKER_RELATIONSHIP = 0.1;

// ============ Housemate Relationship System ============

/** Amount relationship strength increases per sol when colonists share housing */
export const HOUSEMATE_BONDING_RATE = 0.015;

/** Initial relationship strength when colonists first share housing */
export const INITIAL_HOUSEMATE_RELATIONSHIP = 0.15;
