// Facade between core and renderer. Redesigned for column-based play.

import {
  createCampaign,
  prepareEndOfEpoch,
  finalizeEpoch,
  type EndOfEpochState,
} from "../core/engine/campaign.ts";
import { createEpoch, currentVector } from "../core/engine/epoch.ts";
import {
  buildColumn as buildColumnCore,
  commitHand as commitHandCore,
  discardColumn as discardColumnCore,
  discardFromHand as discardFromHandCore,
  discardLand as discardLandCore,
  enactPolicies as enactPoliciesCore,
  placeCard as placeCardCore,
  recallInfluence as recallInfluenceCore,
  removePolicy as removePolicyCore,
  storeCard as storeCardCore,
} from "../core/engine/commands.ts";
import { endTurn as endTurnCore, resolveCrisis as resolveCrisisCore } from "../core/engine/turn.ts";
import { createRng, type RNG } from "../core/engine/rng.ts";
import { getSetting } from "../core/settings/index.ts";
import {
  addNewSlot,
  deleteSlot as deleteSlotInStore,
  getActiveSlot,
  loadStore,
  switchSlot,
  upsertActiveSlot,
  writeStore,
  type SaveSlot,
  type SavedState,
} from "./persistence.ts";
import type {
  Campaign,
  Card,
  Column,
  EffectiveRules,
  Epoch,
  Ideology,
  IdeologyVector,
  LegacyUpgrade,
  PolicyState,
  Setting,
  TurnPhase,
} from "../core/types.ts";
import { demonym, demonymName } from "../core/engine/ideology.ts";
import { canPlaceInfluence, canPlaceLand } from "../core/engine/column.ts";
import { evaluateColumn } from "../core/engine/columnPatterns.ts";
import { countDissentInDeck } from "../core/engine/effects.ts";
import { effectiveRules } from "../core/engine/effectiveRules.ts";
import { ideologyInfluence, presentIdeologies } from "../core/data/projects.ts";

export interface Snapshot {
  campaign: Campaign;
  setting: Setting;
  epoch: Epoch;
  /** Sub-phase of the current turn (mirrors `epoch.turnPhase`). Only meaningful
   *  while `epoch.phase === "play"`; the renderer reads it to gate board UI. */
  turnPhase: TurnPhase;
  vector: IdeologyVector;
  demonymLabel: string;
  deckCounts: { hand: number; draw: number; discard: number; dissent: number };
  columnBuildable: boolean[]; // parallel to epoch.columns
  policy: PolicyState; // deep-cloned policy engine state
  effective: EffectiveRules; // setting rules folded through the policy tableau
  influence: Record<Ideology, number>; // majority-counter tally per ideology
}

