// Reactive bridge between the pure GameAPI and Vue components.

import { shallowRef, ref, type Ref, type ShallowRef } from "vue";
import { GameAPI, type Snapshot } from "../facade/GameAPI.ts";
import type { Card } from "../core/types.ts";
import type { SaveSlot } from "../facade/persistence.ts";

class GameService {
  private api: GameAPI;

  snapshot: ShallowRef<Snapshot>;
  lastError: Ref<string | null>;
  endOfEpoch: ShallowRef<ReturnType<GameAPI["endOfEpochState"]>>;
  slots: ShallowRef<SaveSlot[]>;
  activeSlotId: Ref<string | null>;

  constructor(seed = 1) {
    this.api = new GameAPI(seed);
    this.snapshot = shallowRef(this.api.snapshot());
    this.lastError = ref<string | null>(null);
    this.endOfEpoch = shallowRef(this.api.endOfEpochState());
    this.slots = shallowRef(this.api.listSlots());
    this.activeSlotId = ref(this.api.activeSlotId());
    // Ensure the current game has a slot.
    this.api.persist();
    this.reloadSlotList();
  }

  private refresh(): void {
    this.snapshot.value = this.api.snapshot();
    this.endOfEpoch.value = this.api.endOfEpochState();
    this.api.persist();
    this.reloadSlotList();
  }

  private reloadSlotList(): void {
    this.slots.value = this.api.listSlots();
    this.activeSlotId.value = this.api.activeSlotId();
  }

  private report(r: { ok: boolean; error?: string }): void {
    if (!r.ok && r.error) {
      this.lastError.value = r.error;
      setTimeout(() => {
        if (this.lastError.value === r.error) this.lastError.value = null;
      }, 2500);
    } else {
      this.lastError.value = null;
    }
  }

  // Queries
  getEffectiveCost(card: Card): number {
    return this.api.getEffectiveCost(card);
  }

  getAlignment(card: Card): "aligned" | "opposed" | "neutral" {
    return this.api.getAlignment(card);
  }

  validColumns(cardId: string): number[] {
    return this.api.validColumns(cardId);
  }

  landProduction(): number {
    return this.api.landProductionPerTurn();
  }

  // Commands
  placeCard(cardId: string, columnIndex: number): void {
    const r = this.api.placeCard(cardId, columnIndex);
    this.report(r as any); this.refresh();
  }
  discardLand(columnIndex: number): void {
    const r = this.api.discardLand(columnIndex);
    this.report(r as any); this.refresh();
  }
  discardCharter(columnIndex: number): void {
    const r = this.api.discardCharter(columnIndex);
    this.report(r as any); this.refresh();
  }
  recallInfluence(columnIndex: number): void {
    const r = this.api.recallInfluence(columnIndex);
    this.report(r as any); this.refresh();
  }
  discardColumn(columnIndex: number): void {
    const r = this.api.discardColumn(columnIndex);
    this.report(r as any); this.refresh();
  }
  discardFromHand(cardId: string): void {
    const r = this.api.discardFromHand(cardId);
    this.report(r as any); this.refresh();
  }
  buildColumn(columnIndex: number): void {
    const r = this.api.buildColumn(columnIndex);
    this.report(r as any); this.refresh();
  }
  resolveCrisis(): void {
    const r = this.api.resolveCrisis();
    this.report(r as any); this.refresh();
  }

  endTurn(): void {
    const r = this.api.endTurn();
    this.report(r as any);
    this.refresh();
  }

  advanceEpoch(choices: Record<string, "potency" | "pliability" | "persistence">): void {
    const r = this.api.advanceEpoch(choices);
    this.report(r as any);
    this.refresh();
  }

  restart(seed?: number): void {
    this.api.resetCampaign(seed ?? Math.floor(Math.random() * 1e9));
    this.refresh();
  }

  switchSlot(id: string): void {
    this.api.switchSlot(id);
    this.refresh();
  }

  newCampaignSlot(): void {
    this.api.newCampaignSlot(Math.floor(Math.random() * 1e9));
    this.refresh();
  }

  deleteSlot(id: string): void {
    this.api.deleteSlot(id);
    this.refresh();
  }
}

let instance: GameService | null = null;

export function getGameService(): GameService {
  if (!instance) instance = new GameService(1);
  return instance;
}

export type { GameService };
