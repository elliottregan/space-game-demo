// Per-turn player commands.
// Each command validates the request, mutates state via dispatch, and returns
// a tagged result so the facade can surface errors without exceptions.

import type {
  Campaign,
  Card,
  Epoch,
  Ideology,
  PolicyCard,
  ProjectUnlock,
  Setting,
} from "../types.ts";
import { POLICY_SLOT_CAP, wouldFitInTableau } from "../data/policies.ts";
import { presentIdeologies } from "../data/projects.ts";
import { canPlaceInfluence, canPlaceLand, columnCards } from "./column.ts";
import { evaluateColumn } from "./columnPatterns.ts";
import { dispatch } from "./dispatch.ts";
import { applyEffect } from "./effects.ts";
import { effectiveRules } from "./effectiveRules.ts";
import { canCommitHand } from "./rowHands.ts";
import { isPlayPhase, isPolicyPhase } from "./turnPhase.ts";
import type { RNG } from "./rng.ts";

export type PlaceResult = { ok: true; card: Card } | { ok: false; error: string };

export type CmdResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

/** A bare rejection. Assignable to any `CmdResult<T>` / `PlaceResult` because
 *  the error arm is independent of `T`, so `return blocked;` typechecks. */
type Rejection = { ok: false; error: string };

/** Gate for board/tableau verbs: the Epoch must be live, in the play lifecycle
 *  phase, and past the policy sub-phase. Returns the rejection, or null to
 *  proceed. */
function requirePlayable(epoch: Epoch): Rejection | null {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  if (!isPlayPhase(epoch)) return { ok: false, error: "Resolve drawn policies first." };
  return null;
}

/** Gate for the policy-resolution verb: live, in the play lifecycle phase, and
 *  still in the policy sub-phase. Returns the rejection, or null to proceed. */
function requirePolicyResolution(epoch: Epoch): Rejection | null {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  if (!isPolicyPhase(epoch)) return { ok: false, error: "Not in the policy phase." };
  return null;
}

export function placeCard(
  epoch: Epoch,
  _campaign: Campaign,
  setting: Setting,
  cardId: string,
  columnIndex: number,
  rng: RNG,
  source: "hand" | "storage" = "hand",
): PlaceResult {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;

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
    // Plain lands are cost-0/noop, but a land-home joker (the ex-Founding
    // Charter) carries a real cost + effect. Charge + fire them at play time so
    // a wild pays its literal cost and fires its own effect (spec §3.2).
    if (epoch.influence < card.influenceCost) {
      return {
        ok: false,
        error: `Need ${card.influenceCost} Influence (have ${epoch.influence}).`,
      };
    }
    epoch.influence -= card.influenceCost;
    pool.splice(poolIdx, 1);
    dispatch(epoch, { type: "card-played-to-land", card, columnIndex });
    applyEffect(card.effect, { epoch, rng });
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

  return { ok: false, error: "Card kind cannot be played." };
}

function playToTopRow(
  epoch: Epoch,
  _setting: Setting,
  card: Card,
  columnIndex: number,
  pool: Card[],
  poolIdx: number,
  eventType: "card-played-to-influence",
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
  dispatch(epoch, { type: eventType, card, columnIndex });

  applyEffect(card.effect, { epoch, rng });

  return { ok: true, card };
}

export function discardLand(epoch: Epoch, columnIndex: number, rng: RNG): CmdResult<Card> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.lands.cards.pop();
  if (!card) return { ok: false, error: "No Land to discard." };
  dispatch(epoch, { type: "card-discarded", card, source: "tableau-land" }, rng);
  return { ok: true, value: card };
}

export function recallInfluence(epoch: Epoch, columnIndex: number, rng: RNG): CmdResult<Card[]> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  if (col.influence.cards.length === 0) return { ok: false, error: "No Influence to recall." };
  const recalled = [...col.influence.cards];
  // Emit a discard event per recalled card so Dissent + discard piles get the
  // same treatment as today's single-recall.
  for (const card of recalled) {
    dispatch(epoch, { type: "card-discarded", card, source: "influence-recall" }, rng);
  }
  col.influence.cards.length = 0;
  return { ok: true, value: recalled };
}

