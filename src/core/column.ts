// Column data + placement helpers for the three-tier column model.

import type { Card, Column, ColumnConfig } from "./types.ts";

export const MAX_LAND_DEPTH = 4;

export function createEmptyColumn(): Column {
  return {
    lands: { cards: [] },
    influence: { card: null },
    charter: { card: null },
  };
}

export function canPlaceLand(col: Column, card: Card): boolean {
  if (card.kind !== "land") return false;
  if (col.lands.cards.length >= MAX_LAND_DEPTH) return false;
  if (col.lands.cards.length === 0) return true;
  return col.lands.cards[0]!.rank === card.rank;
}

export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (card.kind !== "role") return false;
  if (col.influence.card !== null) return false;
  return col.lands.cards.length >= 1;
}

export function canPlaceCharter(col: Column, card: Card): boolean {
  if (card.kind !== "charter") return false;
  if (col.charter.card !== null) return false;
  return col.influence.card !== null;
}

export function placeLand(col: Column, card: Card): void {
  col.lands.cards.push(card);
}

export function placeInfluence(col: Column, card: Card): void {
  col.influence.card = card;
}

export function placeCharter(col: Column, card: Card): void {
  col.charter.card = card;
}

export function clearColumn(col: Column): void {
  col.lands.cards.length = 0;
  col.influence.card = null;
  col.charter.card = null;
}

export function columnCards(col: Column): Card[] {
  const out: Card[] = [...col.lands.cards];
  if (col.influence.card) out.push(col.influence.card);
  if (col.charter.card) out.push(col.charter.card);
  return out;
}

export function columnLandRank(col: Column): number | null {
  return col.lands.cards[0]?.rank ?? null;
}

export function isBuildable(col: Column): boolean {
  return (
    col.lands.cards.length >= 1 &&
    col.influence.card !== null &&
    col.charter.card !== null
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
  if (cfg.influence) {
    const c = resolve(cfg.influence);
    if (c) col.influence.card = c;
  }
  if (cfg.charter) {
    const c = resolve(cfg.charter);
    if (c) col.charter.card = c;
  }
  return col;
}
