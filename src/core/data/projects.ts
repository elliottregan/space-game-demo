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
      if (c.ideology === "wild") continue;
      out[c.ideology] += 1;
    }
  }
  return out;
}
