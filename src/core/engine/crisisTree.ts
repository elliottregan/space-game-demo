// Crisis Tree — the phased, branching win condition (spec 2026-06-18).
// A Setting's Crisis is a DAG of objective nodes; each node is a recipe of
// built patterns. This module is pure: types + progress logic only. The Setting
// authors the tree; the Epoch carries CrisisTreeState; buildColumn drives it
// via applyBuild. Nothing here imports the layers above core/.

import type { Ideology } from "../data/ideologies.ts";
import type { PatternKind, ProjectUnlock } from "../data/projects.ts";

// A recipe entry: a build COUNT of a matching pattern. Counts builds, not value.
export interface ObjectiveRequirement {
  /** A specific rung, or "any" for volume nodes. */
  pattern: PatternKind | "any";
  /** How many matching builds the node needs. */
  count: number;
  /** Build must be an UPGRADE — the 2nd+ build of its project id this Epoch
   *  (Wonder "build twice"); satisfied when projectBuildCount >= 2. */
  upgrade?: boolean;
}

export interface ObjectiveNode {
  id: string;
  name: string;
  branch: "establish" | "expansion" | "doctrine" | "wonder";
  /** ALL requirements must be met to clear the node. */
  requirements: ObjectiveRequirement[];
  /** When activated the player BINDS a target ideology; requirements then only
   *  count builds promoted to that color (Doctrine). */
  requireSameIdeology?: boolean;
  /** Child node ids unlocked on clear. */
  unlocks: string[];
  /** Clearing it = a victory. */
  terminal: boolean;
  /** Bigger Legacy for deeper terminals (optional). */
  legacyTier?: number;
}

export interface CrisisTree {
  /** The single Establish gate. */
  rootId: string;
  nodes: Record<string, ObjectiveNode>;
}

export interface CrisisTreeState {
  /** The player's current focus; null = no objective selected. */
  activeNodeId: string | null;
  /** Cleared node ids. */
  cleared: string[];
  /** progress[nodeId][requirementIndex] = builds counted so far. */
  progress: Record<string, number[]>;
  /** Bound target color per activated requireSameIdeology (Doctrine) node. */
  boundIdeology: Record<string, Ideology>;
}

/** Unlocked (root, or any node all of whose parents are cleared) and not yet
 *  cleared. A node's parents are the nodes that list it in `unlocks`. */
export function availableNodes(tree: CrisisTree, state: CrisisTreeState): ObjectiveNode[] {
  const cleared = new Set(state.cleared);
  const out: ObjectiveNode[] = [];
  for (const node of Object.values(tree.nodes)) {
    if (cleared.has(node.id)) continue;
    if (node.id === tree.rootId) {
      out.push(node);
      continue;
    }
    const parents = Object.values(tree.nodes).filter((n) => n.unlocks.includes(node.id));
    if (parents.length > 0 && parents.every((p) => cleared.has(p.id))) out.push(node);
  }
  return out;
}

/** Does this build satisfy requirement `r` for `node`? Exactly the spec §4
 *  conjunction. */
function matchesRequirement(
  node: ObjectiveNode,
  r: ObjectiveRequirement,
  unlock: ProjectUnlock,
  projectBuildCount: number,
  boundIdeology: Ideology | undefined,
): boolean {
  const patternOk = r.pattern === "any" || unlock.pattern === r.pattern;
  const upgradeOk = !r.upgrade || projectBuildCount >= 2;
  const ideologyOk =
    !node.requireSameIdeology ||
    (unlock.promotedIdeology !== null && unlock.promotedIdeology === boundIdeology);
  return patternOk && upgradeOk && ideologyOk;
}

/** Advance the ACTIVE node by 1 for each requirement this build matches; clear
 *  the node + append its unlocks when every requirement reaches its count.
 *  Pure: returns a new CrisisTreeState, never mutates the input. */
export function applyBuild(
  tree: CrisisTree,
  state: CrisisTreeState,
  unlock: ProjectUnlock,
  projectBuildCount: number,
): CrisisTreeState {
  // Clone everything we might touch.
  const progress: Record<string, number[]> = {};
  for (const id of Object.keys(state.progress)) progress[id] = [...state.progress[id]];
  const next: CrisisTreeState = {
    activeNodeId: state.activeNodeId,
    cleared: [...state.cleared],
    progress,
    boundIdeology: { ...state.boundIdeology },
  };

  const activeId = next.activeNodeId;
  if (activeId === null) return next;
  if (next.cleared.includes(activeId)) return next;
  const node = tree.nodes[activeId];
  if (node === undefined) return next;

  const bound = next.boundIdeology[activeId];
  const nodeProgress = next.progress[activeId] ?? node.requirements.map(() => 0);
  next.progress[activeId] = nodeProgress;

  for (let i = 0; i < node.requirements.length; i++) {
    const r = node.requirements[i];
    if (nodeProgress[i] >= r.count) continue; // already satisfied
    if (matchesRequirement(node, r, unlock, projectBuildCount, bound)) {
      nodeProgress[i] += 1;
    }
  }

  // "append its unlocks" is realized by adding the parent to `cleared` —
  // availableNodes keys children off the parent's presence there. We already
  // early-return above when activeId is in `cleared`, so this push never dups.
  const allMet = node.requirements.every((r, i) => nodeProgress[i] >= r.count);
  if (allMet) next.cleared.push(activeId);

  return next;
}

/** True iff any cleared node is terminal. */
export function isWon(tree: CrisisTree, state: CrisisTreeState): boolean {
  return state.cleared.some((id) => tree.nodes[id]?.terminal === true);
}
