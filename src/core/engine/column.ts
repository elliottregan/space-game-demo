// Column types + placement helpers for the three-tier column model.

import type { Card } from "../data/cards.ts";

// -------------------------------------------------------------------------
// Column shape
// -------------------------------------------------------------------------

export interface LandRow {
  /** All same rank when non-empty; max 4 cards. */
  cards: Card[];
}

export interface InfluenceRow {
  /** All same role-type when non-empty; sized by configured row-hand. */
  cards: Card[];
}

export interface CharterRow {
  /** A card with kind === "charter". */
  card: Card | null;
}

export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  charter: CharterRow;
}

export interface ColumnConfig {
  /** Card ids; must share rank when length > 1. */
  lands: string[];
  influence?: string[];
  charter?: string;
}

// -------------------------------------------------------------------------
// Placement helpers
// -------------------------------------------------------------------------

export const MAX_LAND_DEPTH = 4;

export function createEmptyColumn(): Column {
  return {
    lands: { cards: [] },
    influence: { cards: [] },
    charter: { card: null },
  };
}

export function canPlaceLand(col: Column, card: Card): boolean {
  if (card.kind !== "land") return false;
  if (col.lands.cards.length >= MAX_LAND_DEPTH) return false;
  if (col.lands.cards.length === 0) return true;
  return col.lands.cards[0].rank === card.rank;
}

export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (card.kind !== "role") return false;
  if (col.influence.cards.length >= 1) return false;
  return col.lands.cards.length >= 1;
}

export function canPlaceCharter(col: Column, card: Card): boolean {
  if (card.kind !== "charter") return false;
  if (col.charter.card !== null) return false;
  return col.influence.cards.length >= 1;
}

export function placeLand(col: Column, card: Card): void {
  col.lands.cards.push(card);
}

export function placeInfluence(col: Column, card: Card): void {
  col.influence.cards.push(card);
}

export function placeCharter(col: Column, card: Card): void {
  col.charter.card = card;
}

export function clearColumn(col: Column): void {
  col.lands.cards.length = 0;
  col.influence.cards.length = 0;
  col.charter.card = null;
}

export function columnCards(col: Column): Card[] {
  const out: Card[] = [...col.lands.cards];
  out.push(...col.influence.cards);
  if (col.charter.card) out.push(col.charter.card);
  return out;
}

export function columnLandRank(col: Column): number | null {
  return col.lands.cards[0]?.rank ?? null;
}

export function isBuildable(col: Column): boolean {
  return (
    col.lands.cards.length >= 1 && col.influence.cards.length >= 1 && col.charter.card !== null
  );
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
  if (cfg.charter) {
    const c = resolve(cfg.charter);
    if (c) col.charter.card = c;
  }
  return col;
}
