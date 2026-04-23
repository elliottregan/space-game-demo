// Facade between core and renderer. Redesigned for tableau-based play.

import {
  createCampaign,
  prepareEndOfEpoch,
  finalizeEpoch,
  type EndOfEpochState,
} from "../core/campaign.ts";
import {
  createEpoch,
  currentVector,
  discardForMaterial as discardForMaterialCore,
  effectiveInfluenceCost,
  endTurn as endTurnCore,
  playCard as playCardCore,
  playMegaStructure as playMegaStructureCore,
  retrieveFromTableau as retrieveCore,
} from "../core/epoch.ts";
import { createRng, type RNG } from "../core/rng.ts";
import { getSetting } from "../core/settings.ts";
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
  type SaveStore,
} from "./persistence.ts";
import type { Campaign, Card, Epoch, IdeologyVector, Setting, TableauSlot } from "../core/types.ts";
import { checkAlignment, demonym, demonymName } from "../core/ideology.ts";
import {
  describeRequirement,
  evaluateMegaStructure,
  type MegaStructureEval,
} from "../core/patterns.ts";
import {
  canPlaceLand,
  canPlaceTopper,
  isImproved,
  validSlotsForCard as validSlotsForCardCore,
} from "../core/tableau.ts";
import { landMaterialProduction } from "../core/cards.ts";

export interface ProjectProgress {
  projectId: string;
  evaluation: MegaStructureEval;
}

export interface Snapshot {
  campaign: Campaign;
  setting: Setting;
  epoch: Epoch;
  vector: IdeologyVector;
  demonymLabel: string;
  projectProgress: ProjectProgress[];
  deckCounts: { hand: number; draw: number; discard: number; dissent: number };
}

export type CommandResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export class GameAPI {
  private campaign: Campaign;
  private setting: Setting;
  private epoch: Epoch;
  private rng: RNG;

  private endOfEpoch: EndOfEpochState | null = null;

  constructor(seed = 1, opts: { skipLoad?: boolean } = {}) {
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
      this.setting = getSetting(this.campaign.currentSettingId);
      this.rng = createRng(seed);
      this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
    }
  }

  /** Serialize current state for persistence. */
  exportState(): SavedState {
    return {
      version: 1,
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
    const slot = getActiveSlot(updated)!;
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
    const vector = currentVector(this.epoch, this.campaign);
    const dis = this.epoch.hand
      .concat(this.epoch.draw, this.epoch.discard)
      .filter((c) => c.tags.includes("dissent")).length;
    const projectProgress = this.setting.megaProjects.map((p) => ({
      projectId: p.id,
      evaluation: evaluateMegaStructure(p, this.epoch.hand),
    }));
    const epochView: Epoch = {
      ...this.epoch,
      hand: [...this.epoch.hand],
      draw: this.epoch.draw,
      discard: [...this.epoch.discard],
      tableau: this.epoch.tableau.map((s) => ({ lands: [...s.lands], topper: s.topper })),
      taskProgress: { ...this.epoch.taskProgress },
      tasksRevealed: [...this.epoch.tasksRevealed],
      eventLog: [...this.epoch.eventLog],
      endOfTurnQueue: [...this.epoch.endOfTurnQueue],
    };
    const campaignView = {
      ...this.campaign,
      monuments: [...this.campaign.monuments],
      legacyCards: [...this.campaign.legacyCards],
      terrain: { ...this.campaign.terrain },
      epochHistory: [...this.campaign.epochHistory],
    };
    return {
      campaign: campaignView,
      setting: this.setting,
      epoch: epochView,
      vector,
      demonymLabel: demonymName(demonym(vector)),
      projectProgress,
      deckCounts: {
        hand: this.epoch.hand.length,
        draw: this.epoch.draw.length,
        discard: this.epoch.discard.length,
        dissent: dis,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getEffectiveCost(card: Card): number {
    const vector = currentVector(this.epoch, this.campaign);
    return effectiveInfluenceCost(card, vector);
  }

  getAlignment(card: Card): "aligned" | "opposed" | "neutral" {
    const vector = currentVector(this.epoch, this.campaign);
    return checkAlignment(card, vector);
  }

  /** Return valid tableau slot indices for a given card in hand. */
  validSlots(cardId: string): number[] {
    const card = this.epoch.hand.find((c) => c.id === cardId);
    if (!card) return [];
    return validSlotsForCardCore(this.epoch, card).map((s) => s.index);
  }

  canRetrieve(slotIndex: number): boolean {
    const slot = this.epoch.tableau[slotIndex];
    if (!slot) return false;
    return slot.topper !== null || slot.lands.length > 0;
  }

  landProductionPerTurn(): number {
    let total = 0;
    for (const slot of this.epoch.tableau) {
      for (const l of slot.lands) total += landMaterialProduction(l.rank);
    }
    return total;
  }

  endOfEpochState(): EndOfEpochState | null {
    return this.endOfEpoch;
  }

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  playCard(cardId: string, slotIndex: number): CommandResult<Card> {
    if (this.epoch.status.kind !== "in-progress") {
      return { ok: false, error: "Epoch ended." };
    }
    const r = playCardCore(this.epoch, this.campaign, this.setting, cardId, slotIndex, this.rng);
    if (!r.ok) return r;
    return { ok: true, value: r.card };
  }

  retrieveFromTableau(slotIndex: number): CommandResult<Card> {
    const r = retrieveCore(this.epoch, this.setting, slotIndex);
    if (!r.ok) return r;
    return { ok: true, value: r.card };
  }

  /** Cost to retrieve the topmost card of a slot (for UI display). */
  retrieveCost(slotIndex: number): { inf: number; mat: number } | null {
    const slot = this.epoch.tableau[slotIndex];
    if (!slot || (slot.topper === null && slot.lands.length === 0)) return null;
    const topmost = slot.topper ?? slot.lands[slot.lands.length - 1]!;
    const isLand = topmost.kind === "land";
    return {
      inf: this.setting.rules.retrieveInfluenceCost,
      mat: isLand ? this.setting.rules.retrieveLandMaterialCost : 0,
    };
  }

  discardForMaterial(cardId: string): CommandResult<{ gained: number }> {
    const r = discardForMaterialCore(this.epoch, this.setting, cardId);
    if (!r.ok) return r;
    return { ok: true, value: { gained: r.gained } };
  }

  playMegaStructure(projectId: string): CommandResult<{ tier: string; score: number }> {
    const r = playMegaStructureCore(this.epoch, this.setting, projectId);
    if (!r.ok) return r;
    this.maybeEndEpoch();
    return { ok: true, value: { tier: r.tier, score: r.score } };
  }

  endTurn(): CommandResult {
    endTurnCore(this.epoch, this.campaign, this.setting, this.rng);
    this.maybeEndEpoch();
    return { ok: true, value: undefined };
  }

  // -----------------------------------------------------------------------

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

export { checkAlignment, describeRequirement, canPlaceLand, canPlaceTopper, isImproved };
