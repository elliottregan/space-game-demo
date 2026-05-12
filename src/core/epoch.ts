// Epoch lifecycle + column-based commands.

import type {
  Campaign,
  Card,
  Column,
  CrisisOutcome,
  Epoch,
  GameEvent,
  IdeologyVector,
  KeystoneProject,
  ProjectUnlock,
  Setting,
} from "./types.ts";
import { CARD_BY_ID, landMaterialProduction, makeDissent } from "./cards.ts";
import {
  applyEffect,
  countDissentInDeck,
  drawToHandSize,
  getTransientShift,
  purgeDissent,
  resolveEndOfTurn,
} from "./effects.ts";
import type { EffectContext } from "./effects.ts";
import { checkAlignment, deriveVector, influenceCostAdjustment } from "./ideology.ts";
import {
  canPlaceCharter,
  canPlaceInfluence,
  canPlaceLand,
  columnCards,
  columnFromConfig,
  createEmptyColumn,
} from "./column.ts";
import { evaluateColumn } from "./columnPatterns.ts";
import { reversePatternOrder } from "./projects.ts";
import { dispatch } from "./dispatch.ts";
import type { RNG } from "./rng.ts";

export function createEpoch(
  setting: Setting,
  campaign: Campaign,
  rng: RNG,
  epochNumber: number,
): Epoch {
  const starterIds = [...setting.startingDeck];
  const starterCards: Card[] = starterIds.map((id) => CARD_BY_ID[id]!).filter(Boolean);
  const legacyCards: Card[] = campaign.legacyCards.map((l) => l.baseCard);
  const deck = rng.shuffle([...starterCards, ...legacyCards]);

  const columns: Column[] = [];
  for (let i = 0; i < setting.rules.columnCount; i++) {
    const cfg = setting.startingColumns[i];
    columns.push(cfg ? columnFromConfig(cfg, (id) => CARD_BY_ID[id]) : createEmptyColumn());
  }

  const epoch: Epoch = {
    epochNumber,
    settingId: setting.id,
    turn: 1,
    phase: "play",
    hand: [],
    draw: deck,
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: setting.rules.influenceBaseline,
    materials: 0,
    taskProgress: {},
    tasksRevealed: [],
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };

  applyScarredTerrainDissent(epoch, campaign.terrain);
  drawToHandSize(epoch, setting.rules.handSize, rng);
  return epoch;
}

function applyScarredTerrainDissent(epoch: Epoch, terrain: { axis1: number; axis2: number }): void {
  const addIf = (
    mag: number,
    _ideology: "solidarity" | "sovereignty" | "transformation" | "heritage",
  ) => {
    if (mag < 2) return;
    const n = Math.min(3, Math.floor(mag / 2));
    for (let i = 0; i < n; i++) {
      epoch.draw.push(makeDissent("backlash"));
    }
  };
  if (terrain.axis1 > 0) addIf(terrain.axis1, "sovereignty");
  if (terrain.axis1 < 0) addIf(Math.abs(terrain.axis1), "solidarity");
  if (terrain.axis2 > 0) addIf(terrain.axis2, "transformation");
  if (terrain.axis2 < 0) addIf(Math.abs(terrain.axis2), "heritage");
}

export function currentVector(epoch: Epoch, campaign: Campaign): IdeologyVector {
  const shift = getTransientShift(epoch);
  const baseTerrain = {
    axis1: campaign.terrain.axis1 + shift.axis1,
    axis2: campaign.terrain.axis2 + shift.axis2,
  };
  const backlashBonus = { axis1: 0, axis2: 0 };
  for (const card of epoch.hand) {
    if (card.tags.includes("dissent") && card.ideology !== "wild") {
      switch (card.ideology) {
        case "solidarity":
          backlashBonus.axis1 -= 1;
          break;
        case "sovereignty":
          backlashBonus.axis1 += 1;
          break;
        case "transformation":
          backlashBonus.axis2 += 1;
          break;
        case "heritage":
          backlashBonus.axis2 -= 1;
          break;
      }
    }
  }
  return deriveVector(epoch.columns, {
    axis1: baseTerrain.axis1 + backlashBonus.axis1,
    axis2: baseTerrain.axis2 + backlashBonus.axis2,
  });
}