export function discardColumn(epoch: Epoch, columnIndex: number, rng: RNG): CmdResult<void> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const cards = columnCards(col);
  if (cards.length === 0) return { ok: false, error: "Column is empty." };
  // Clear first so the cascade does not double-touch.
  col.lands.cards.length = 0;
  col.influence.cards.length = 0;
  for (const c of cards) {
    dispatch(epoch, { type: "card-discarded", card: c, source: "column" }, rng);
  }
  return { ok: true, value: undefined };
}

export function discardFromHand(epoch: Epoch, cardId: string, rng: RNG): CmdResult<Card> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const idx = epoch.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[idx];
  epoch.hand.splice(idx, 1);
  dispatch(epoch, { type: "card-discarded", card, source: "hand" }, rng);
  return { ok: true, value: card };
}

export function buildColumn(
  epoch: Epoch,
  setting: Setting,
  columnIndex: number,
  rng: RNG,
  promote?: Ideology,
): CmdResult<ProjectUnlock> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const match = evaluateColumn(col, setting.projects);
  if (!match) return { ok: false, error: "Column is not buildable." };

  // Promotion: the player promotes one PRESENT ideology (drives ideologyInfluence).
  // Core auto-promotes the unambiguous cases so headless callers (sim/tests/AI)
  // need not re-implement the picker: 0 present ⇒ null; exactly 1 ⇒ that one;
  // a valid explicit promote ⇒ honored; ≥2 with none chosen ⇒ reject.
  const present = presentIdeologies(match.cards);
  let promotedIdeology: Ideology | null;
  if (present.length === 0) promotedIdeology = null;
  else if (promote && present.includes(promote)) promotedIdeology = promote;
  else if (promote)
    return { ok: false, error: "Cannot promote an ideology not present in the column." };
  else if (present.length === 1) promotedIdeology = present[0];
  else return { ok: false, error: "Choose an ideology to promote." };

  const unlock: ProjectUnlock = {
    projectId: match.projectId,
    pattern: match.kind,
    turn: epoch.turn,
    cards: [...match.cards],
    promotedIdeology,
  };
  dispatch(epoch, { type: "column-built", columnIndex, unlock }, rng);
  return { ok: true, value: unlock };
}

/**
 * Store a card from hand into a column's storage. Free; any card kind.
 * Requires the column to already hold at least one Land — storage is
 * infrastructure that play unlocks, not a free-floating stash.
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
  rng: RNG,
  replaceId?: string,
): CmdResult<Card> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const handIdx = epoch.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) return { ok: false, error: "Card not in hand." };
  // Storage is unlocked by play: a column must hold at least one Land
  // before its warehouse can be used (mirrors the Influence prerequisite).
  if (col.lands.cards.length === 0) {
    return { ok: false, error: "Storage needs at least one Land below." };
  }

  if (replaceId !== undefined) {
    const replaceIdx = col.storage.findIndex((c) => c.id === replaceId);
    if (replaceIdx === -1) {
      return { ok: false, error: "Card to replace not found in storage." };
    }
    const [replaced] = col.storage.splice(replaceIdx, 1);
    dispatch(epoch, { type: "card-discarded", card: replaced, source: "storage" }, rng);
  } else {
    const capacity = effectiveRules(epoch, setting).storageCapacity;
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
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
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

// -------------------------------------------------------------------------
// Policy tableau commands (M4)
// -------------------------------------------------------------------------

/**
 * Slot a single policy card into the tableau. If a slot already holds the same
 * card id, the card stacks onto it (stacks++) and consumes no new slot.
 * Otherwise it takes a free slot. Assumes the cap has already been checked by
 * the caller (enactPolicies validates the whole batch up front).
 */
function slotPolicyCard(epoch: Epoch, card: PolicyCard): void {
  const existing = epoch.policy.tableau.find((s) => s.card.id === card.id);
  if (existing) {
    existing.stacks += 1;
  } else {
    epoch.policy.tableau.push({ card, stacks: 1 });
  }
}

