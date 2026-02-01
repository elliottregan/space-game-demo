// src/visualization/formatters.ts
// Formatting utilities for display strings

/**
 * Format filename for display.
 * simulation-2026-01-27T08-12-40-r200-s1.json -> 2026-01-27 08:12 (200 runs, seed 1)
 */
export function formatFilename(filename: string): string {
  const match = filename.match(
    /(?:simulation|analysis)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-\d{2}-r(\d+)-s(\d+)/,
  );
  if (match) {
    const [, date, hour, minute, runs, seed] = match;
    return `${date} ${hour}:${minute} (${runs} runs, seed ${seed})`;
  }
  return filename;
}

/**
 * Format tech name for display.
 * advanced_life_support -> Advanced Life Support
 */
export function formatTechName(tech: string): string {
  return tech
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format building name for display.
 * solar_panel -> Solar Panel
 */
export function formatBuildingName(building: string): string {
  return building
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format event name for display.
 * dust_storm_warning -> Dust Storm Warning
 */
export function formatEventName(eventId: string): string {
  return eventId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format crisis type for display.
 */
export function formatCrisisType(type: string): string {
  const labels: Record<string, string> = {
    low_food: "Low Food",
    low_oxygen: "Low Oxygen",
    low_water: "Low Water",
    low_morale: "Low Morale",
    low_cohesion: "Low Cohesion",
    population_drop: "Population Drop",
  };
  return labels[type] ?? type;
}

/**
 * Get correlation strength description.
 */
export function getCorrelationStrength(r: number): string {
  const abs = Math.abs(r);
  if (abs > 0.5) return "Strong";
  if (abs > 0.3) return "Moderate";
  if (abs > 0.1) return "Weak";
  return "None";
}
