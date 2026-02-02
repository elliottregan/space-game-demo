// src/core/systems/workforce/guildFormation.ts
import type { Colonist } from "../../models/Colonist.ts";
import { ColonistRole, MasteryLevel } from "../../models/Colonist.ts";
import { GuildType, GUILD_NAME_SUGGESTIONS } from "../../models/Guild.ts";
import { COHORT_WINDOW_SOLS } from "../../balance/WorkforceBalance.ts";
import { rng } from "../../utils/random.ts";

/**
 * Determine guild type based on founder characteristics.
 * Priority: Professional > Research > Social > Civic
 */
export function determineGuildType(founders: readonly Colonist[]): GuildType {
  // 1. Professional: all founders share the same role (excluding UNASSIGNED)
  const roles = founders.map((f) => f.role);
  const firstRole = roles[0];
  if (firstRole !== ColonistRole.UNASSIGNED && roles.every((r) => r === firstRole)) {
    return GuildType.PROFESSIONAL;
  }

  // 2. Research: average mastery >= SKILLED (1)
  const avgMastery = founders.reduce((sum, f) => sum + f.masteryLevel, 0) / founders.length;
  if (avgMastery >= MasteryLevel.SKILLED) {
    return GuildType.RESEARCH;
  }

  // 3. Social: founders share arrival cohort (within COHORT_WINDOW_SOLS)
  const arrivalSols = founders.map((f) => f.arrivalSol ?? 0);
  const minArrival = Math.min(...arrivalSols);
  const maxArrival = Math.max(...arrivalSols);
  if (maxArrival - minArrival <= COHORT_WINDOW_SOLS) {
    return GuildType.SOCIAL;
  }

  // 4. Civic: default fallback
  return GuildType.CIVIC;
}

/**
 * Generate a guild name, avoiding duplicates.
 * Appends " II", " III" etc. if all suggestions are used.
 */
export function generateGuildName(type: GuildType, usedNames: Set<string>): string {
  const suggestions = GUILD_NAME_SUGGESTIONS[type];

  // Try to find an unused name
  const shuffled = rng.shuffle([...suggestions]);
  for (const name of shuffled) {
    if (!usedNames.has(name)) {
      return name;
    }
  }

  // All names used, append suffix to first suggestion
  const baseName = suggestions[0];
  let suffix = 2;
  while (usedNames.has(`${baseName} ${toRoman(suffix)}`)) {
    suffix++;
  }
  return `${baseName} ${toRoman(suffix)}`;
}

/** Convert number to Roman numeral (simple version for II, III, IV, V) */
function toRoman(n: number): string {
  const numerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return numerals[n] ?? n.toString();
}
