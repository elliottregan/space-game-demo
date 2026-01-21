// src/core/balance/OperationsBalance.ts

// Building Mode Multipliers
export const BUILDING_MODES = {
  conservation: { production: 0.5, consumption: 0.4 },
  normal: { production: 1.0, consumption: 1.0 },
  overdrive: { production: 1.5, consumption: 2.0, moralePenalty: 0.5, breakdownChance: 0.02 },
} as const;

export const REPAIR_COST_MULTIPLIER = 0.25;
export const REPAIR_DURATION_SOLS = 3;

// Policy Effects
export const WORK_INTENSITY = {
  relaxed: { productionMult: 0.8, moralePerSol: 1 },
  standard: { productionMult: 1.0, moralePerSol: 0 },
  crunch: { productionMult: 1.2, moralePerSol: -1, healthPerSol: -0.5 },
} as const;

export const RESOURCE_PRIORITY = {
  stockpile: { productionMult: 0.9 },
  balanced: { productionMult: 1.0 },
  burn: { productionMult: 1.15, decayRate: 0.05 },
} as const;

export const EXPLORATION_STANCE = {
  cautious: { costMult: 1.5, successMod: 0.2 },
  standard: { costMult: 1.0, successMod: 0 },
  aggressive: { costMult: 0.75, successMod: -0.15 },
} as const;

export const POLICY_CHANGE_COOLDOWN_SOLS = 10;

// Expedition Definitions
export const EXPEDITIONS = {
  survey: { crew: 2, materials: 20, duration: 10, baseSuccess: 0.7 },
  salvage: { crew: 3, materials: 30, duration: 15, baseSuccess: 0.65 },
  science: { crew: 2, materials: 50, duration: 25, baseSuccess: 0.6 },
  deep: { crew: 4, materials: 100, duration: 40, baseSuccess: 0.5 },
} as const;

export const MAX_CONCURRENT_EXPEDITIONS = 2;
export const EXPEDITION_EXPERIENCE_BONUS = 0.05;
export const EXPEDITION_EXPERIENCE_CAP = 0.2;

// Prospecting
export const PROSPECTING_REVEAL_COST = { materials: 30, duration: 5 };
export const PROSPECTING_QUALITY = {
  poor: { developCost: 50, bonus: 0.1 },
  moderate: { developCost: 100, bonus: 0.25 },
  rich: { developCost: 200, bonus: 0.5 },
} as const;

export const MAX_REVEALED_SITES = 3;
export const MAX_DEVELOPED_SITES = 5;
