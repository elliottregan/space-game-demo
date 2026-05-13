// Per-turn player commands.
// Each command validates the request, mutates state via dispatch, and returns
// a tagged result so the facade can surface errors without exceptions.

import type { Campaign, Card, Epoch, GameEvent, ProjectUnlock, Setting } from "../types.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand, columnCards } from "./column.ts";
import { evaluateColumn } from "./columnPatterns.ts";
import { dispatch } from "./dispatch.ts";
import { applyEffect } from "./effects.ts";
import type { EffectContext } from "./effects.ts";
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
): PlaceResult {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };

  const handIdx = epoch.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[handIdx];
  if (card.tags.includes("dissent")) return { ok: false, error: "Dissent cannot be played." };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  if (card.kind === "land") {
    if (!canPlaceLand(col, card)) {
      return { ok: false, error: "Land cannot be placed there (rank mismatch or stack full)." };
    }
    epoch.hand.splice(handIdx, 1);
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
      handIdx,
      "card-played-to-influence",
      rng,
    );
  }

  if (card.kind === "charter") {
    if (!canPlaceCharter(col, card)) {
      return { ok: false, error: "Charter row needs the Influence row filled." };
    }
    return playToTopRow(epoch, setting, card, columnIndex, handIdx, "card-played-to-charter", rng);
  }

  return { ok: false, error: "Card kind cannot be played." };
}

function playToTopRow(
  epoch: Epoch,
  _setting: Setting,
  card: Card,
  columnIndex: number,
  handIdx: number,
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
  epoch.hand.splice(handIdx, 1);
  dispatch(epoch, { type: eventType, card, columnIndex } as GameEvent);

  const ctx: EffectContext = { epoch, rng, log: () => {} };
  applyEffect(card.effect, ctx);

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
