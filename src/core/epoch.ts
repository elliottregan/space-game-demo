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
  const addIf = (mag: number, _ideology: "solidarity" | "sovereignty" | "transformation" | "heritage") => {
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
        case "solidarity":     backlashBonus.axis1 -= 1; break;
        case "sovereignty":    backlashBonus.axis1 += 1; break;
        case "transformation": backlashBonus.axis2 += 1; break;
        case "heritage":       backlashBonus.axis2 -= 1; break;
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
