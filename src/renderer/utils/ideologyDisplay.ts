// src/renderer/utils/ideologyDisplay.ts
/**
 * Display utilities for ideology axes and political factions.
 *
 * These are distinct concepts:
 * - Axes (solidarity, sovereignty, transformation) are ideology dimensions (-1 to +1)
 * - Factions (earth, mars, corporate) are political groups with positions in axis space
 *
 * A colonist's dominant axis is NOT the same as their faction affiliation.
 * Faction affiliation is determined by 3D distance to faction positions (see IdeologyManager).
 */

import type { ColonistIdeology } from "../../core/models/Colonist";
import type { AxisPosition } from "../../core/models/NPCInfluence";
import { NPCFaction } from "../../core/models/NPCInfluence";

// ============ Axis Types & Display ============

export type AxisId = "solidarity" | "sovereignty" | "transformation";

/** Hex colors for each ideology axis (for D3/canvas rendering) */
export const AXIS_HEX_COLORS: Record<AxisId, string> = {
  solidarity: "#00838f", // Teal
  sovereignty: "#2e7d32", // Green
  transformation: "#ef6c00", // Orange
} as const;

const AXIS_THEME_MAP: Record<AxisId, "info" | "positive" | "warning"> = {
  solidarity: "info",
  sovereignty: "positive",
  transformation: "warning",
} as const;

type ThemeColors = { info: string; positive: string; warning: string; textMuted: string };

/**
 * Get the dominant ideology axis from axis values.
 * Returns null if no axis value meets the threshold.
 */
export function getDominantAxis(
  values: AxisPosition | ColonistIdeology | undefined | null,
  threshold: number = 0.15,
): AxisId | null {
  if (!values) return null;
  const { solidarity, sovereignty, transformation } = values;
  const max = Math.max(solidarity, sovereignty, transformation);
  if (max < threshold) return null;
  if (solidarity === max) return "solidarity";
  if (sovereignty === max) return "sovereignty";
  return "transformation";
}

/**
 * Get the hex color for the dominant axis (for radar/chart fills).
 */
export function getDominantAxisHexColor(
  values: AxisPosition | ColonistIdeology | undefined | null,
): string {
  const axis = getDominantAxis(values);
  return axis ? AXIS_HEX_COLORS[axis] : "#888888";
}

/**
 * Get axis color from a theme colors object.
 */
export function getAxisColorFromTheme(axis: AxisId, colors: ThemeColors): string {
  return colors[AXIS_THEME_MAP[axis]];
}

/**
 * Get ideology color for graph node rendering.
 * Colors by dominant axis with a dominance threshold for clear visual distinction.
 */
export function getIdeologyColorForGraph(
  ideology: ColonistIdeology | undefined | null,
  colors: ThemeColors,
  dominanceThreshold: number = 0.15,
): string {
  if (!ideology) return colors.textMuted;

  const { solidarity, sovereignty, transformation } = ideology;
  const max = Math.max(solidarity, sovereignty, transformation);

  if (max < 0.1) return colors.textMuted;

  // Check for clear dominance on each axis (must exceed others by threshold)
  if (
    solidarity >= max - 0.01 &&
    solidarity - sovereignty >= dominanceThreshold &&
    solidarity - transformation >= dominanceThreshold
  ) {
    return colors.info;
  }
  if (
    sovereignty >= max - 0.01 &&
    sovereignty - solidarity >= dominanceThreshold &&
    sovereignty - transformation >= dominanceThreshold
  ) {
    return colors.positive;
  }
  if (
    transformation >= max - 0.01 &&
    transformation - solidarity >= dominanceThreshold &&
    transformation - sovereignty >= dominanceThreshold
  ) {
    return colors.warning;
  }

  // Mixed ideology
  return colors.textMuted;
}

// ============ Faction Types & Display ============

/**
 * Faction identifiers for UI display.
 * "neutral" indicates no dominant faction.
 */
export type FactionId = "earth" | "mars" | "corporate" | "neutral";

export const FACTION_CSS_VARS: Record<FactionId, string> = {
  earth: "var(--g-color-info)",
  mars: "var(--g-color-positive)",
  corporate: "var(--g-color-warning)",
  neutral: "var(--g-color-text-muted)",
} as const;

export const FACTION_HEX_COLORS: Record<FactionId, string> = {
  earth: "#00838f",
  mars: "#2e7d32",
  corporate: "#ef6c00",
  neutral: "#888888",
} as const;

export const FACTION_SHORT_NAMES: Record<FactionId, string> = {
  earth: "Earth",
  mars: "Mars",
  corporate: "Corp",
  neutral: "Neutral",
} as const;

export const FACTION_FULL_NAMES: Record<FactionId, string> = {
  earth: "Earth Loyalists",
  mars: "Mars Independence",
  corporate: "Corporate Interests",
  neutral: "Neutral",
} as const;

export function getFactionCssColor(faction: FactionId): string {
  return FACTION_CSS_VARS[faction];
}

export function getFactionHexColor(faction: FactionId): string {
  return FACTION_HEX_COLORS[faction];
}

export function getFactionColorFromTheme(faction: FactionId, colors: ThemeColors): string {
  switch (faction) {
    case "earth":
      return colors.info;
    case "mars":
      return colors.positive;
    case "corporate":
      return colors.warning;
    case "neutral":
    default:
      return colors.textMuted;
  }
}

// ============ NPCFaction Conversion ============

export function npcFactionToFactionId(faction: NPCFaction): Exclude<FactionId, "neutral"> {
  switch (faction) {
    case NPCFaction.EarthLoyalists:
      return "earth";
    case NPCFaction.MarsIndependence:
      return "mars";
    case NPCFaction.CorporateInterests:
      return "corporate";
  }
}

export function factionIdToNpcFaction(factionId: FactionId): NPCFaction {
  switch (factionId) {
    case "earth":
      return NPCFaction.EarthLoyalists;
    case "mars":
      return NPCFaction.MarsIndependence;
    case "corporate":
      return NPCFaction.CorporateInterests;
    case "neutral":
      throw new Error("Cannot convert 'neutral' to NPCFaction");
  }
}
