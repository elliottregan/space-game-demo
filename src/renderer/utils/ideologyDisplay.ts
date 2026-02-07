// src/renderer/utils/ideologyDisplay.ts
/**
 * Unified model for displaying colonist ideology in the UI.
 * This is the single source of truth for:
 * - Faction types and identifiers
 * - Color mappings (CSS variables and hex fallbacks)
 * - Display names (short and full)
 * - Dominant faction calculation
 */

import type { ColonistIdeology } from "../../core/models/Colonist";
import { NPCFaction } from "../../core/models/NPCInfluence";
import { NEUTRAL_AXIS_THRESHOLD } from "../../core/balance/IdeologyBalance";

// ============ Faction Types ============

/**
 * Faction identifiers for UI display.
 * "neutral" indicates no dominant faction.
 */
export type FactionId = "earth" | "mars" | "corporate" | "neutral";

// ============ Color Mappings ============

/**
 * CSS variable names for faction colors.
 * These reference the theme's semantic colors.
 */
export const FACTION_CSS_VARS: Record<FactionId, string> = {
  earth: "var(--g-color-info)", // Blue/Teal
  mars: "var(--g-color-positive)", // Green
  corporate: "var(--g-color-warning)", // Orange
  neutral: "var(--g-color-text-muted)", // Gray
} as const;

/**
 * Hex fallback colors for contexts where CSS variables aren't available
 * (e.g., D3/canvas rendering before CSS is computed).
 */
export const FACTION_HEX_COLORS: Record<FactionId, string> = {
  earth: "#00838f", // Teal
  mars: "#2e7d32", // Green
  corporate: "#ef6c00", // Orange
  neutral: "#888888", // Gray
} as const;

// ============ Display Names ============

/**
 * Short faction names for compact UI (badges, labels).
 */
export const FACTION_SHORT_NAMES: Record<FactionId, string> = {
  earth: "Earth",
  mars: "Mars",
  corporate: "Corp",
  neutral: "Neutral",
} as const;

/**
 * Full faction names for detailed display.
 */
export const FACTION_FULL_NAMES: Record<FactionId, string> = {
  earth: "Earth Loyalists",
  mars: "Mars Independence",
  corporate: "Corporate Interests",
  neutral: "Neutral",
} as const;

// ============ Dominant Faction Calculation ============

/**
 * Threshold for determining dominant faction.
 * Uses the core balance constant for consistency with game logic.
 */
export const DOMINANT_FACTION_THRESHOLD = NEUTRAL_AXIS_THRESHOLD;

/**
 * Get the dominant faction for a colonist based on their ideology.
 *
 * Returns "neutral" if:
 * - Ideology is undefined/null
 * - All affinities are below the threshold
 * - Multiple factions are tied for highest (edge case)
 *
 * @param ideology - The colonist's ideology values
 * @returns The faction ID of the dominant faction, or "neutral"
 */
export function getDominantFaction(ideology: ColonistIdeology | undefined | null): FactionId {
  if (!ideology) return "neutral";

  const { earthLoyalist, marsIndependence, corporateInterests } = ideology;
  const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);

  // If all affinities are below threshold, consider neutral
  if (max < DOMINANT_FACTION_THRESHOLD) return "neutral";

  // Return the faction with highest affinity
  // In case of ties, preference order: earth > mars > corporate
  if (earthLoyalist === max) return "earth";
  if (marsIndependence === max) return "mars";
  if (corporateInterests === max) return "corporate";

  return "neutral";
}

/**
 * Get the dominant faction info including color and name.
 * Returns null if the colonist is neutral (no strong affiliation).
 *
 * @param ideology - The colonist's ideology values
 * @returns Faction info object or null if neutral
 */
export function getDominantFactionInfo(
  ideology: ColonistIdeology | undefined | null,
): { faction: FactionId; color: string; name: string } | null {
  const faction = getDominantFaction(ideology);
  if (faction === "neutral") return null;

  return {
    faction,
    color: FACTION_CSS_VARS[faction],
    name: FACTION_SHORT_NAMES[faction],
  };
}

// ============ Color Helpers ============

/**
 * Get the CSS color variable for a faction.
 * @param faction - The faction ID
 * @returns CSS variable string (e.g., "var(--g-color-info)")
 */
export function getFactionCssColor(faction: FactionId): string {
  return FACTION_CSS_VARS[faction];
}

/**
 * Get the hex color for a faction (for D3/canvas contexts).
 * @param faction - The faction ID
 * @returns Hex color string (e.g., "#00838f")
 */
export function getFactionHexColor(faction: FactionId): string {
  return FACTION_HEX_COLORS[faction];
}

/**
 * Get faction color from theme colors object (for D3 rendering).
 * @param faction - The faction ID
 * @param colors - Theme colors object with info, positive, warning, textMuted
 * @returns The appropriate color from the theme
 */
export function getFactionColorFromTheme(
  faction: FactionId,
  colors: { info: string; positive: string; warning: string; textMuted: string },
): string {
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

// ============ Ideology Color for Graph Rendering ============

/**
 * Get the ideology color for graph node rendering.
 * Uses a more nuanced approach with dominance threshold for clear visual distinction.
 *
 * @param ideology - The colonist's ideology values
 * @param colors - Theme colors object
 * @param dominanceThreshold - How much the highest must exceed others (default: 0.15)
 * @returns The color to use for the colonist node
 */
export function getIdeologyColorForGraph(
  ideology: ColonistIdeology | undefined | null,
  colors: { info: string; positive: string; warning: string; textMuted: string },
  dominanceThreshold: number = 0.15,
): string {
  if (!ideology) return colors.textMuted;

  const { earthLoyalist, marsIndependence, corporateInterests } = ideology;
  const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);

  // If all values are very low, show as neutral
  if (max < 0.2) return colors.textMuted;

  // Check for clear dominance (must exceed others by threshold)
  if (
    earthLoyalist >= max - 0.01 &&
    earthLoyalist - marsIndependence >= dominanceThreshold &&
    earthLoyalist - corporateInterests >= dominanceThreshold
  ) {
    return colors.info;
  }
  if (
    marsIndependence >= max - 0.01 &&
    marsIndependence - earthLoyalist >= dominanceThreshold &&
    marsIndependence - corporateInterests >= dominanceThreshold
  ) {
    return colors.positive;
  }
  if (
    corporateInterests >= max - 0.01 &&
    corporateInterests - earthLoyalist >= dominanceThreshold &&
    corporateInterests - marsIndependence >= dominanceThreshold
  ) {
    return colors.warning;
  }

  // Mixed ideology - use neutral
  return colors.textMuted;
}

// ============ NPCFaction Conversion ============

/**
 * Convert NPCFaction enum to FactionId for UI display.
 * @param faction - The NPCFaction enum value
 * @returns The corresponding FactionId
 */
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

/**
 * Convert FactionId to NPCFaction enum for game logic.
 * @param factionId - The FactionId (must not be "neutral")
 * @returns The corresponding NPCFaction
 * @throws Error if factionId is "neutral"
 */
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
