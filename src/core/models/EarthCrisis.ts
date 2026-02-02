// src/core/models/EarthCrisis.ts

export interface EarthClimateCrisis {
  severity: number; // 0-100, increases over time
  pointOfNoReturn: boolean; // True when severity hits 100
}

// Flexible effect system - expandable for future effects
export type CrisisEffectType = "refugee_wave" | "political_instability"; // Scaffolded, not implemented

export interface CrisisEffect {
  type: CrisisEffectType;
  params: Record<string, unknown>;
}

export interface CrisisThreshold {
  severity: number; // Trigger at this percentage
  effects: CrisisEffect[];
  repeatable: boolean;
  repeatInterval?: number; // Sols between repeats (if repeatable)
}

export interface RefugeeWaveParams {
  count: number;
}
