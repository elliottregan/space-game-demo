// Helpers for KeystoneProject lookup, ordering, and ideology aggregation.

import type { Ideology, KeystoneProject, PatternKind, ProjectUnlock } from "./types.ts";

export const PATTERNS_IN_ORDER: PatternKind[] = [
  "high-card",
  "pair",
  "three-of-a-kind",
  "flush",
  "four-of-a-kind",
];

export const DEFAULT_PROJECT_VALUE: Record<PatternKind, number> = {
  "high-card": 1,
  pair: 2,
  "three-of-a-kind": 4,
  flush: 5,
  "four-of-a-kind": 8,
};

export function reversePatternOrder(): PatternKind[] {
  return [...PATTERNS_IN_ORDER].reverse();
}

export function getProjectForPattern(
  projects: KeystoneProject[],
  pattern: PatternKind,
): KeystoneProject | null {
  return projects.find((p) => p.pattern === pattern) ?? null;
}

export function unlockedIdeologyBreakdown(unlocks: ProjectUnlock[]): Record<Ideology, number> {
  const out: Record<Ideology, number> = {
    solidarity: 0,
    sovereignty: 0,
    transformation: 0,
    heritage: 0,
  };
  for (const u of unlocks) {
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      out[c.ideology] += 1;
    }
  }
  return out;
}
