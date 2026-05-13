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
  discardCharter as discardCharterCore,
  discardColumn as discardColumnCore,
  discardFromHand as discardFromHandCore,
  discardLand as discardLandCore,
  placeCard as placeCardCore,
  recallInfluence as recallInfluenceCore,
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
import type { Campaign, Card, Column, Epoch, IdeologyVector, Setting } from "../core/types.ts";
import { demonym, demonymName } from "../core/engine/ideology.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand } from "../core/engine/column.ts";
import { evaluateColumn } from "../core/engine/columnPatterns.ts";
import { landMaterialProduction } from "../core/data/cards.ts";
import { unlockedIdeologyBreakdown } from "../core/data/projects.ts";

export interface Snapshot {
  campaign: Campaign;
  setting: Setting;
  epoch: Epoch;
  vector: IdeologyVector;
  demonymLabel: string;
  deckCounts: { hand: number; draw: number; discard: number; dissent: number };
  ideologyBreakdown: Record<"solidarity" | "sovereignty" | "transformation" | "heritage", number>;
  columnBuildable: boolean[]; // parallel to epoch.columns
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
      version: 3,
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
    this.endOfEpoch = state.endOfEpoch;
    this.rng = createRng(state.seed);
  }

  // -----------------------------------------------------------------------

  snapshot(): Snapshot {
    const vector = currentVector(this.epoch, this.setting);
    const dis = this.epoch.hand
      .concat(this.epoch.draw, this.epoch.discard)
      .filter((c) => c.tags.includes("dissent")).length;
    const columnsView: Column[] = this.epoch.columns.map((c) => ({
      lands: { cards: [...c.lands.cards] },
      influence: { card: c.influence.card },
      charter: { card: c.charter.card },
    }));
    const columnBuildable = columnsView.map(
      (c) => evaluateColumn(c, this.setting.projects) !== null,
    );
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
    };
    return {
      campaign: {
        ...this.campaign,
        monuments: [...this.campaign.monuments],
        legacyCards: [...this.campaign.legacyCards],
        terrain: { ...this.campaign.terrain },
        epochHistory: [...this.campaign.epochHistory],
      },
      setting: this.setting,
      epoch: epochView,
      vector,
      demonymLabel: demonymName(demonym(vector)),
      deckCounts: {
        hand: this.epoch.hand.length,
        draw: this.epoch.draw.length,
        discard: this.epoch.discard.length,
        dissent: dis,
      },
      ideologyBreakdown: unlockedIdeologyBreakdown(this.epoch.unlockedProjects),
      columnBuildable,
    };
  }

  /** Indices of columns where the given hand card could be placed. */
  validColumns(cardId: string): number[] {
    const card = this.epoch.hand.find((c) => c.id === cardId);
    if (!card) return [];
    const out: number[] = [];
    for (let i = 0; i < this.epoch.columns.length; i++) {
      const col = this.epoch.columns[i];
      if (card.kind === "land" && canPlaceLand(col, card)) out.push(i);
      else if (card.kind === "role" && canPlaceInfluence(col, card)) out.push(i);
      else if (card.kind === "charter" && canPlaceCharter(col, card)) out.push(i);
    }
    return out;
  }

  landProductionPerTurn(): number {
    let total = 0;
    for (const col of this.epoch.columns) {
      for (const l of col.lands.cards) total += landMaterialProduction(l.rank);
    }
    return total;
  }

  endOfEpochState(): EndOfEpochState | null {
    return this.endOfEpoch;
  }

  placeCard(cardId: string, columnIndex: number): CommandResult<Card> {
    const r = placeCardCore(this.epoch, this.campaign, this.setting, cardId, columnIndex, this.rng);
    return r.ok ? { ok: true, value: r.card } : r;
  }

  discardLand(columnIndex: number): CommandResult<Card> {
    return discardLandCore(this.epoch, columnIndex);
  }
  discardCharter(columnIndex: number): CommandResult<Card> {
    return discardCharterCore(this.epoch, columnIndex);
  }
  recallInfluence(columnIndex: number): CommandResult<Card> {
    return recallInfluenceCore(this.epoch, columnIndex);
  }
  discardColumn(columnIndex: number): CommandResult<void> {
    return discardColumnCore(this.epoch, columnIndex);
  }
  discardFromHand(cardId: string): CommandResult<Card> {
    return discardFromHandCore(this.epoch, cardId);
  }
  buildColumn(columnIndex: number): CommandResult<{ projectId: string; pattern: string }> {
    const r = buildColumnCore(this.epoch, this.setting, columnIndex);
    return r.ok
      ? { ok: true, value: { projectId: r.value.projectId, pattern: r.value.pattern } }
      : r;
  }

  endTurn(): CommandResult {
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
    upgradeChoices: Record<string, "potency" | "pliability" | "persistence">,
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
