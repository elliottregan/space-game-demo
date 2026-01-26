import type { Resources } from "../models/Resources";

export const COLONIST_NEEDS = {
  food: 0.5,
  oxygen: 0.3,
  water: 0.2,
  power: 0.1,
} as const;

export const STARTING_RESOURCES: Resources = {
  food: 300,
  oxygen: 250,
  water: 120,
  power: 500,
  materials: 500,
};

export const STARTING_POPULATION = 10;

export const POPULATION_GROWTH_RATE = 0.02;

export const MIN_POPULATION_FOR_GROWTH = 20;

// Colony morale and health thresholds
export const COLONY_MORALE = {
  BASE_DECAY: 0.3,
  BASE_RECOVERY: 0.5,
  HEALTH_RECOVERY: 0.2,
  LOW_WARNING_THRESHOLD: 30,
  GROWTH_REQUIREMENT: 60,
} as const;

export const COLONY_HEALTH = {
  GROWTH_REQUIREMENT: 80,
  LOW_WARNING_THRESHOLD: 50,
  DEATH_RISK_THRESHOLD: 20,
  DEATH_CHANCE: 0.05,
  MIN_POPULATION_FOR_DEATH: 5,
} as const;

// Resource shortage thresholds (multiplied by population)
export const SHORTAGE_THRESHOLDS = {
  FOOD_MULTIPLIER: 2,
  OXYGEN_MULTIPLIER: 2,
  FOOD_MORALE_PENALTY: 2,
  FOOD_HEALTH_PENALTY: 1,
  OXYGEN_HEALTH_PENALTY: 3,
} as const;
