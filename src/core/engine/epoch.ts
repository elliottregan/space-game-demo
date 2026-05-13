// Epoch types + lifecycle + ideology-derived helpers.
// Per-turn commands live in commands.ts; turn/crisis flow in turn.ts.

import type { Card, EffectSpec } from "../data/cards.ts";
import type { CrisisOutcome, ProjectUnlock } from "../data/projects.ts";
import type { Campaign } from "./campaign.ts";
import type { GameEvent } from "./events.ts";
import { type Column, columnFromConfig, createEmptyColumn } from "./column.ts";
import { CARD_BY_ID, makeDissent } from "../data/cards.ts";
import { drawToHandSize, getTransientShift, purgeDissent } from "./effects.ts";
import {
  checkAlignment,
  deriveVector,
  IDEOLOGY_AXIS,
  influenceCostAdjustment,
  type IdeologyVector,
} from "./ideology.ts";
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
  materials: number;
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

export type Alignment = "aligned" | "opposed" | "neutral";

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
    materials: 0,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };

  applyScarredTerrainDissent(epoch, campaign.terrain);
  drawToHandSize(epoch, setting.rules.handSize, rng);
  return epoch;
}

function applyScarredTerrainDissent(epoch: Epoch, terrain: { axis1: number; axis2: number }): void {
  const addBacklash = (mag: number) => {
    if (mag < 2) return;
    const n = Math.min(3, Math.floor(mag / 2));
    for (let i = 0; i < n; i++) {
      epoch.draw.push(makeDissent("backlash"));
    }
  };
  if (terrain.axis1 !== 0) addBacklash(Math.abs(terrain.axis1));
  if (terrain.axis2 !== 0) addBacklash(Math.abs(terrain.axis2));
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
      const { axis, sign } = IDEOLOGY_AXIS[card.ideology];
      backlashBonus[axis] += sign;
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

export { purgeDissent };
