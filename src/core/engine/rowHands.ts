// Row-hand classification: given a stack of cards in a Land or Influence row,
// identify which poker hand the stack forms (or null if it's not a hand).
// Flush, straight-flush, and royal-flush are column-level patterns; this
// module does not classify them.

import type { Card } from "../data/cards.ts";

export type RowHand =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "four-of-a-kind"
  | "full-house";

export function identifyRowHand(cards: Card[]): RowHand | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return "high-card";

  const counts = rankCounts(cards);
  const sortedCounts = [...counts.values()].sort((a, b) => b - a);

  if (cards.length === 5 && isStraight(cards)) return "straight";
  if (sortedCounts[0] === 4 && cards.length === 4) return "four-of-a-kind";
  if (sortedCounts[0] === 3 && sortedCounts[1] === 2 && cards.length === 5) return "full-house";
  if (sortedCounts[0] === 3 && cards.length === 3) return "three-of-a-kind";
  if (sortedCounts[0] === 2 && sortedCounts[1] === 2 && cards.length === 4) return "two-pair";
  if (sortedCounts[0] === 2 && cards.length === 2) return "pair";
  return null;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const c of cards) out.set(c.rank, (out.get(c.rank) ?? 0) + 1);
  return out;
}

function isStraight(cards: Card[]): boolean {
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== cards.length) return false;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

export function validateRowHand(cards: Card[]): boolean {
  return identifyRowHand(cards) !== null;
}

import type { Column } from "./column.ts";

export function canCommitHand(
  _col: Column,
  _row: "land" | "influence",
  _newCards: Card[],
): boolean {
  throw new Error("canCommitHand requires InfluenceRow.cards refactor — see Task 4");
}
