// Per-turn player commands.
// Each command validates the request, mutates state via dispatch, and returns
// a tagged result so the facade can surface errors without exceptions.

import type { Campaign, Card, Epoch, GameEvent, ProjectUnlock, Setting } from "../types.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand, columnCards } from "./column.ts";
import { evaluateColumn } from "./columnPatterns.ts";
import { dispatch } from "./dispatch.ts";
import { applyEffect } from "./effects.ts";
import { canCommitHand } from "./rowHands.ts";
import type { RNG } from "./rng.ts";

export type PlaceResult = { ok: true; card: Card } | { ok: false; error: string };

export type CmdResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export function placeCard(
  epoch: Epoch,
  _campaign: Campaign,
  setting: Setting,
  cardId: string,
  columnIndex: number,
  rng: RNG,
  source: "hand" | "storage" = "hand",
): PlaceResult {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const pool = source === "hand" ? epoch.hand : col.storage;
  const poolIdx = pool.findIndex((c) => c.id === cardId);
  if (poolIdx === -1) {
    return { ok: false, error: source === "hand" ? "Card not in hand." : "Card not in storage." };
  }
  const card = pool[poolIdx];
  if (card.tags.includes("dissent")) return { ok: false, error: "Dissent cannot be played." };

  if (card.kind === "land") {
    if (!canPlaceLand(col, card)) {
      return { ok: false, error: "Land cannot be placed there (would not form a valid hand)." };
    }
    pool.splice(poolIdx, 1);
    dispatch(epoch, { type: "card-played-to-land", card, columnIndex });
    return { ok: true, card };
  }

  if (card.kind === "role") {
    if (!canPlaceInfluence(col, card)) {
      return { ok: false, error: "Influence row needs at least one Land below." };
    }
    return playToTopRow(
      epoch,
      setting,
      card,
      columnIndex,
      pool,
      poolIdx,
      "card-played-to-influence",
      rng,
    );
  }

  if (card.kind === "charter") {
    if (!canPlaceCharter(col, card)) {
      return { ok: false, error: "Charter row needs the Influence row filled." };
    }
    return playToTopRow(
      epoch,
      setting,
      card,
      columnIndex,
      pool,
      poolIdx,
      "card-played-to-charter",
      rng,
    );
  }

  return { ok: false, error: "Card kind cannot be played." };
}

function playToTopRow(
  epoch: Epoch,
  _setting: Setting,
  card: Card,
  columnIndex: number,
  pool: Card[],
  poolIdx: number,
  eventType: GameEvent["type"] & ("card-played-to-influence" | "card-played-to-charter"),
  rng: RNG,
): PlaceResult {
  if (epoch.influence < card.influenceCost) {
    return {
      ok: false,
      error: `Need ${card.influenceCost} Influence (have ${epoch.influence}).`,
    };
  }
  epoch.influence -= card.influenceCost;
  pool.splice(poolIdx, 1);
  dispatch(epoch, { type: eventType, card, columnIndex } as GameEvent);

  applyEffect(card.effect, { epoch, rng });

  return { ok: true, card };
}

export function discardLand(epoch: Epoch, columnIndex: number): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.lands.cards.pop();
  if (!card) return { ok: false, error: "No Land to discard." };
  dispatch(epoch, { type: "card-discarded", card, source: "tableau-land" });
  return { ok: true, value: card };
}

export function discardCharter(epoch: Epoch, columnIndex: number): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.charter.card;
  if (!card) return { ok: false, error: "No Charter to discard." };
  col.charter.card = null;
  dispatch(epoch, { type: "card-discarded", card, source: "tableau-charter" });
  return { ok: true, value: card };
}

export function recallInfluence(epoch: Epoch, columnIndex: number): CmdResult<Card[]> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  if (col.influence.cards.length === 0) return { ok: false, error: "No Influence to recall." };
  if (col.charter.card !== null) {
    return { ok: false, error: "Discard the Charter first." };
  }
  const recalled = [...col.influence.cards];
  // Emit a discard event per recalled card so Dissent + discard piles get the
  // same treatment as today's single-recall.
  for (const card of recalled) {
    dispatch(epoch, { type: "card-discarded", card, source: "influence-recall" });
  }
  col.influence.cards.length = 0;
  return { ok: true, value: recalled };
}

export function discardColumn(epoch: Epoch, columnIndex: number): CmdResult<void> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const cards = columnCards(col);
  if (cards.length === 0) return { ok: false, error: "Column is empty." };
  // Clear first so the cascade does not double-touch.
  col.lands.cards.length = 0;
  col.influence.cards.length = 0;
  col.charter.card = null;
  for (const c of cards) {
    dispatch(epoch, { type: "card-discarded", card: c, source: "column" });
  }
  return { ok: true, value: undefined };
}

