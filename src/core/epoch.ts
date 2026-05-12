// Epoch lifecycle + commands (redesign).
// No more slotting into projects. Cards play to tableau; mega-structures
// complete when the required hand + keystone are in hand simultaneously.

import type {
  Campaign,
  Card,
  Epoch,
  EventEntry,
  IdeologyVector,
  Setting,
  TableauSlot,
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
import { completionTier, evaluateMegaStructure, scoreMegaStructure } from "./patterns.ts";
import {
  activeUpkeepCards,
  allTableauCards,
  canPlaceLand,
  canPlaceTopper,
  createEmptySlot,
  materialProduction,
  placeLand,
  placeTopper,
  popTopmost,
} from "./tableau.ts";
import type { RNG } from "./rng.ts";

// -------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------

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

  const tableau: TableauSlot[] = [];
  for (let i = 0; i < setting.rules.tableauSlots; i++) {
    const cfg = setting.startingTableau[i];
    if (!cfg) {
      tableau.push(createEmptySlot());
      continue;
    }
    const lands = cfg.lands.map((id) => CARD_BY_ID[id]!).filter(Boolean);
    const topper = cfg.topper ? (CARD_BY_ID[cfg.topper] ?? null) : null;
    tableau.push({ lands, topper });
  }

  const eventLog: EventEntry[] = [];
  const epoch: Epoch = {
    epochNumber,
    settingId: setting.id,
    turn: 1,
    phase: "draw",
    hand: [],
    draw: deck,
    discard: [],
    tableau,
    influence: setting.rules.influenceBaseline,
    materials: 0,
    taskProgress: {},
    tasksRevealed: [],
    endOfTurnQueue: [],
    eventLog,
    status: { kind: "in-progress" },
  };

  applyScarredTerrainDissent(epoch, campaign.terrain);
  drawToHandSize(epoch, setting.rules.handSize, rng);
  epoch.phase = "main";

  eventLog.push({ turn: 0, text: `Epoch ${epochNumber}: ${setting.name} begins.`, kind: "info" });
  return epoch;
}

function applyScarredTerrainDissent(epoch: Epoch, terrain: { axis1: number; axis2: number }): void {
  const addIf = (
    magnitude: number,
    ideology: "solidarity" | "sovereignty" | "transformation" | "heritage",
  ) => {
    if (magnitude < 2) return;
    const n = Math.min(3, Math.floor(magnitude / 2));
    for (let i = 0; i < n; i++) {
      epoch.draw.push(makeDissent("backlash", ideology));
    }
  };
  if (terrain.axis1 > 0) addIf(terrain.axis1, "sovereignty");
  if (terrain.axis1 < 0) addIf(Math.abs(terrain.axis1), "solidarity");
  if (terrain.axis2 > 0) addIf(terrain.axis2, "transformation");
  if (terrain.axis2 < 0) addIf(Math.abs(terrain.axis2), "heritage");
}

// -------------------------------------------------------------------------
// Vector derivation (tableau + terrain + transient shift + hand backlash)
// -------------------------------------------------------------------------

export function currentVector(epoch: Epoch, campaign: Campaign): IdeologyVector {
  const shift = getTransientShift(epoch);
  const baseTerrain = {
    axis1: campaign.terrain.axis1 + shift.axis1,
    axis2: campaign.terrain.axis2 + shift.axis2,
  };
  let backlashBonus = { axis1: 0, axis2: 0 };
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
  const terrain = {
    axis1: baseTerrain.axis1 + backlashBonus.axis1,
    axis2: baseTerrain.axis2 + backlashBonus.axis2,
  };
  return deriveVector(epoch.tableau, terrain);
}

export function effectiveInfluenceCost(card: Card, vector: IdeologyVector): number {
  const alignment = checkAlignment(card, vector);
  const adj = influenceCostAdjustment(alignment);
  return Math.max(0, card.influenceCost + adj);
}

// -------------------------------------------------------------------------
// Commands
// -------------------------------------------------------------------------

