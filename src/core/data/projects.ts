// Project / Crisis / Pattern types + lookup helpers.
// Keystone Projects are the per-Setting buildable outcomes (one per pattern);
// a ProjectUnlock records what was built; CrisisOutcome aggregates them at
// end-of-Epoch.

import type { Card, EffectSpec, Ideology } from "./cards.ts";
import { zeroIdeologyBreakdown } from "./ideologies.ts";

// -------------------------------------------------------------------------
// Pattern + Project + Crisis types
// -------------------------------------------------------------------------

export type PatternKind =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush"
  | "royal-flush";

export interface KeystoneProject {
  id: string;
  pattern: PatternKind;
  name: string;
  flavor: string;
  /** Contribution to the Crisis score when this project's pattern is built. */
  value: number;
  /** Optional one-shot or passive effect on unlock; semantics deferred. */
  unlockEffect?: EffectSpec;
}

export interface ProjectUnlock {
  projectId: string;
  pattern: PatternKind;
  turn: number;
  /** Snapshot of the built column at Build time (used for the unlock log). */
  cards: Card[];
}

export interface Crisis {
  id: string;
  name: string;
  flavor: string;
  difficulty: number;
}

export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  /** Ordered: four → flush → three → pair → high-card, then by turn. */
  contributingUnlocks: ProjectUnlock[];
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

export const PATTERNS_IN_ORDER: PatternKind[] = [
  "high-card",
  "pair",
  "two-pair",
  "three-of-a-kind",
  "straight",
  "flush",
  "full-house",
  "four-of-a-kind",
  "straight-flush",
  "royal-flush",
];

export const DEFAULT_PROJECT_VALUE: Record<PatternKind, number> = {
  "high-card": 1,
  pair: 2,
  "two-pair": 3,
  "three-of-a-kind": 4,
  straight: 5,
  flush: 6,
  "full-house": 7,
  "four-of-a-kind": 8,
  "straight-flush": 10,
  "royal-flush": 12,
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
  const out = zeroIdeologyBreakdown();
  for (const u of unlocks) {
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      out[c.ideology] += 1;
    }
  }
  return out;
}