/** Push a candidate to its ideology's discard pile (it will cycle back later). */
function discardPolicyCard(epoch: Epoch, card: PolicyCard): void {
  epoch.policy.discards[card.ideology].push(card);
}

/**
 * Resolve the drawn-policy phase in one batch. `keepIds` is a MULTISET of
 * candidate ids to slot (stacking onto matching slots, taking free slots
 * otherwise); every candidate not consumed by a keep-id is discarded to its
 * ideology pile. Then candidates clear and the turn advances to the play phase.
 *
 * Per-copy semantics: two drawn copies of one id are kept independently. The
 * id's keep count in `keepIds` is how many of its drawn copies to slot, in
 * order; the rest are discarded. So `["mobilize"]` against two drawn Mobilize
 * keeps ONE and discards the other; `["mobilize","mobilize"]` keeps both (x2
 * stack).
 *
 * Validation (all-or-nothing — no mutation on reject):
 *  - must be in the policy phase;
 *  - `keepIds` must be a sub-multiset of the candidate ids (you cannot keep more
 *    copies of an id than were drawn, nor an id that was not drawn);
 *  - the cap counts DISTINCT kept ids not already slotted: reject when
 *    `tableau.length + distinctNew > 5`. Two kept copies of one id fill a single
 *    slot (one distinct), the extra copy stacks.
 */
export function enactPolicies(epoch: Epoch, keepIds: string[]): CmdResult<void> {
  const blocked = requirePolicyResolution(epoch);
  if (blocked) return blocked;

  const candidates = [...epoch.policy.candidates];

  // Validate keepIds is a sub-multiset of candidate ids: tally drawn copies per
  // id, then ensure each requested keep has a remaining copy to consume.
  const drawnCounts = new Map<string, number>();
  for (const c of candidates) {
    drawnCounts.set(c.id, (drawnCounts.get(c.id) ?? 0) + 1);
  }
  const keepCounts = new Map<string, number>();
  for (const id of keepIds) {
    keepCounts.set(id, (keepCounts.get(id) ?? 0) + 1);
  }
  for (const [id, want] of keepCounts) {
    if (want > (drawnCounts.get(id) ?? 0)) {
      return { ok: false, error: "Policy not among this turn's candidates." };
    }
  }

  // Cap counts DISTINCT kept ids not already slotted (each needs a fresh slot);
  // ids that already stack pay no slot. Two kept copies of one id = one distinct.
  if (!wouldFitInTableau(epoch.policy.tableau, keepCounts.keys())) {
    return {
      ok: false,
      error: `Too many policies for the tableau (${POLICY_SLOT_CAP} slots).`,
    };
  }

  // Consume keepIds as a multiset: iterate candidates in order — if the id has a
  // remaining keep count, slot it and decrement; otherwise discard it.
  const remaining = new Map(keepCounts);
  for (const card of candidates) {
    const left = remaining.get(card.id) ?? 0;
    if (left > 0) {
      remaining.set(card.id, left - 1);
      slotPolicyCard(epoch, card);
    } else {
      discardPolicyCard(epoch, card);
    }
  }
  epoch.policy.candidates = [];
  epoch.turnPhase = "play";
  return { ok: true, value: undefined };
}

/**
 * Remove a slotted policy from the tableau, returning one copy per stack to
 * that card's ideology discard pile so it cycles back into the deck later.
 */
export function removePolicy(epoch: Epoch, slotIndex: number): CmdResult<void> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  if (slotIndex < 0 || slotIndex >= epoch.policy.tableau.length) {
    return { ok: false, error: "Invalid policy slot." };
  }
  const [removed] = epoch.policy.tableau.splice(slotIndex, 1);
  const discard = epoch.policy.discards[removed.card.ideology];
  for (let i = 0; i < removed.stacks; i++) {
    discard.push(removed.card);
  }
  return { ok: true, value: undefined };
}
