// Pure view-model for the project tree panel (tech tree v0).
// Derives ladder nodes from a Setting's projects + the Epoch's unlocks.

import type { Ideology, KeystoneProject, PatternKind, ProjectUnlock } from "../../core/types.ts";
import {
  PATTERNS_IN_ORDER,
  getProjectForPattern,
  ideologyInfluence,
  projectContribution,
  projectMajority,
} from "../../core/data/projects.ts";
import { effectiveCard } from "../../core/engine/countsAs.ts";
import { patternLabel } from "./labels.ts";

export interface ProjectTreeNode {
  pattern: PatternKind;
  name: string;
  value: number;
  /** Human-readable pattern requirement, e.g. "Straight". */
  requirement: string;
  built: boolean;
  buildCount: number;
  firstBuiltTurn: number | null;
  /** Total leveled Crisis contribution from all builds of this project (0 when unbuilt). */
  contributedValue: number;
  /**
   * Strict-plurality ideology of each individual build, in build order; an entry is
   * null on a tie / all-wild for that build. One large counter is rendered per non-null
   * entry, so the big-counter tally across nodes equals `ideologyInfluence` (one majority
   * per completed project, not pooled across repeat builds).
   */
  majorities: (Ideology | null)[];
  /** Non-wild ideology per built card, across every build of this project (wild excluded). */
  cardIdeologies: Ideology[];
}

export interface ProjectTree {
  nodes: ProjectTreeNode[];
  /** Big-counter tally per ideology = ideologyInfluence over all unlocks. Drives policy draws. */
  influence: Record<Ideology, number>;
}

export function buildProjectTree(
  projects: KeystoneProject[],
  unlocks: ProjectUnlock[],
): ProjectTree {
  const nodes: ProjectTreeNode[] = [];
  for (const pattern of PATTERNS_IN_ORDER) {
    const project = getProjectForPattern(projects, pattern);
    if (!project) continue;
    const builds = unlocks.filter((u) => u.pattern === pattern);
    const cards = builds.flatMap((u) => u.cards);
    // Wilds (countsAs jokers) are excluded — they carry a concrete literal color but
    // are swing voters in identity terms, matching projectMajority / unlockedIdeologyBreakdown.
    const cardIdeologies = cards
      .filter((c) => !effectiveCard(c).ideologyWild)
      .map((c) => c.ideology)
      .filter((i): i is Ideology => i !== "wild");
    // One majority per build (per completed project) — never pooled across repeat builds, so
    // the rendered big counters stay in lockstep with `ideologyInfluence` (per-unlock).
    const majorities = builds.map((u) => projectMajority(u.cards));
    nodes.push({
      pattern,
      name: project.name,
      value: project.value,
      requirement: patternLabel(pattern),
      built: builds.length > 0,
      buildCount: builds.length,
      firstBuiltTurn: builds.length > 0 ? Math.min(...builds.map((u) => u.turn)) : null,
      contributedValue: builds.length > 0 ? projectContribution(project, builds.length) : 0,
      majorities,
      cardIdeologies,
    });
  }
  return { nodes, influence: ideologyInfluence(unlocks) };
}
