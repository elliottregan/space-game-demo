# Balance Constants

## Purpose

Centralized location for all tunable gameplay values. Changing these affects difficulty, pacing, and balance.

## Location

`src/core/balance/`

## Files

### EconomyBaseline.ts

```typescript
// src/core/balance/EconomyBaseline.ts

/**
 * Base consumption rates per colonist per sol
 */
export const COLONIST_NEEDS = {
  food: 0.5,
  oxygen: 0.3,
  water: 0.2,
  power: 0.1
} as const;

/**
 * Starting resources for new colony
 * Should last ~60 sols with starting population at zero production
 */
export const STARTING_RESOURCES = {
  food: 300,      // 60 sols for 10 colonists
  oxygen: 180,    // 60 sols for 10 colonists
  water: 120,     // 60 sols for 10 colonists
  power: 500,     // Buffer for construction
  materials: 500  // For initial buildings
} as const;

/**
 * Starting population
 */
export const STARTING_POPULATION = 10;

/**
 * Population growth rate (chance per sol if conditions met)
 */
export const POPULATION_GROWTH_RATE = 0.005; // 0.5% per sol

/**
 * Minimum population before growth can occur
 */
export const MIN_POPULATION_FOR_GROWTH = 20;
```

### WorkforceBalance.ts

```typescript
// src/core/balance/WorkforceBalance.ts

import { ColonistRole } from '../models/Colonist';

/**
 * Training times from unassigned to role
 */
export const BASE_TRAINING_TIME = {
  [ColonistRole.RESEARCH]: 5,
  [ColonistRole.ENGINEERING]: 5,
  [ColonistRole.CIVIL_SCIENCE]: 5,
  [ColonistRole.FARMING]: 5
} as const;

/**
 * Role affinities - how quickly can you retrain between roles?
 */
export const ROLE_AFFINITY: Record<ColonistRole, Partial<Record<ColonistRole, number>>> = {
  [ColonistRole.UNASSIGNED]: {
    [ColonistRole.RESEARCH]: 5,
    [ColonistRole.ENGINEERING]: 5,
    [ColonistRole.CIVIL_SCIENCE]: 5,
    [ColonistRole.FARMING]: 5
  },
  [ColonistRole.RESEARCH]: {
    [ColonistRole.CIVIL_SCIENCE]: 3,
    [ColonistRole.ENGINEERING]: 7,
    [ColonistRole.FARMING]: 10
  },
  [ColonistRole.ENGINEERING]: {
    [ColonistRole.FARMING]: 4,
    [ColonistRole.RESEARCH]: 7,
    [ColonistRole.CIVIL_SCIENCE]: 8
  },
  [ColonistRole.CIVIL_SCIENCE]: {
    [ColonistRole.RESEARCH]: 3,
    [ColonistRole.FARMING]: 8,
    [ColonistRole.ENGINEERING]: 8
  },
  [ColonistRole.FARMING]: {
    [ColonistRole.ENGINEERING]: 4,
    [ColonistRole.RESEARCH]: 10,
    [ColonistRole.CIVIL_SCIENCE]: 9
  }
} as const;

/**
 * Experience gain per sol when working
 */
export const EXPERIENCE_GAIN_RATE = 0.5;

/**
 * Mastery level thresholds
 */
export const MASTERY_THRESHOLDS = {
  NOVICE: 0,
  SKILLED: 25,
  EXPERT: 50,
  MASTER: 75
} as const;

/**
 * Efficiency multipliers by mastery level
 */
export const MASTERY_EFFICIENCY = {
  0: 0.7,   // Novice
  1: 1.0,   // Skilled
  2: 1.3,   // Expert
  3: 1.6    // Master
} as const;

/**
 * Master event chance per sol
 */
export const MASTER_EVENT_CHANCE = 0.01; // 1% per sol
```

### EventBalance.ts

```typescript
// src/core/balance/EventBalance.ts

/**
 * Event timing rules
 */
export const EVENT_TIMING = {
  minSolsBetween: 30,
  maxSolsBetween: 90,
  earlyGameCap: 100, // No major events before this sol
  
  getEventChance(currentSol: number): number {
    if (currentSol < 50) return 0.02;
    if (currentSol < 200) return 0.05;
    if (currentSol < 500) return 0.08;
    return 0.12;
  }
} as const;
```

### PoliticsBalance.ts

```typescript
// src/core/balance/PoliticsBalance.ts

/**
 * Support decay rate per sol
 */
export const SUPPORT_DECAY_RATE = 0.3;

/**
 * Support thresholds for events
 */
export const SUPPORT_THRESHOLDS = {
  UNREST: 20,
  HOSTILE: 10
} as const;
```

### ProgressionTargets.ts

```typescript
// src/core/balance/ProgressionTargets.ts

/**
 * Expected progression milestones for normal difficulty
 * Use these for playtesting validation
 */
export const PROGRESSION_TARGETS = {
  sol_50: {
    population: { min: 12, max: 15 },
    buildings: { min: 4, max: 6 },
    techs: { min: 1, max: 2 }
  },
  sol_100: {
    population: { min: 20, max: 30 },
    buildings: { min: 10, max: 15 },
    techs: { min: 3, max: 5 }
  },
  sol_200: {
    population: { min: 50, max: 80 },
    buildings: { min: 25, max: 35 },
    techs: { min: 8, max: 12 }
  },
  sol_400: {
    population: { min: 150, max: 300 },
    buildings: { min: 50, max: 80 },
    techs: { min: 15, max: 18 }
  }
} as const;
```

## Usage

```typescript
import { COLONIST_NEEDS, STARTING_RESOURCES } from './balance/EconomyBaseline';
import { ROLE_AFFINITY } from './balance/WorkforceBalance';

// Calculate consumption
const consumption = population * COLONIST_NEEDS.food;

// Check training time
const trainingTime = ROLE_AFFINITY[currentRole][targetRole] || 10;
```

## Tuning Guide

### Making Game Easier
- Increase STARTING_RESOURCES
- Decrease COLONIST_NEEDS
- Decrease BASE_TRAINING_TIME
- Increase MASTERY_EFFICIENCY

### Making Game Harder
- Decrease STARTING_RESOURCES
- Increase COLONIST_NEEDS
- Increase SUPPORT_DECAY_RATE
- Decrease EXPERIENCE_GAIN_RATE

### Adjusting Pacing
- Change PROGRESSION_TARGETS to aim for different timelines
- Modify tech research times in technologies.ts
- Adjust building construction times in buildings.ts
