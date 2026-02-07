// src/core/data/factionNames.ts

import type { NPCFaction, AxisPosition } from "../models/NPCInfluence.js";
import {
  FACTION_NAME_THRESHOLD_MODERATE,
  FACTION_NAME_THRESHOLD_EXTREME,
} from "../balance/IdeologyBalance.js";

type AxisLevel = "high" | "veryHigh" | "low" | "veryLow";

interface FactionNameRule {
  conditions: Partial<Record<keyof AxisPosition, AxisLevel>>;
  name: string;
}

interface FactionNameEntry {
  baseId: NPCFaction;
  defaultName: string;
  /** Ordered from most specific (more axes) to least specific. First match wins. */
  rules: FactionNameRule[];
}

/**
 * Check whether an axis value satisfies a given level condition.
 */
function matchesLevel(value: number, level: AxisLevel): boolean {
  switch (level) {
    case "veryHigh":
      return value >= FACTION_NAME_THRESHOLD_EXTREME;
    case "high":
      return value >= FACTION_NAME_THRESHOLD_MODERATE;
    case "veryLow":
      return value <= -FACTION_NAME_THRESHOLD_EXTREME;
    case "low":
      return value <= -FACTION_NAME_THRESHOLD_MODERATE;
  }
}

/**
 * Name table for each base faction.
 * Rules are ordered from most specific (most axis conditions) to least specific.
 * The first matching rule wins.
 */
const FACTION_NAME_TABLE: FactionNameEntry[] = [
  {
    baseId: "earth_loyalists" as NPCFaction,
    defaultName: "Earth Loyalists",
    rules: [
      // 3-axis: Earth-tied + Collectivist + Preservationist
      {
        conditions: { sovereignty: "low", solidarity: "high", transformation: "low" },
        name: "Terran Heritage Compact",
      },
      // 3-axis: Earth-tied + Individualist + Revolutionary
      {
        conditions: { sovereignty: "low", solidarity: "low", transformation: "high" },
        name: "New Earth Vanguard",
      },
      // 2-axis: Mars-sovereign + Preservationist
      {
        conditions: { sovereignty: "high", transformation: "low" },
        name: "Founders' Covenant",
      },
      // 1-axis: Collectivist
      {
        conditions: { solidarity: "high" },
        name: "Earth Unity Front",
      },
      // 1-axis: Individualist
      {
        conditions: { solidarity: "low" },
        name: "Colonial Enterprise League",
      },
    ],
  },
  {
    baseId: "mars_independence" as NPCFaction,
    defaultName: "Mars Independence",
    rules: [
      // 2-axis: Mars-sovereign + Revolutionary
      {
        conditions: { sovereignty: "high", transformation: "high" },
        name: "Ares Ascendancy",
      },
      // 3-axis: Mars-sovereign + Collectivist + Preservationist
      {
        conditions: { sovereignty: "high", solidarity: "high", transformation: "low" },
        name: "Mars People's Front",
      },
      // 2-axis: Individualist + Revolutionary
      {
        conditions: { solidarity: "low", transformation: "high" },
        name: "Red Frontier",
      },
      // 1-axis: Collectivist
      {
        conditions: { solidarity: "high" },
        name: "Mars Solidarity Movement",
      },
    ],
  },
  {
    baseId: "corporate_interests" as NPCFaction,
    defaultName: "Corporate Interests",
    rules: [
      // 2-axis: Individualist + Revolutionary
      {
        conditions: { solidarity: "low", transformation: "high" },
        name: "Frontier Syndicate",
      },
      // 2-axis: Preservationist + Individualist
      {
        conditions: { transformation: "low", solidarity: "low" },
        name: "Old Guard Consortium",
      },
      // 1-axis: Collectivist
      {
        conditions: { solidarity: "high" },
        name: "Common Futures Initiative",
      },
      // 1-axis: Mars-sovereign
      {
        conditions: { sovereignty: "high" },
        name: "Martian Trade Alliance",
      },
    ],
  },
];

/**
 * Count the number of axis conditions in a rule for specificity sorting.
 */
function conditionCount(conditions: Partial<Record<keyof AxisPosition, AxisLevel>>): number {
  return Object.keys(conditions).length;
}

// Pre-sort each faction's rules by specificity (most conditions first).
// This is a safety net -- the table above is already manually ordered,
// but the sort ensures correctness even if entries are reordered.
for (const entry of FACTION_NAME_TABLE) {
  entry.rules.sort((a, b) => conditionCount(b.conditions) - conditionCount(a.conditions));
}

/**
 * Get the dynamic display name for a faction based on its current axis position.
 * Evaluates rules from most specific to least specific; first match wins.
 * Returns the default name if no conditions are met.
 */
export function getFactionName(baseId: NPCFaction, position: AxisPosition): string {
  const entry = FACTION_NAME_TABLE.find((e) => e.baseId === baseId);
  if (!entry) return baseId;

  for (const rule of entry.rules) {
    const axes = Object.keys(rule.conditions) as (keyof AxisPosition)[];
    const allMatch = axes.every((axis) => matchesLevel(position[axis], rule.conditions[axis]!));
    if (allMatch) {
      return rule.name;
    }
  }

  return entry.defaultName;
}
