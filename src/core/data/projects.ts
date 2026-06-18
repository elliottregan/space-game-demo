// Project / Crisis / Pattern types + lookup helpers.
// Keystone Projects are the per-Setting buildable outcomes (one per pattern);
// a ProjectUnlock records what was built; CrisisOutcome aggregates them at
// end-of-Epoch.

import type { Card, EffectSpec, Ideology } from "./cards.ts";
import { zeroIdeologyBreakdown } from "./ideologies.ts";
import { effectiveCard } from "../engine/countsAs.ts";

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

export interface ProjectLevel {
  /** Crisis-value increment gained on reaching this level (level 1 = base). */
  value: number;
  /** Reserved for future upgrade effects; unused in the value-only launch. */
  effect?: EffectSpec;
}

export interface KeystoneProject {
  id: string;
  pattern: PatternKind;
  name: string;
  flavor: string;
  /** Contribution to the Crisis score when this project's pattern is built. */
  value: number;
  /** Optional authored diminishing curve; defaults derived from value. */
  levels?: ProjectLevel[];
  /** Optional one-shot or passive effect on unlock; semantics deferred. */
  unlockEffect?: EffectSpec;
}

export interface ProjectUnlock {
  projectId: string;
  pattern: PatternKind;
  turn: number;
  /** Snapshot of the built column at Build time (used for the unlock log). */
  cards: Card[];
  /** Ideology the player promoted at Build. Drives ideologyInfluence ONLY.
   *  null when the built column had no non-wild ideology (all-wild build).
   *  REQUIRED (non-optional): every literal must set it (see P3 test scope) — a
   *  missing value would make ideologyInfluence read out[undefined] ⇒ NaN, so we
   *  force the type system to surface every site at tsc time. */
  promotedIdeology: Ideology | null;
}

export interface Crisis {
  id: string;
  name: string;
  flavor: string;
  difficulty: number;
}

export interface CrisisContribution {
  projectId: string;
  pattern: PatternKind;
  name: string;
  turn: number;
  /** 1-based level this build represents. */
  level: number;
  /** Marginal leveled value this build added. */
  value: number;
}

export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  /** Ordered highest pattern first (reverse of PATTERNS_IN_ORDER), then by turn. */
  contributingUnlocks: ProjectUnlock[];
  /** Per-build leveled detail, same order as contributingUnlocks. */
  contributions: CrisisContribution[];
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

/** The diminishing level curve for a project: authored if present, else a
 *  default of [base, round(base/2), round(base/4)] floored at 1. */
export function projectLevels(project: KeystoneProject): ProjectLevel[] {
  if (project.levels && project.levels.length > 0) return project.levels;
  const base = project.value;
  return [
    { value: base },
    { value: Math.max(1, Math.round(base / 2)) },
    { value: Math.max(1, Math.round(base / 4)) },
  ];
}

/** Total Crisis contribution for building this project `count` times. Level
 *  increments past the authored curve repeat its last entry — the
 *  never-worthless flat tail. */
export function projectContribution(project: KeystoneProject, count: number): number {
  if (count <= 0) return 0;
  const levels = projectLevels(project);
  let total = 0;
  for (let i = 0; i < count; i++) total += levels[Math.min(i, levels.length - 1)].value;
  return total;
}

/** Marginal value of the next build (count → count + 1). For the build AI. */
export function marginalContribution(project: KeystoneProject, currentCount: number): number {
  return (
    projectContribution(project, currentCount + 1) - projectContribution(project, currentCount)
  );
}

export function unlockedIdeologyBreakdown(unlocks: ProjectUnlock[]): Record<Ideology, number> {
  const out = zeroIdeologyBreakdown();
  for (const u of unlocks) {
    for (const c of u.cards) {
      // Crisis/Monument identity record excludes wilds, matching deriveVector.
      if (effectiveCard(c).ideologyWild) continue;
      if (c.ideology === "wild") continue; // narrows CardIdeology → Ideology for indexing
      out[c.ideology] += 1;
    }
  }
  return out;
}

/** Ideologies with ≥1 non-wild card in the column — the legal promotion
 *  choices at Build. Wilds (countsAs) are swing voters: they never make a
 *  color promotable, so an all-wild column returns []. The legacy "wild"
 *  sentinel (Dissent / old data) is skipped too. Reads the LITERAL
 *  `c.ideology`, never the countsAs-resolved value (consistent with
 *  deriveVector / unlockedIdeologyBreakdown). */
export function presentIdeologies(cards: Card[]): Ideology[] {
  const tally = zeroIdeologyBreakdown();
  for (const c of cards) {
    if (c.countsAs !== undefined || c.ideology === "wild") continue;
    tally[c.ideology] += 1;
  }
  return (Object.keys(tally) as Ideology[]).filter((i) => tally[i] > 0);
}

/** Strict plurality of non-wild card ideologies in a set of cards.
 *  Returns null on a tie or if all cards are wild. */
export function projectMajority(cards: Card[]): Ideology | null {
  const tally = zeroIdeologyBreakdown();
  for (const c of cards) {
    // Wilds (countsAs jokers) are swing voters — excluded from majority/promotion,
    // matching deriveVector + unlockedIdeologyBreakdown.
    if (effectiveCard(c).ideologyWild) continue;
    if (c.ideology === "wild") continue; // narrows CardIdeology → Ideology for indexing
    tally[c.ideology] += 1;
  }
  const ranked = (Object.entries(tally) as [Ideology, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  return ranked[0][0];
}

/** Each unlock contributes, to its promotedIdeology, the count of its OWN
 *  non-wild cards of that color. Swing voters: wilds (countsAs) complete the
 *  shape but add no fuel; off-color cards don't fuel the promoted color; a null
 *  promotion (all-wild build) contributes nothing. This is the count-scaled
 *  replacement for the old flat-+1-to-plurality derivation. (deriveVector and
 *  unlockedIdeologyBreakdown — the IDENTITY record — deliberately diverge: they
 *  skip wilds entirely. Do not "unify" the two.) */
export function ideologyInfluence(unlocks: ProjectUnlock[]): Record<Ideology, number> {
  const out = zeroIdeologyBreakdown();
  for (const u of unlocks) {
    if (u.promotedIdeology === null) continue;
    for (const c of u.cards) {
      if (c.countsAs === undefined && c.ideology === u.promotedIdeology) {
        out[u.promotedIdeology] += 1;
      }
    }
  }
  return out;
}