export type CommandResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export class GameAPI {
  private campaign: Campaign;
  private setting: Setting;
  private epoch: Epoch;
  private rng: RNG;

  private endOfEpoch: EndOfEpochState | null = null;

  constructor(seed = 1, opts: { skipLoad?: boolean; forceSettingId?: string } = {}) {
    const store = opts.skipLoad ? null : loadStore();
    const active = store ? getActiveSlot(store) : null;
    if (active) {
      const saved = active.state;
      this.campaign = saved.campaign;
      this.setting = getSetting(saved.settingId);
      this.epoch = saved.epoch;
      // Defensive: a v6 save predating `turnPhase` would otherwise load
      // `undefined` and lock the board (every verb gated off the play phase).
      if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
      // Defensive: runs AFTER migrateV6toV7's projectMajority backfill — only
      // fills a STILL-undefined promotedIdeology (hand-edit / migrator-skipped)
      // to null, never overwriting a migrator-set real null. Keeps
      // ideologyInfluence from doing out[undefined] += n ⇒ NaN.
      for (const u of this.epoch.unlockedProjects) {
        if (u.promotedIdeology === undefined) u.promotedIdeology = null;
      }
      this.endOfEpoch = saved.endOfEpoch;
      this.rng = createRng(saved.seed);
    } else {
      this.campaign = createCampaign(seed);
      // Test/debug knob: skip Homeworld and start at a specific Setting.
      if (opts.forceSettingId) this.campaign.currentSettingId = opts.forceSettingId;
      this.setting = getSetting(this.campaign.currentSettingId);
      this.rng = createRng(seed);
      this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
    }
  }

  /** Serialize current state for persistence. */
  exportState(): SavedState {
    return {
      version: 7,
      campaign: this.campaign,
      settingId: this.setting.id,
      epoch: this.epoch,
      endOfEpoch: this.endOfEpoch,
      seed: this.campaign.seed,
    };
  }

  persist(): void {
    const store = loadStore();
    const next = upsertActiveSlot(store, this.exportState());
    writeStore(next);
  }

  /** List all save slots (newest last). */
  listSlots(): SaveSlot[] {
    return loadStore().slots;
  }

  /** Id of the currently active save slot, if any. */
  activeSlotId(): string | null {
    return loadStore().activeSlotId;
  }

  /** Switch to a different saved slot and load its state. Returns true on success. */
  switchSlot(slotId: string): boolean {
    // Persist current state to current slot first.
    this.persist();
    const store = loadStore();
    if (!store.slots.some((s) => s.id === slotId)) return false;
    const updated = switchSlot(store, slotId);
    writeStore(updated);
    const slot = getActiveSlot(updated);
    if (!slot) return false;
    this.loadFromState(slot.state);
    return true;
  }

  /** Create a new campaign in a new slot and make it active. */
  newCampaignSlot(seed = Date.now()): void {
    // Persist current state first so nothing is lost.
    this.persist();
    this.campaign = createCampaign(seed);
    this.setting = getSetting(this.campaign.currentSettingId);
    this.rng = createRng(seed);
    this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
    this.endOfEpoch = null;
    const store = loadStore();
    const updated = addNewSlot(store, this.exportState());
    writeStore(updated);
  }

  deleteSlot(slotId: string): void {
    const store = loadStore();
    const updated = deleteSlotInStore(store, slotId);
    writeStore(updated);
    // If the active slot was deleted, reload from (new) active slot or start fresh.
    if (store.activeSlotId === slotId) {
      const active = getActiveSlot(updated);
      if (active) {
        this.loadFromState(active.state);
      } else {
        this.campaign = createCampaign(Date.now());
        this.setting = getSetting(this.campaign.currentSettingId);
        this.rng = createRng(this.campaign.seed);
        this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
        this.endOfEpoch = null;
      }
    }
  }

  private loadFromState(state: SavedState): void {
    this.campaign = state.campaign;
    this.setting = getSetting(state.settingId);
    this.epoch = state.epoch;
    // Defensive: an older dev save may predate `turnPhase`.
    // Default it to "play" so a loaded epoch is immediately interactive.
    if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
    // Defensive: runs AFTER migrateV6toV7's projectMajority backfill — only
    // fills a STILL-undefined promotedIdeology (hand-edit / migrator-skipped)
    // to null, never overwriting a migrator-set real null. Keeps
    // ideologyInfluence from doing out[undefined] += n ⇒ NaN.
    for (const u of this.epoch.unlockedProjects) {
      if (u.promotedIdeology === undefined) u.promotedIdeology = null;
    }
    this.endOfEpoch = state.endOfEpoch;
    this.rng = createRng(state.seed);
  }

  // -----------------------------------------------------------------------

  snapshot(): Snapshot {
    const vector = currentVector(this.epoch, this.setting);
    const { dissent } = countDissentInDeck(this.epoch);
    const columnsView: Column[] = this.epoch.columns.map((c) => ({
      lands: { cards: [...c.lands.cards] },
      influence: { cards: c.influence.cards.map((card) => ({ ...card })) },
      storage: [...c.storage],
    }));
    const columnBuildable = columnsView.map(
      (c) => evaluateColumn(c, this.setting.projects) !== null,
    );
    const policyView = this.clonePolicy();
    const epochView: Epoch = {
      ...this.epoch,
      hand: [...this.epoch.hand],
      draw: [...this.epoch.draw],
      discard: [...this.epoch.discard],
      columns: columnsView,
      unlockedProjects: [...this.epoch.unlockedProjects],
      eventLog: [...this.epoch.eventLog],
      endOfTurnQueue: [...this.epoch.endOfTurnQueue],
      crisis: {
        status: this.epoch.crisis.status,
        outcome: this.epoch.crisis.outcome,
      },
      policy: policyView,
    };
    return {
      campaign: {
        ...this.campaign,
        monuments: [...this.campaign.monuments],
        legacyCards: [...this.campaign.legacyCards],
        epochHistory: [...this.campaign.epochHistory],
      },
      setting: this.setting,
      epoch: epochView,
      turnPhase: this.epoch.turnPhase,
      vector,
      demonymLabel: demonymName(demonym(vector)),
      deckCounts: {
        hand: this.epoch.hand.length,
        draw: this.epoch.draw.length,
        discard: this.epoch.discard.length,
        dissent,
      },
      columnBuildable,
      policy: policyView,
      effective: effectiveRules(this.epoch, this.setting),
      influence: ideologyInfluence(this.epoch.unlockedProjects),
    };
  }

  /** Deep-clone the policy engine state so shallowRef sees fresh references
   *  after every mutation (same discipline as the rest of snapshot). */
  private clonePolicy(): PolicyState {
    const p = this.epoch.policy;
    const cloneDeckMap = (m: PolicyState["decks"]): PolicyState["decks"] => ({
      solidarity: [...m.solidarity],
      sovereignty: [...m.sovereignty],
      transformation: [...m.transformation],
      heritage: [...m.heritage],
    });
    return {
      decks: cloneDeckMap(p.decks),
      discards: cloneDeckMap(p.discards),
      tableau: p.tableau.map((s) => ({ card: s.card, stacks: s.stacks })),
      candidates: [...p.candidates],
    };
  }

  /** Indices of columns where the given hand card could be placed. */
  validColumns(cardId: string): number[] {
    const card = this.epoch.hand.find((c) => c.id === cardId);
    if (!card) return [];
    const out: number[] = [];
    for (let i = 0; i < this.epoch.columns.length; i++) {
      const col = this.epoch.columns[i];
      if (canPlaceLand(col, card)) out.push(i);
      else if (canPlaceInfluence(col, card)) out.push(i);
    }
    return out;
  }

  endOfEpochState(): EndOfEpochState | null {
    return this.endOfEpoch;
  }

  placeCard(cardId: string, columnIndex: number): CommandResult<Card> {
    const r = placeCardCore(this.epoch, this.campaign, this.setting, cardId, columnIndex, this.rng);
    return r.ok ? { ok: true, value: r.card } : r;
  }

  discardLand(columnIndex: number): CommandResult<Card> {
    return discardLandCore(this.epoch, columnIndex, this.rng);
  }
  recallInfluence(columnIndex: number): CommandResult<Card[]> {
    return recallInfluenceCore(this.epoch, columnIndex, this.rng);
  }
  discardColumn(columnIndex: number): CommandResult<void> {
    return discardColumnCore(this.epoch, columnIndex, this.rng);
  }
  discardFromHand(cardId: string): CommandResult<Card> {
    return discardFromHandCore(this.epoch, cardId, this.rng);
  }
  buildColumn(
    columnIndex: number,
    promote?: Ideology,
  ): CommandResult<{ projectId: string; pattern: string; promotedIdeology: Ideology | null }> {
    const r = buildColumnCore(this.epoch, this.setting, columnIndex, this.rng, promote);
    return r.ok
      ? {
          ok: true,
          value: {
            projectId: r.value.projectId,
            pattern: r.value.pattern,
            promotedIdeology: r.value.promotedIdeology,
          },
        }
      : r;
  }

  /** The promotable ideologies for a column at Build: the non-wild colors of the
   *  column's evaluated pattern cards. [] when the column is not buildable or is
   *  all-wild. The renderer uses this to decide whether to open the picker. */
  promotableIdeologies(columnIndex: number): Ideology[] {
    const col = this.epoch.columns[columnIndex];
    if (!col) return [];
    const match = evaluateColumn(col, this.setting.projects);
    if (!match) return [];
    return presentIdeologies(match.cards);
  }

  storeCard(cardId: string, columnIndex: number, replaceId?: string): CommandResult<Card> {
    return storeCardCore(this.epoch, this.setting, cardId, columnIndex, this.rng, replaceId);
  }

  placeFromStorage(cardId: string, columnIndex: number): CommandResult<Card> {
    const r = placeCardCore(
      this.epoch,
      this.campaign,
      this.setting,
      cardId,
      columnIndex,
      this.rng,
      "storage",
    );
    return r.ok ? { ok: true, value: r.card } : r;
  }

  commitHand(
    columnIndex: number,
    row: "land" | "influence",
    cardIds: string[],
    fromStorageIds: string[] = [],
  ): CommandResult<Card[]> {
    return commitHandCore(this.epoch, columnIndex, row, cardIds, this.rng, fromStorageIds);
  }

  /**
   * Resolve the drawn-policy phase in one batch: keep the named candidate ids
   * (stacking onto matching slots, taking free slots otherwise), discard the
   * rest to their ideology piles, then advance to the play phase. Rejects when
   * not in the policy phase, when a kept id is not a candidate, or when the
   * distinct new slots would exceed the 5-slot cap.
   */
  enactPolicies(keepIds: string[]): CommandResult {
    return enactPoliciesCore(this.epoch, keepIds);
  }

  /** Remove a slotted policy from the tableau, cycling it to its discard. */
  removePolicy(slotIndex: number): CommandResult {
    return removePolicyCore(this.epoch, slotIndex);
  }

  endTurn(): CommandResult {
    if (this.epoch.turnPhase !== "play") {
      return { ok: false, error: "Resolve drawn policies first." };
    }
    endTurnCore(this.epoch, this.campaign, this.setting, this.rng);
    this.maybeEnterCrisis();
    return { ok: true, value: undefined };
  }

  resolveCrisis(): CommandResult {
    if (this.epoch.phase !== "crisis") return { ok: false, error: "Not in crisis." };
    resolveCrisisCore(this.epoch, this.setting);
    this.maybeEndEpoch();
    return { ok: true, value: undefined };
  }

  private maybeEnterCrisis(): void {
    // Phase changes are driven by core; this hook left in case the renderer
    // wants to react synchronously.
  }

  private maybeEndEpoch(): void {
    if (this.epoch.status.kind !== "in-progress" && this.endOfEpoch === null) {
      this.endOfEpoch = prepareEndOfEpoch(this.epoch, this.setting, this.campaign);
    }
  }

  advanceEpoch(
    upgradeChoices: Record<string, LegacyUpgrade>,
  ): CommandResult<"next" | "campaign-end"> {
    if (!this.endOfEpoch) return { ok: false, error: "Epoch is still in progress." };
    const result = finalizeEpoch(
      this.epoch,
      this.setting,
      this.campaign,
      this.endOfEpoch,
      upgradeChoices,
    );
    this.endOfEpoch = null;
    if (result.kind === "campaign-end") return { ok: true, value: "campaign-end" };
    this.epoch = result.epoch;
    this.setting = result.setting;
    return { ok: true, value: "next" };
  }

  /** Replace the active slot with a fresh campaign (keeps other slots). */
  resetCampaign(seed = Date.now()): void {
    this.campaign = createCampaign(seed);
    this.setting = getSetting(this.campaign.currentSettingId);
    this.rng = createRng(seed);
    this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
    this.endOfEpoch = null;
    this.persist();
  }
}
