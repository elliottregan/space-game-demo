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
  effectiveInfluenceCost,
  endTurn as endTurnCore,
  playCard as playCardCore,
  playMegaStructure as playMegaStructureCore,
  purgeDissent,
  retrieveFromTableau as retrieveCore,
} from "../core/epoch.ts";
import { createRng, type RNG } from "../core/rng.ts";
import { getSetting } from "../core/settings.ts";
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

  constructor(seed = 1) {
    this.campaign = createCampaign(seed);
    this.setting = getSetting(this.campaign.currentSettingId);
    this.rng = createRng(seed);
    this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
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

  playMegaStructure(projectId: string): CommandResult<{ tier: string; score: number }> {
    const r = playMegaStructureCore(this.epoch, this.setting, projectId);
    if (!r.ok) return r;
    this.maybeEndEpoch();
    return { ok: true, value: { tier: r.tier, score: r.score } };
  }

  purgeOneDissent(): CommandResult<number> {
    if (this.epoch.materials < 5) return { ok: false, error: "Need 5 Materials to purge." };
    this.epoch.materials -= 5;
    const purged = purgeDissent(this.epoch, 1);
    return { ok: true, value: purged };
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

  resetCampaign(seed = Date.now()): void {
    this.campaign = createCampaign(seed);
    this.setting = getSetting(this.campaign.currentSettingId);
    this.rng = createRng(seed);
    this.epoch = createEpoch(this.setting, this.campaign, this.rng, 1);
    this.endOfEpoch = null;
  }
}

export { checkAlignment, describeRequirement, canPlaceLand, canPlaceTopper, isImproved };