export function playCard(
  epoch: Epoch,
  campaign: Campaign,
  setting: Setting,
  cardId: string,
  slotIndex: number | undefined,
  rng: RNG,
):
  | { ok: true; card: Card; alignment: "aligned" | "opposed" | "neutral" }
  | { ok: false; error: string } {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "main") return { ok: false, error: "Not in main phase." };

  const handIdx = epoch.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[handIdx]!;
  if (card.tags.includes("dissent")) return { ok: false, error: "Dissent cannot be played." };

  const vector = currentVector(epoch, campaign);
  const alignment = checkAlignment(card, vector);

  if (card.kind === "land") {
    if (slotIndex === undefined)
      return { ok: false, error: "Choose a tableau slot for this Land." };
    const slot = epoch.tableau[slotIndex];
    if (!slot) return { ok: false, error: "Invalid slot." };
    if (!canPlaceLand(slot, card))
      return {
        ok: false,
        error: "Land cannot be placed there (rank mismatch, stack full, or slot sealed).",
      };

    epoch.hand.splice(handIdx, 1);
    placeLand(slot, card);
    epoch.eventLog.push({
      turn: epoch.turn,
      text: `Placed ${card.name} on slot ${slotIndex + 1}.`,
    });
    return { ok: true, card, alignment: "neutral" };
  }

  if (card.kind === "role" || card.kind === "charter") {
    if (slotIndex === undefined) return { ok: false, error: "Choose an improved slot." };
    const slot = epoch.tableau[slotIndex];
    if (!slot) return { ok: false, error: "Invalid slot." };
    if (!canPlaceTopper(slot, card))
      return { ok: false, error: "Slot must be improved (2+ matching Lands) and empty of topper." };

    const cost = effectiveInfluenceCost(card, vector);
    if (epoch.influence < cost) {
      return { ok: false, error: `Need ${cost} Influence (have ${epoch.influence}).` };
    }
    epoch.influence -= cost;
    epoch.hand.splice(handIdx, 1);
    placeTopper(slot, card);

    const ctx: EffectContext = { epoch, rng, log: (e) => epoch.eventLog.push(e) };
    applyEffect(card.effect, ctx);

    // Opposed-play Dissent (spec §12 adapted): playing an opposed card generates Backlash.
    if (alignment === "opposed" && card.ideology !== "wild") {
      epoch.endOfTurnQueue.push({
        kind: "addDissent",
        variant: "backlash",
        ideology: opposingIdeology(card.ideology as any),
        amount: 1,
        timing: "end-of-turn",
      });
    }

    epoch.eventLog.push({
      turn: epoch.turn,
      text: `Played ${card.name}${alignment !== "neutral" ? " (" + alignment + ")" : ""} to slot ${slotIndex + 1}.`,
    });
    return { ok: true, card, alignment };
  }

  return { ok: false, error: "Card kind cannot be played." };
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

/**
 * Retrieve the topmost card of a slot back into hand.
 * - Topper (Role/Keystone): costs `retrieveInfluenceCost` Influence.
 * - Land: costs `retrieveInfluenceCost` Influence + `retrieveLandMaterialCost`
 *   Materials, and adds 1 Quiet Dissent to the top of the deck.
 */
export function retrieveFromTableau(
  epoch: Epoch,
  setting: Setting,
  slotIndex: number,
): { ok: true; card: Card } | { ok: false; error: string } {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "main") return { ok: false, error: "Not in main phase." };
  const slot = epoch.tableau[slotIndex];
  if (!slot) return { ok: false, error: "Invalid slot." };
  if (slot.topper === null && slot.lands.length === 0)
    return { ok: false, error: "Slot is empty." };

  const topmost = slot.topper ?? slot.lands[slot.lands.length - 1]!;
  const isLand = topmost.kind === "land";

  const infCost = setting.rules.retrieveInfluenceCost;
  const matCost = isLand ? setting.rules.retrieveLandMaterialCost : 0;

  if (epoch.influence < infCost) return { ok: false, error: `Need ${infCost} Influence.` };
  if (isLand && epoch.materials < matCost) {
    return { ok: false, error: `Retrieving a Land costs ${matCost} Materials.` };
  }

  const card = popTopmost(slot);
  if (!card) return { ok: false, error: "Nothing to retrieve." };

  epoch.influence -= infCost;
  if (isLand) {
    epoch.materials -= matCost;
    epoch.draw.unshift(makeDissent("quiet"));
  }
  epoch.hand.push(card);
  epoch.eventLog.push({
    turn: epoch.turn,
    text: isLand
      ? `Retrieved ${card.name} from slot ${slotIndex + 1}. 1 Quiet Dissent added to top of deck.`
      : `Retrieved ${card.name} from slot ${slotIndex + 1}.`,
    kind: isLand ? "warn" : undefined,
  });
  return { ok: true, card };
}

