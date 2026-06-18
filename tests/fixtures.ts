// Shared test fixtures for hand-built core state.

import type { Card } from "../src/core/data/cards.ts";
import { FULL_JOKER, getCard, landId } from "../src/core/data/cards.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";
import { IDEOLOGIES } from "../src/core/data/ideologies.ts";
import type { PolicyCard } from "../src/core/data/policies.ts";
import type { CrisisTree, CrisisTreeState, PolicyState } from "../src/core/types.ts";

/** A fully-empty PolicyState: empty deck/discard arrays per ideology, no
 *  tableau slots, no candidates. For hand-built Epoch literals in tests. */
export function emptyPolicyState(): PolicyState {
  const decks = {} as Record<Ideology, PolicyCard[]>;
  const discards = {} as Record<Ideology, PolicyCard[]>;
  for (const ideology of IDEOLOGIES) {
    decks[ideology] = [];
    discards[ideology] = [];
  }
  return { decks, discards, tableau: [], candidates: [] };
}

/** A no-active-node, nothing-cleared, no-progress CrisisTreeState for hand-built
 *  Epoch literals that don't exercise the Crisis Tree. With no `tree` arg this is
 *  the documented no-op state (activeNodeId === null, empty progress): applyBuild
 *  against it changes nothing. Pass a `tree` to seed activeNodeId=rootId and a
 *  zero-filled progress array per node sized to its requirements — for tests that
 *  hand-drive the tree without going through createEpoch / seedCrisisTreeState. */
export function emptyCrisisTreeState(tree?: CrisisTree): CrisisTreeState {
  if (tree === undefined) {
    return { activeNodeId: null, cleared: [], progress: {}, boundIdeology: {} };
  }
  const progress: Record<string, number[]> = {};
  for (const id of Object.keys(tree.nodes)) {
    progress[id] = tree.nodes[id].requirements.map(() => 0);
  }
  return { activeNodeId: tree.rootId, cleared: [], progress, boundIdeology: {} };
}

/** A full-joker card for evaluator tests: any rank, any ideology, either row.
 *  Wraps a base card (default: a real land) so it keeps a valid literal
 *  identity (id/cost/effect) while `countsAs: FULL_JOKER` overrides every
 *  evaluation dimension. Pass `id` to disambiguate multiple jokers in one row.
 */
export function fullJoker(id?: string): Card {
  const base = getCard(landId(5, "solidarity"));
  return {
    ...base,
    id: id ?? `joker-${Math.random().toString(36).slice(2, 8)}`,
    countsAs: FULL_JOKER,
  };
}
