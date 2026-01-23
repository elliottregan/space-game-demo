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
