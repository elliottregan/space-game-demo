// Epoch types + lifecycle + ideology-derived helpers.
// Per-turn commands live in commands.ts; turn/crisis flow in turn.ts.

import type { Card, EffectSpec } from "../data/cards.ts";
import type { CrisisOutcome, ProjectUnlock } from "../data/projects.ts";
import type { Campaign } from "./campaign.ts";
import type { GameEvent } from "./events.ts";
import { type Column, columnFromConfig, createEmptyColumn } from "./column.ts";
import { CARD_BY_ID } from "../data/cards.ts";
import { drawToHandSize, purgeDissent } from "./effects.ts";
import { effectiveRules } from "./effectiveRules.ts";
import { deriveVector, type IdeologyVector } from "./ideology.ts";
import type { Setting } from "../settings/index.ts";
import type { RNG } from "./rng.ts";
import type { Ideology } from "../data/ideologies.ts";
import { IDEOLOGIES } from "../data/ideologies.ts";
import { POLICY_DECKS, type PolicyCard } from "../data/policies.ts";
import type { TurnPhase } from "./turnPhase.ts";

// -------------------------------------------------------------------------
// Epoch runtime state
// -------------------------------------------------------------------------

export interface Epoch {
  epochNumber: number;
  settingId: string;
  turn: number;
  /** Epoch lifecycle phase. */
  phase: EpochPhase;
  /** Sub-phase within a turn. Orthogonal to `phase`: only meaningful while
   *  `phase === "play"`. See engine/turnPhase.ts. */
  turnPhase: TurnPhase;
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
  policy: PolicyState;
}

export type EpochPhase = "play" | "crisis" | "end-of-epoch";

// -------------------------------------------------------------------------
// Policy tableau state (M4)
// -------------------------------------------------------------------------

/** A slotted policy card and how many copies are stacked on it. */
export interface PolicySlot {
  card: PolicyCard;
  stacks: number;
}

/** Per-Epoch policy engine state: finite per-ideology draw piles, their
 *  discard piles, the 5-slot tableau, and this turn's drawn candidates. */
export interface PolicyState {
  /** Finite draw piles, one per ideology. */
  decks: Record<Ideology, PolicyCard[]>;
  /** Reshuffled back into the matching deck when it empties. */
  discards: Record<Ideology, PolicyCard[]>;
  /** Up to 5 slots of stacked policy cards. */
  tableau: PolicySlot[];
  /** Drawn this turn, awaiting slot or discard. */
  candidates: PolicyCard[];
}

/** A fresh policy state with per-ideology decks shuffled from POLICY_DECKS. */
function createPolicyState(rng: RNG): PolicyState {
  const decks = {} as Record<Ideology, PolicyCard[]>;
  const discards = {} as Record<Ideology, PolicyCard[]>;
  for (const ideology of IDEOLOGIES) {
    decks[ideology] = rng.shuffle(POLICY_DECKS[ideology]);
    discards[ideology] = [];
  }
  return { decks, discards, tableau: [], candidates: [] };
}

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
    turnPhase: "play",
    hand: [],
    draw: deck,
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: 0,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
    policy: createPolicyState(rng),
  };

  // Initial influence + hand are operative values: route through effectiveRules
  // (the policy tableau is empty at creation, so these equal the base rules).
  const er = effectiveRules(epoch, setting);
  epoch.influence = er.influenceBaseline;
  drawToHandSize(epoch, er.handSize, rng);
  return epoch;
}

export function currentVector(epoch: Epoch, setting: Setting): IdeologyVector {
  return deriveVector(epoch.columns, epoch.unlockedProjects, setting.projects);
}

export { purgeDissent };
