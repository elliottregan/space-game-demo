import type { Resources } from "../models/Resources";

export const COLONIST_NEEDS = {
  food: 0.5,
  oxygen: 0.3,
  water: 0.2,
  power: 0.1,
} as const;

export const STARTING_RESOURCES: Resources = {
  food: 300,
  oxygen: 180,
  water: 120,
  power: 500,
  materials: 500,
};

export const STARTING_POPULATION = 10;

export const POPULATION_GROWTH_RATE = 0.02;

export const MIN_POPULATION_FOR_GROWTH = 20;