export function discardFromHand(epoch: Epoch, cardId: string): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const idx = epoch.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[idx];
  epoch.hand.splice(idx, 1);
  dispatch(epoch, { type: "card-discarded", card, source: "hand" });
  return { ok: true, value: card };
}

export function buildColumn(
  epoch: Epoch,
  setting: Setting,
  columnIndex: number,
): CmdResult<ProjectUnlock> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const match = evaluateColumn(col, setting.projects);
  if (!match) return { ok: false, error: "Column is not buildable." };

  const unlock: ProjectUnlock = {
    projectId: match.projectId,
    pattern: match.kind,
    turn: epoch.turn,
    cards: [...match.cards],
  };
  dispatch(epoch, { type: "column-built", columnIndex, unlock });
  return { ok: true, value: unlock };
}

/**
 * Store a card from hand into a column's storage. Free; any card kind.
 *
 * @param replaceId - When provided, the named card MUST already be in this
 *   column's storage; it is evicted (dispatched as `card-discarded` with
 *   `source: "storage"`, which breeds Dissent) and the new card takes its
 *   place. This eviction happens regardless of whether storage is full — the
 *   caller is making an explicit swap, not an overflow check. If the named
 *   card is not found, the command returns an error with no mutation.
 *
 *   When omitted, the command requires a free slot. If storage is already at
 *   capacity the command returns an error with no mutation.
 */
export function storeCard(
  epoch: Epoch,
  setting: Setting,
  cardId: string,
  columnIndex: number,
  replaceId?: string,
): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const handIdx = epoch.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) return { ok: false, error: "Card not in hand." };

  if (replaceId !== undefined) {
    const replaceIdx = col.storage.findIndex((c) => c.id === replaceId);
    if (replaceIdx === -1) {
      return { ok: false, error: "Card to replace not found in storage." };
    }
    const [replaced] = col.storage.splice(replaceIdx, 1);
    dispatch(epoch, { type: "card-discarded", card: replaced, source: "storage" });
  } else {
    const capacity = setting.rules.storageCapacity;
    if (col.storage.length >= capacity) {
      return { ok: false, error: "Storage is full." };
    }
  }

  const card = epoch.hand[handIdx];
  epoch.hand.splice(handIdx, 1);
  dispatch(epoch, { type: "card-stored", card, columnIndex });
  return { ok: true, value: card };
}

export function commitHand(
  epoch: Epoch,
  columnIndex: number,
  row: "land" | "influence",
  cardIds: string[],
  rng: RNG,
  fromStorageIds: string[] = [],
): CmdResult<Card[]> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  if (cardIds.length + fromStorageIds.length === 0)
    return { ok: false, error: "No cards to commit." };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  // 1. Resolve hand ids → Cards, then storage ids → Cards (this column only).
  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = epoch.hand.find((h) => h.id === id);
    if (!c) return { ok: false, error: `Card ${id} not in hand.` };
    cards.push(c);
  }
  const storageCards: Card[] = [];
  for (const id of fromStorageIds) {
    const c = col.storage.find((s) => s.id === id);
    if (!c) return { ok: false, error: `Card ${id} not in this column's storage.` };
    storageCards.push(c);
  }

  const requestedIds = [...cardIds, ...fromStorageIds];
  if (new Set(requestedIds).size !== requestedIds.length) {
    return { ok: false, error: "Duplicate card in commit." };
  }

  const all = [...cards, ...storageCards];
  if (all.some((c) => c.tags.includes("dissent"))) {
    return { ok: false, error: "Dissent cannot be played." };
  }

  // 2. Kind check + row-hand validation over the combined set.
  if (!canCommitHand(col, row, all)) {
    return { ok: false, error: "Not a valid hand." };
  }

  // 3. For influence row, check affordability over the combined set.
  if (row === "influence") {
    const totalCost = all.reduce((sum, c) => sum + c.influenceCost, 0);
    if (epoch.influence < totalCost) {
      return { ok: false, error: "Not enough Influence." };
    }
    epoch.influence -= totalCost;
  }

  // 4. Remove from hand and from storage.
  const idsSet = new Set(cardIds);
  epoch.hand = epoch.hand.filter((h) => !idsSet.has(h.id));
  const storageSet = new Set(fromStorageIds);
  col.storage = col.storage.filter((s) => !storageSet.has(s.id));

  // 5. Dispatch — handler appends cards to the row in order.
  dispatch(epoch, { type: "cards-committed", columnIndex, row, cards: all });

  // 6. Fire per-card effects in placement order.
  if (row === "influence") {
    for (const card of all) {
      applyEffect(card.effect, { epoch, rng });
    }
  }

  return { ok: true, value: all };
}
