// Shared test fixtures for hand-built core state.

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
