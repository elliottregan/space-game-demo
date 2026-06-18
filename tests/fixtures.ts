// Shared test fixtures for hand-built core state.

import type { Card } from "../src/core/data/cards.ts";
import { FULL_JOKER, getCard, landId } from "../src/core/data/cards.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";
import { IDEOLOGIES } from "../src/core/data/ideologies.ts";
import type { PolicyCard } from "../src/core/data/policies.ts";
import type { PolicyState } from "../src/core/types.ts";

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
