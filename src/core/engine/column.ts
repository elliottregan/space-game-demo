// Column types + placement helpers for the two-row column model.

import type { Card } from "../data/cards.ts";
import { canOccupyRow, effectiveCard, isWildCard } from "./countsAs.ts";
import { validateRowHand } from "./rowHands.ts";

// -------------------------------------------------------------------------
// Column shape
// -------------------------------------------------------------------------

export interface LandRow {
  /** Always forms a valid row-hand (see rowHands.ts); up to 5 cards (straight / full house). */
  cards: Card[];
}

export interface InfluenceRow {
  /** All same role-type when non-empty; sized by configured row-hand. */
  cards: Card[];
}

export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  /** Inert staging area: any card kind, capacity-limited, invisible to
   *  pattern/ideology evaluation (columnCards() excludes it, which is how
   *  evaluation ignores it). Survives Build. See the M1 design spec. */
  storage: Card[];
}

export interface ColumnConfig {
  /** Card ids; must share rank when length > 1. */
  lands: string[];
  influence?: string[];
}

// -------------------------------------------------------------------------
// Placement helpers
// -------------------------------------------------------------------------

export function createEmptyColumn(): Column {
  return {
    lands: { cards: [] },
    influence: { cards: [] },
    storage: [],
  };
}

/** A SINGLE-CARD placement may only GROW a same-rank stack: the resulting row
 *  must be empty or have all its NON-wild cards share one rank — i.e. it stays a
 *  high-card / pair / trips / quads (wilds extending it). This blocks reaching
 *  two-pair / full-house / straight incrementally; those shapes must go through
 *  commitHand. Per spec §3.3, this gate applies whenever a wild is involved —
 *  either the placed card is wild, OR the row already contains a wild (a wild in
 *  the row is what enables a forbidden two-pair/full-house/straight via single
 *  placement, e.g. a non-wild 7 onto [5,5,wild] ⇒ two-pair). */
function isSameRankStack(cards: Card[]): boolean {
  const fixedRanks = cards.filter((c) => !isWildCard(c)).map((c) => effectiveCard(c).ranks[0]);
  return new Set(fixedRanks).size <= 1;
}

function singlePlacementOk(card: Card, existing: Card[]): boolean {
  const wildInvolved = isWildCard(card) || existing.some((c) => isWildCard(c));
  if (!wildInvolved) return true;
  return isSameRankStack([...existing, card]);
}

export function canPlaceLand(col: Column, card: Card): boolean {
  if (!canOccupyRow(card, "land")) return false;
  if (!singlePlacementOk(card, col.lands.cards)) return false;
  return validateRowHand([...col.lands.cards, card]);
}

export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (!canOccupyRow(card, "role")) return false;
  if (col.lands.cards.length < 1) return false;
  if (!singlePlacementOk(card, col.influence.cards)) return false;
  return validateRowHand([...col.influence.cards, card]);
}

export function placeLand(col: Column, card: Card): void {
  col.lands.cards.push(card);
}

export function placeInfluence(col: Column, card: Card): void {
  col.influence.cards.push(card);
}

export function clearColumn(col: Column): void {
  col.lands.cards.length = 0;
  col.influence.cards.length = 0;
}

export function columnCards(col: Column): Card[] {
  return [...col.lands.cards, ...col.influence.cards];
}

export function isBuildable(col: Column): boolean {
  return col.lands.cards.length >= 1 && col.influence.cards.length >= 1;
}

export function columnFromConfig(
  cfg: ColumnConfig,
  resolve: (id: string) => Card | undefined,
): Column {
  const col = createEmptyColumn();
  for (const id of cfg.lands) {
    const c = resolve(id);
    if (c) col.lands.cards.push(c);
  }
  for (const id of cfg.influence ?? []) {
    const c = resolve(id);
    if (c) col.influence.cards.push(c);
  }
  return col;
}
