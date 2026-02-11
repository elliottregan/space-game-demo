// src/core/balance/EarthCrisisBalance.ts

import type { CrisisThreshold } from "../models/EarthCrisis.js";

export const EARTH_CRISIS_BALANCE = {
  severityPerSol: 0.08, // ~1250 sols to reach 100%
  startingSeverity: 0,
} as const;

export const EARTH_CRISIS_THRESHOLDS: CrisisThreshold[] = [
  {
    severity: 25,
    effects: [{ type: "refugee_wave", params: { count: 2 } }],
    repeatable: true,
    repeatInterval: 100,
  },
  {
    severity: 50,
    effects: [{ type: "refugee_wave", params: { count: 2 } }],
    repeatable: true,
    repeatInterval: 100,
  },
  {
    severity: 75,
    effects: [{ type: "refugee_wave", params: { count: 3 } }],
    repeatable: true,
    repeatInterval: 75,
  },
  {
    severity: 100,
    effects: [], // Earth goes dark - handled specially
    repeatable: false,
  },
];

// Refugee ideology distribution (Earth Loyalist bias)
export const REFUGEE_IDEOLOGY = {
  earthLoyalistWeight: 0.6,
  neutralWeight: 0.25,
  otherWeight: 0.15,
  baseMorale: 0.7, // 70% of normal starting morale
} as const;
