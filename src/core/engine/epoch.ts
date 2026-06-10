// Epoch types + lifecycle + ideology-derived helpers.
// Per-turn commands live in commands.ts; turn/crisis flow in turn.ts.

import type { Card, EffectSpec } from "../data/cards.ts";
import type { CrisisOutcome, ProjectUnlock } from "../data/projects.ts";
import type { Campaign } from "./campaign.ts";
import type { GameEvent } from "./events.ts";
import { type Column, columnFromConfig, createEmptyColumn } from "./column.ts";
import { CARD_BY_ID } from "../data/cards.ts";
import { drawToHandSize, purgeDissent } from "./effects.ts";
import { deriveVector, type IdeologyVector } from "./ideology.ts";
import type { Setting } from "../settings/index.ts";
import type { RNG } from "./rng.ts";

// -------------------------------------------------------------------------
// Epoch runtime state
// -------------------------------------------------------------------------

export interface Epoch {
  epochNumber: number;
  settingId: string;
  turn: number;
  phase: EpochPhase;
  hand: Card[];
  draw: Card[];
  discard: Card[];
  columns: Column[];
  unlockedProjects: ProjectUnlock[];
  eventLog: GameEvent[];
  influence: number;
  endOfTurnQueue: EffectSpec[];
  status: EpochStatus;
  crisis: {
    status: "pending" | "resolved";
    outcome?: CrisisOutcome;
  };
}

export type EpochPhase = "play" | "crisis" | "end-of-epoch";

export type EpochStatus =
  | { kind: "in-progress" }
  | { kind: "won"; outcome: CrisisOutcome }
  | { kind: "lost"; outcome: CrisisOutcome };

export function createEpoch(
  setting: Setting,
  campaign: Campaign,
  rng: RNG,
  epochNumber: number,
): Epoch {
  const starterIds = [...setting.startingDeck];
  const starterCards: Card[] = starterIds.flatMap((id) => {
    const card = CARD_BY_ID[id];
    return card ? [card] : [];
  });
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
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };

  drawToHandSize(epoch, setting.rules.handSize, rng);
  return epoch;
}

export function currentVector(epoch: Epoch, setting: Setting): IdeologyVector {
  return deriveVector(epoch.columns, epoch.unlockedProjects, setting.projects);
}

export { purgeDissent };
