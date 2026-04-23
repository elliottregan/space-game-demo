// Tableau logic. New rules:
// - A slot holds a stack of Lands (all of the same rank) + optionally one
//   Role/Keystone "topper" on top.
// - A slot is "improved" once its land stack has 2+ cards. Only improved
//   slots can accept a Role/Keystone topper.
// - All cards in a slot (lands + topper) contribute to ideology + are
//   individually retrievable (topmost first).

import type { Card, Epoch, TableauSlot } from "./types.ts";

export const MAX_STACK_DEPTH = 4;

export function createEmptySlot(): TableauSlot {
  return { lands: [], topper: null };
}

export function isImproved(slot: TableauSlot): boolean {
  return slot.lands.length >= 2;
}

export function slotRank(slot: TableauSlot): number | null {
  if (slot.lands.length === 0) return null;
  return slot.lands[0]!.rank;
}

/** Can a Land be placed on this slot? */
export function canPlaceLand(slot: TableauSlot, land: Card): boolean {
  if (land.kind !== "land") return false;
  if (slot.topper !== null) return false; // already has a topper; stack is "sealed"
  if (slot.lands.length === 0) return true;
  if (slot.lands.length >= MAX_STACK_DEPTH) return false;
  return slot.lands[0]!.rank === land.rank;
}

/** Can a Role/Keystone topper be placed on this slot? */
export function canPlaceTopper(slot: TableauSlot, topper: Card): boolean {
  if (topper.kind !== "role" && topper.kind !== "keystone") return false;
  if (slot.topper !== null) return false;
  return isImproved(slot);
}

/** Valid slots for a given card. Returns the indices and a short reason. */
export interface SlotOption {
  index: number;
  reason: string;
}

export function validSlotsForCard(epoch: Epoch, card: Card): SlotOption[] {
  const options: SlotOption[] = [];
  for (let i = 0; i < epoch.tableau.length; i++) {
    const slot = epoch.tableau[i]!;
    if (card.kind === "land" && canPlaceLand(slot, card)) {
      options.push({ index: i, reason: describeSlot(slot) });
    } else if ((card.kind === "role" || card.kind === "keystone") && canPlaceTopper(slot, card)) {
      options.push({ index: i, reason: describeSlot(slot) });
    }
  }
  return options;
}

function describeSlot(slot: TableauSlot): string {
  if (slot.lands.length === 0) return "empty";
  const rank = slot.lands[0]!.rank;
  const count = slot.lands.length;
  const improved = isImproved(slot) ? "improved" : "unimproved";
  return `rank ${rank} × ${count} (${improved})`;
}

/** Place a Land into a specific slot. Caller must validate first. */
export function placeLand(slot: TableauSlot, land: Card): void {
  slot.lands.push(land);
}

/** Place a Role/Keystone topper on an improved slot. */
export function placeTopper(slot: TableauSlot, topper: Card): void {
  slot.topper = topper;
}

/**
 * Retrieve the topmost card from a slot. Returns it (caller puts in hand).
 * Priority: topper first, then top of the lands stack.
 */
export function popTopmost(slot: TableauSlot): Card | null {
  if (slot.topper) {
    const c = slot.topper;
    slot.topper = null;
    return c;
  }
  if (slot.lands.length > 0) {
    return slot.lands.pop() ?? null;
  }
  return null;
}

/** All cards in all slots (lands + toppers). Used for ideology derivation. */
export function allTableauCards(tableau: TableauSlot[]): Card[] {
  const cards: Card[] = [];
  for (const slot of tableau) {
    cards.push(...slot.lands);
    if (slot.topper) cards.push(slot.topper);
  }
  return cards;
}

export function materialProduction(
  tableau: TableauSlot[],
  productionFn: (rank: number) => number,
): number {
  let total = 0;
  for (const slot of tableau) {
    for (const land of slot.lands) total += productionFn(land.rank);
  }
  return total;
}

/** The active upkeep cards for a turn: top Land of each slot + any topper. */
export function activeUpkeepCards(tableau: TableauSlot[]): Card[] {
  const out: Card[] = [];
  for (const slot of tableau) {
    if (slot.lands.length > 0) out.push(slot.lands[slot.lands.length - 1]!);
    if (slot.topper) out.push(slot.topper);
  }
  return out;
}