/** Discard a specific hand card to gain `discardMaterialGain` Materials. */
export function discardForMaterial(
  epoch: Epoch,
  setting: Setting,
  cardId: string,
): { ok: true; card: Card; gained: number } | { ok: false; error: string } {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "main") return { ok: false, error: "Not in main phase." };
  const idx = epoch.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[idx]!;
  const gain = setting.rules.discardMaterialGain;
  epoch.hand.splice(idx, 1);
  epoch.discard.push(card);
  epoch.materials += gain;
  epoch.eventLog.push({
    turn: epoch.turn,
    text: `Discarded ${card.name} for +${gain} Mat.`,
  });
  return { ok: true, card, gained: gain };
}

/** Attempt to play a mega-structure from the current hand. */
export function playMegaStructure(
  epoch: Epoch,
  setting: Setting,
  projectId: string,
):
  | { ok: true; tier: "bronze" | "silver" | "gold" | "platinum"; score: number }
  | { ok: false; error: string } {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  const project = setting.megaProjects.find((p) => p.id === projectId);
  if (!project) return { ok: false, error: "Unknown project." };

  const evaluation = evaluateMegaStructure(project, epoch.hand);
  if (!evaluation.canPlay) return { ok: false, error: evaluation.progress };

  // Consume the cards.
  const toConsume = new Set(evaluation.consumableCards);
  epoch.discard.push(...epoch.hand.filter((c) => toConsume.has(c)));
  epoch.hand = epoch.hand.filter((c) => !toConsume.has(c));

  const score = scoreMegaStructure(evaluation.consumableCards);
  const tier = completionTier(score);
  epoch.status = { kind: "won", projectId, tier, score };
  epoch.phase = "ended";
  epoch.eventLog.push({
    turn: epoch.turn,
    text: `Played ${project.name}! ${tier} (${score}).`,
    kind: "info",
  });
  return { ok: true, tier, score };
}

// -------------------------------------------------------------------------
// End of turn
// -------------------------------------------------------------------------

export function endTurn(epoch: Epoch, _campaign: Campaign, setting: Setting, rng: RNG): void {
  if (epoch.status.kind !== "in-progress") return;

  epoch.phase = "upkeep";
  const produced = materialProduction(epoch.tableau, landMaterialProduction);
  epoch.materials += produced;
  if (produced > 0) {
    epoch.eventLog.push({ turn: epoch.turn, text: `+${produced} Materials from Lands.` });
  }
  const ctx: EffectContext = { epoch, rng, log: (e) => epoch.eventLog.push(e) };
  for (const c of activeUpkeepCards(epoch.tableau)) {
    if (c.slotPassive) applyEffect(c.slotPassive, ctx);
  }

  epoch.phase = "end";
  resolveEndOfTurn(ctx);

  checkLossCondition(epoch, setting);
  if (epoch.status.kind !== "in-progress") return;

  // Hand persists across turns — no forced discard. Clear transient shift.
  (epoch as any).__shift = { axis1: 0, axis2: 0 };

  epoch.turn += 1;
  epoch.phase = "draw";
  drawToHandSize(epoch, setting.rules.handSize, rng);
  epoch.influence = setting.rules.influenceBaseline;

  checkLossCondition(epoch, setting);
  epoch.phase = "main";
}

// -------------------------------------------------------------------------
// Loss condition
// -------------------------------------------------------------------------

export function checkLossCondition(epoch: Epoch, setting: Setting): void {
  if (epoch.status.kind !== "in-progress") return;
  const { dissent, total } = countDissentInDeck(epoch);
  if (total > 0 && dissent / total > setting.rules.dissentLossThreshold) {
    epoch.status = { kind: "lost", mode: "populace-turned" };
    epoch.phase = "ended";
    epoch.eventLog.push({
      turn: epoch.turn,
      text: "The Populace Turned. Dissent overflow.",
      kind: "danger",
    });
    return;
  }
  if (epoch.turn > setting.rules.softTurnLimit) {
    epoch.status = { kind: "lost", mode: "starved-out" };
    epoch.phase = "ended";
    epoch.eventLog.push({
      turn: epoch.turn,
      text: "Starved Out. Time ran thin.",
      kind: "danger",
    });
  }
}

// -------------------------------------------------------------------------
// Re-exports
// -------------------------------------------------------------------------

export { purgeDissent };
