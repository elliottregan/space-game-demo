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

// Deposit Reserves by Quality and Resource Type
export const DEPOSIT_RESERVES = {
  materials: {
    poor: { min: 200, max: 400 },
    moderate: { min: 400, max: 800 },
    rich: { min: 800, max: 1500 },
  },
  water: {
    poor: { min: 150, max: 300 },
    moderate: { min: 300, max: 600 },
    rich: { min: 600, max: 1000 },
  },
  research: {
    poor: { min: 50, max: 100 },
    moderate: { min: 100, max: 200 },
    rich: { min: 200, max: 400 },
  },
} as const;

// Extraction rate multipliers per quality
export const EXTRACTION_RATE_MULTIPLIERS = {
  poor: 0.5,
  moderate: 1.0,
  rich: 1.5,
} as const;

// Estimate uncertainty (as fraction of actual) at extraction thresholds
export const ESTIMATE_UNCERTAINTY = {
  initial: 0.3,      // ±30% at start
  at25Percent: 0.2,  // ±20% after 25% extracted
  at50Percent: 0.1,  // ±10% after 50% extracted
  at75Percent: 0.05, // ±5% after 75% extracted
} as const;

// Depletion warning thresholds
export const DEPLETION_THRESHOLDS = {
  warning: 0.25,     // 25% remaining
  critical: 0.10,    // 10% remaining
} as const;

// Recycling Recovery Rates (fraction of original build cost)
export const RECYCLING_RECOVERY_RATES = {
  standard: 0.4,    // Normal buildings
  depleted: 0.25,   // Mining buildings on depleted deposits
  active: 0.5,      // Mining buildings still producing
  damaged: 0.15,    // Broken buildings
} as const;

// Recycling takes this fraction of original construction time
export const RECYCLING_TIME_MULTIPLIER = 0.25;

// Rush recycling reduces materials recovered by this amount
export const RUSH_RECYCLING_PENALTY = 0.3;

// Repurposing costs this fraction of the NEW building's materials
export const REPURPOSE_COST_MULTIPLIER = 0.3;

// Repurposing takes this fraction of the NEW building's construction time
export const REPURPOSE_TIME_MULTIPLIER = 0.5;
