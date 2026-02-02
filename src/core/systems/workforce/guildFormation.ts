// src/core/systems/workforce/guildFormation.ts
import type { Colonist } from "../../models/Colonist.ts";
import { ColonistRole, MasteryLevel } from "../../models/Colonist.ts";
import { GuildType, GUILD_NAME_SUGGESTIONS } from "../../models/Guild.ts";
import { COHORT_WINDOW_SOLS, MAX_GUILD_MEMBERSHIPS } from "../../balance/WorkforceBalance.ts";
import { rng } from "../../utils/random.ts";
import type { CoworkerRelationship } from "./types.ts";

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

/**
 * Find groups of colonists eligible to form a guild.
 * Returns array of colonist ID arrays (founder groups).
 */
export function findEligibleFounderGroups(
  colonists: readonly Colonist[],
  relationships: Map<string, CoworkerRelationship>,
  threshold: number,
): string[][] {
  // Filter to eligible colonists (not at max memberships)
  const eligible = colonists.filter((c) => (c.guildIds?.length ?? 0) < MAX_GUILD_MEMBERSHIPS);

  if (eligible.length < 2) return [];

  // Build adjacency list of strong relationships
  const strongEdges = new Map<string, Set<string>>();

  for (const colonist of eligible) {
    strongEdges.set(colonist.id, new Set());
  }

  for (const [key, rel] of relationships) {
    if (rel.strength < threshold) continue;

    const [id1, id2] = key.split(":");
    if (!id1 || !id2) continue;

    // Both must be eligible
    const c1 = eligible.find((c) => c.id === id1);
    const c2 = eligible.find((c) => c.id === id2);
    if (!c1 || !c2) continue;

    // Skip if they already share a guild
    if (sharesGuild(c1, c2)) continue;

    strongEdges.get(id1)?.add(id2);
    strongEdges.get(id2)?.add(id1);
  }

  // Find connected components using BFS
  const visited = new Set<string>();
  const groups: string[][] = [];

  for (const colonist of eligible) {
    if (visited.has(colonist.id)) continue;

    const neighbors = strongEdges.get(colonist.id);
    if (!neighbors || neighbors.size === 0) continue;

    // BFS to find connected component
    const component: string[] = [];
    const queue = [colonist.id];

    while (queue.length > 0 && component.length < 4) {
      const current = queue.shift();
      if (current === undefined || visited.has(current)) continue;

      visited.add(current);
      component.push(current);

      const currentNeighbors = strongEdges.get(current);
      if (currentNeighbors) {
        for (const neighbor of currentNeighbors) {
          if (!visited.has(neighbor) && component.length < 4) {
            queue.push(neighbor);
          }
        }
      }
    }

    if (component.length >= 2) {
      groups.push(component);
    }
  }

  return groups;
}

/** Check if two colonists share any guild */
function sharesGuild(c1: Colonist, c2: Colonist): boolean {
  if (!c1.guildIds?.length || !c2.guildIds?.length) return false;
  return c1.guildIds.some((gId) => c2.guildIds?.includes(gId));
}

/**
 * Calculate probability of guild formation based on founder memberships.
 * Each existing membership multiplies probability by penalty factor.
 */
export function calculateFormationProbability(
  founders: readonly Colonist[],
  baseProbability: number,
  membershipPenalty: number,
): number {
  let probability = baseProbability;

  for (const founder of founders) {
    const membershipCount = founder.guildIds?.length ?? 0;
    probability *= Math.pow(membershipPenalty, membershipCount);
  }

  return probability;
}
