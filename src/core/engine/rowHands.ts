// Row-hand classification: given a stack of cards in a Land or Influence row,
// identify which poker hand the stack forms (or null if it's not a hand).
// Flush, straight-flush, and royal-flush are column-level patterns; this
// module does not classify them.

import type { Card } from "../data/cards.ts";
import { RANKS, type RowKind } from "../data/cards.ts";
import type { Column } from "./column.ts";
import { canOccupyRow, effectiveCard } from "./countsAs.ts";

export type RowHand =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "four-of-a-kind"
  | "full-house";

export function identifyRowHand(cards: Card[]): RowHand | null {
  const n = cards.length;
  if (n === 0) return null;
  if (n === 1) return "high-card";

  const eff = cards.map(effectiveCard);
  const wilds = eff.filter((e) => e.isWild);
  const w = wilds.length;
  // Fixed cards contribute exactly one concrete rank each (shipped model).
  const fixedRanks = eff.filter((e) => !e.isWild).map((e) => e.ranks[0]);

  // Distinct-rank group sizes over the fixed cards, descending.
  const counts = new Map<number, number>();
  for (const r of fixedRanks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const g0 = groups[0] ?? 0;
  const g1 = groups[1] ?? 0;
  const maxSame = Math.min(n, g0 + w);

  // Highest-first, mirroring the spec §3.3 precedence:
  //   four-of-a-kind > full-house > straight > three-of-a-kind > two-pair > pair.
  // full-house is checked BEFORE straight so an all-wild w=5 row (which can form
  // EITHER) resolves to full-house, not straight (spec §3.3 step 5 + the all-wild
  // worked case). The n===5 three-of-a-kind fallback below catches a 5-card row
  // that has trips but no straight/full-house (e.g. [3,3,5,6]+wild — a duplicate
  // fixed rank kills the straight, so the wild joins the pair into trips).
  if (n === 4 && maxSame >= 4) return "four-of-a-kind";
  if (n === 5 && Math.max(0, 3 - g0) + Math.max(0, 2 - g1) <= w) return "full-house";
  if (n === 5 && canFormStraight(fixedRanks, w)) return "straight";
  if (n === 3 && maxSame >= 3) return "three-of-a-kind";
  // n===5 trips fallback: a 5-card row that has trips but no straight/full-house
  // (e.g. [3,3,5,6]+wild). Gated on g0 <= 3 so a degenerate 5-or-4-same fixed row
  // (e.g. [5,5,5,5,5]) stays null, matching the pre-wild classifier's n===5
  // behavior (only straight/full-house were ever non-null at n===5).
  if (n === 5 && g0 <= 3 && maxSame >= 3) return "three-of-a-kind";
  if (n === 4 && Math.max(0, 2 - g0) + Math.max(0, 2 - g1) <= w) return "two-pair";
  if (n === 2 && maxSame >= 2) return "pair";
  if (n === 1) return "high-card";
  return null;
}

/** True iff some length-5 consecutive window drawn from RANKS contains every
 *  fixed rank and the wilds can fill the remaining slots. Windows scan lo such
 *  that the whole [lo..lo+4] lies in [2..14] (lo ∈ [2..10]); rank 15 is never
 *  in RANKS so phantom top-end straights cannot be certified. Duplicate fixed
 *  ranks kill the straight. */
function canFormStraight(fixedRanks: number[], w: number): boolean {
  if (fixedRanks.length + w !== 5) return false;
  const distinct = new Set(fixedRanks);
  if (distinct.size !== fixedRanks.length) return false; // duplicate ⇒ no straight
  const minRank = RANKS[0];
  const maxRank = RANKS[RANKS.length - 1];
  for (let lo = minRank; lo + 4 <= maxRank; lo++) {
    const window = new Set([lo, lo + 1, lo + 2, lo + 3, lo + 4]);
    const allInside = fixedRanks.every((r) => window.has(r));
    if (allInside && w >= 5 - distinct.size) return true;
  }
  return false;
}

export function validateRowHand(cards: Card[]): boolean {
  return identifyRowHand(cards) !== null;
}

export function canCommitHand(col: Column, row: "land" | "influence", newCards: Card[]): boolean {
  if (newCards.length === 0) return false;
  const requiredRow: RowKind = row === "land" ? "land" : "role";
  if (newCards.some((c) => !canOccupyRow(c, requiredRow))) return false;
  // Influence sits on Land: same prerequisite as single-card placement.
  if (row === "influence" && col.lands.cards.length === 0) return false;

  const existing = row === "land" ? col.lands.cards : col.influence.cards;
  const after = [...existing, ...newCards];
  return validateRowHand(after);
}
