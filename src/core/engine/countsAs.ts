// src/core/engine/countsAs.ts
// The SOLE place card wildness is interpreted. Pure core: no Vue, no facade
// import. Expands a stored Card into the option-sets it may assume for
// EVALUATION (pattern, flush, row placement, promotion-detection), plus thin
// predicates the evaluators call. Cost & effect are NEVER read here.

import type { Card, Ideology, Rank, RowKind } from "../data/cards.ts";
import { IDEOLOGIES, RANKS } from "../data/cards.ts";

export const ALL_ROWS: readonly RowKind[] = ["land", "role"];

/** The fully-expanded set of (rank, ideology, row) values a card MAY count as
 *  for evaluation. A literal dimension collapses to a single-element set;
 *  "any" expands to the full domain; an array expands to itself.
 *
 *  `ideologies` is `readonly Ideology[]` and NEVER contains the "wild"
 *  sentinel: a real-color literal ⇒ [that color]; a "wild" literal with no
 *  override (Dissent / data error) ⇒ []; "any" ⇒ all 4 IDEOLOGIES; an array
 *  ⇒ itself. Consumers may rely on every element being a real color. */
export interface EffectiveCard {
  card: Card;
  ranks: readonly Rank[]; // always non-empty (>= 1)
  ideologies: readonly Ideology[]; // bare-"wild"-without-countsAs ⇒ []
  rows: readonly RowKind[];
  isWild: boolean; // card.countsAs !== undefined (structural)
  /** True iff the ideology dimension is INDETERMINATE — "any" or a literal
   *  "wild" override. Drives the deriveVector skip; a rank-only partial with a
   *  real literal color has ideologyWild=false and is NOT skipped. */
  ideologyWild: boolean;
}

function expandRank(card: Card): readonly Rank[] {
  const ca = card.countsAs?.rank;
  if (ca === "any") return RANKS;
  if (Array.isArray(ca)) return ca;
  return [card.rank];
}

function expandIdeology(card: Card): readonly Ideology[] {
  const ca = card.countsAs?.ideology;
  if (ca === "any") return IDEOLOGIES;
  if (Array.isArray(ca)) return ca;
  // No override: a real ideology counts as itself; the legacy sentinel "wild"
  // (Dissent, or a data error) counts as NOTHING for flush. The === "wild"
  // narrow guarantees TS sees `Ideology` in the single-element branch.
  return card.ideology === "wild" ? [] : [card.ideology];
}

function expandRows(card: Card): readonly RowKind[] {
  const ca = card.countsAs?.kind;
  if (ca === "any") return ALL_ROWS;
  if (Array.isArray(ca)) return ca;
  return card.kind === "land" ? ["land"] : card.kind === "role" ? ["role"] : [];
}

function ideologyIsWild(card: Card): boolean {
  // INDETERMINATE iff the ideology dimension is overridden to "any". A bare
  // `ideology:"wild"` with NO countsAs (Dissent / data error) is NOT a joker and
  // NOT ideologyWild — it is colorless (expandIdeology ⇒ []), which BLOCKS a
  // flush rather than completing one. Per spec §3.2, isWild and ideologyWild
  // diverge only for future PARTIAL wilds; for the shipped Dissent both are
  // false. (countsAs.test.ts pins this.)
  return card.countsAs?.ideology === "any";
}

export function effectiveCard(card: Card): EffectiveCard {
  return {
    card,
    ranks: expandRank(card),
    ideologies: expandIdeology(card),
    rows: expandRows(card),
    isWild: card.countsAs !== undefined,
    ideologyWild: ideologyIsWild(card),
  };
}

export const canCountAsRank = (c: Card, r: Rank): boolean => effectiveCard(c).ranks.includes(r);
export const canCountAsIdeology = (c: Card, i: Ideology): boolean =>
  effectiveCard(c).ideologies.includes(i);
export const canOccupyRow = (c: Card, row: RowKind): boolean => effectiveCard(c).rows.includes(row);
export const isWildCard = (c: Card): boolean => c.countsAs !== undefined;
