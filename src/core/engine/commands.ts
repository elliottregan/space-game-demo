// Per-turn player commands.
// Each command validates the request, mutates state via dispatch, and returns
// a tagged result so the facade can surface errors without exceptions.

import type {
  Campaign,
  Card,
  Epoch,
  GameEvent,
  IdeologyVector,
  ProjectUnlock,
  Setting,
} from "../types.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand, columnCards } from "./column.ts";
import { evaluateColumn } from "./columnPatterns.ts";
import { dispatch } from "./dispatch.ts";
import { applyEffect } from "./effects.ts";
import type { EffectContext } from "./effects.ts";
import { checkAlignment } from "./ideology.ts";
import type { RNG } from "./rng.ts";
import { currentVector, effectiveInfluenceCost, type Alignment } from "./epoch.ts";

export type PlaceResult =
  | { ok: true; card: Card; alignment: Alignment }
  | { ok: false; error: string };

export type CmdResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export function placeCard(
  epoch: Epoch,
  campaign: Campaign,
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

  const vector = currentVector(epoch, campaign);
  const alignment = checkAlignment(card, vector);

  if (card.kind === "land") {
    if (!canPlaceLand(col, card)) {
      return { ok: false, error: "Land cannot be placed there (rank mismatch or stack full)." };
    }
    epoch.hand.splice(handIdx, 1);
    dispatch(epoch, { type: "card-played-to-land", card, columnIndex });
    return { ok: true, card, alignment: "neutral" };
  }

  if (card.kind === "role") {
    if (!canPlaceInfluence(col, card)) {
      return { ok: false, error: "Influence row needs at least one Land below." };
    }
    return playToTopRow(
      epoch,
      setting,
      vector,
      alignment,
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
    return playToTopRow(
      epoch,
      setting,
      vector,
      alignment,
      card,
      columnIndex,
      handIdx,
      "card-played-to-charter",
      rng,
    );
  }

  return { ok: false, error: "Card kind cannot be played." };
}

function playToTopRow(
  epoch: Epoch,
  _setting: Setting,
  vector: IdeologyVector,
  alignment: Alignment,
  card: Card,
  columnIndex: number,
  handIdx: number,
  eventType: GameEvent["type"] & ("card-played-to-influence" | "card-played-to-charter"),
  rng: RNG,
): PlaceResult {
  const cost = effectiveInfluenceCost(card, vector);
  if (epoch.influence < cost) {
    return { ok: false, error: `Need ${cost} Influence (have ${epoch.influence}).` };
  }
  epoch.influence -= cost;
  epoch.hand.splice(handIdx, 1);
  dispatch(epoch, { type: eventType, card, columnIndex } as GameEvent);

  const ctx: EffectContext = { epoch, rng, log: () => {} };
  applyEffect(card.effect, ctx);

  if (alignment === "opposed" && card.ideology !== "wild") {
    epoch.endOfTurnQueue.push({
      kind: "addDissent",
      variant: "backlash",
      ideology: opposingIdeology(card.ideology),
      amount: 1,
      timing: "end-of-turn",
    });
  }

  return { ok: true, card, alignment };
}

function opposingIdeology(ideology: "solidarity" | "sovereignty" | "transformation" | "heritage") {
  switch (ideology) {
    case "solidarity":
      return "sovereignty" as const;
    case "sovereignty":
      return "solidarity" as const;
    case "transformation":
      return "heritage" as const;
    case "heritage":
      return "transformation" as const;
  }
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

export function recallInfluence(epoch: Epoch, columnIndex: number): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.influence.card;
  if (!card) return { ok: false, error: "No Influence to recall." };
  if (col.charter.card !== null) {
    return { ok: false, error: "Discard the Charter first." };
  }
  dispatch(epoch, { type: "card-recalled-to-hand", card, columnIndex });
  return { ok: true, value: card };
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
  col.influence.card = null;
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