export function effectiveInfluenceCost(card: Card, vector: IdeologyVector): number {
  const alignment = checkAlignment(card, vector);
  const adj = influenceCostAdjustment(alignment);
  return Math.max(0, card.influenceCost + adj);
}

export type Alignment = "aligned" | "opposed" | "neutral";

export type PlaceResult =
  | { ok: true; card: Card; alignment: Alignment }
  | { ok: false; error: string };

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
  const card = epoch.hand[handIdx]!;
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
    return playToporRow(
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
    return playToporRow(
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

function playToporRow(
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

  const ctx: EffectContext = {
    epoch,
    rng,
    log: () => {},
  };
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

export type CmdResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

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
  const card = epoch.hand[idx]!;
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

export function endTurn(epoch: Epoch, _campaign: Campaign, setting: Setting, rng: RNG): void {
  if (epoch.status.kind !== "in-progress") return;
  if (epoch.phase !== "play") return;

  // Production: each Land produces materials per its rank.
  let produced = 0;
  for (const col of epoch.columns) {
    for (const l of col.lands.cards) produced += landMaterialProduction(l.rank);
  }
  epoch.materials += produced;

  // Resolve end-of-turn effects (Backlash / queued addDissent etc.).
  const ctx: EffectContext = {
    epoch,
    rng,
    log: () => {},
  };
  resolveEndOfTurn(ctx);

  // Loss-by-dissent check carries over.
  const { dissent, total } = countDissentInDeck(epoch);
  if (total > 0 && dissent / total > setting.rules.dissentLossThreshold) {
    // Force Crisis with zero contribution → guaranteed loss path.
    epoch.crisis.status = "pending";
    epoch.phase = "crisis";
    dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
    return;
  }

  // Transient ideology shift resets each turn.
  (epoch as Epoch & { __shift?: { axis1: number; axis2: number } }).__shift = {
    axis1: 0,
    axis2: 0,
  };

  // End-of-turn hand cycle: cards still in hand drop to discard without
  // triggering Dissent. The per-discard Dissent rule applies to deliberate
  // releases, not the natural turn cycle.
  if (epoch.hand.length > 0) {
    epoch.discard.push(...epoch.hand);
    epoch.hand = [];
  }

  dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
  epoch.turn += 1;

  if (epoch.turn > setting.rules.maxTurns) {
    epoch.phase = "crisis";
    return;
  }

  drawToHandSize(epoch, setting.rules.handSize, rng);
  epoch.influence = setting.rules.influenceBaseline;
}

export function resolveCrisis(epoch: Epoch, setting: Setting): CrisisOutcome {
  if (epoch.crisis.status === "resolved" && epoch.crisis.outcome) {
    return epoch.crisis.outcome;
  }
  const order = reversePatternOrder();
  const byPattern = new Map<string, ProjectUnlock[]>();
  for (const u of epoch.unlockedProjects) {
    const arr = byPattern.get(u.pattern) ?? [];
    arr.push(u);
    byPattern.set(u.pattern, arr);
  }
  const contributing: ProjectUnlock[] = [];
  let total = 0;
  for (const pattern of order) {
    const unlocks = (byPattern.get(pattern) ?? []).slice().sort((a, b) => a.turn - b.turn);
    for (const u of unlocks) {
      const project = setting.projects.find((p) => p.id === u.projectId);
      if (!project) continue;
      total += project.value;
      contributing.push(u);
    }
  }
  const cleared = total >= setting.crisis.difficulty;
  const outcome: CrisisOutcome = {
    totalValue: total,
    cleared,
    contributingUnlocks: contributing,
  };
  epoch.crisis = { status: "resolved", outcome };
  epoch.status = cleared ? { kind: "won", outcome } : { kind: "lost", outcome };
  epoch.phase = "end-of-epoch";
  dispatch(epoch, { type: "crisis-resolved", outcome });
  return outcome;
}

export { purgeDissent };
