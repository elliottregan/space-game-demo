// Pure view-model for the project tree panel (tech tree v0).
// Derives ladder nodes from a Setting's projects + the Epoch's unlocks.

import type { KeystoneProject, PatternKind, ProjectUnlock } from "../../core/types.ts";
import { PATTERNS_IN_ORDER, getProjectForPattern } from "../../core/data/projects.ts";
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
}

export function buildProjectTree(
  projects: KeystoneProject[],
  unlocks: ProjectUnlock[],
): ProjectTreeNode[] {
  const nodes: ProjectTreeNode[] = [];
  for (const pattern of PATTERNS_IN_ORDER) {
    const project = getProjectForPattern(projects, pattern);
    if (!project) continue;
    const builds = unlocks.filter((u) => u.pattern === pattern);
    nodes.push({
      pattern,
      name: project.name,
      value: project.value,
      requirement: patternLabel(pattern),
      built: builds.length > 0,
      buildCount: builds.length,
      firstBuiltTurn: builds.length > 0 ? Math.min(...builds.map((u) => u.turn)) : null,
    });
  }
  return nodes;
}
