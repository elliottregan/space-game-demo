// Reactive bridge between the pure GameAPI and Vue components.

import { shallowRef, ref, type Ref, type ShallowRef } from "vue";
import { GameAPI, type Snapshot } from "../facade/GameAPI.ts";
import type { Card } from "../core/types.ts";

class GameService {
  private api: GameAPI;

  snapshot: ShallowRef<Snapshot>;
  lastError: Ref<string | null>;
  endOfEpoch: ShallowRef<ReturnType<GameAPI["endOfEpochState"]>>;

  constructor(seed = 1) {
    this.api = new GameAPI(seed);
    this.snapshot = shallowRef(this.api.snapshot());
    this.lastError = ref<string | null>(null);
    this.endOfEpoch = shallowRef(this.api.endOfEpochState());
  }

  private refresh(): void {
    this.snapshot.value = this.api.snapshot();
    this.endOfEpoch.value = this.api.endOfEpochState();
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

  validSlots(cardId: string): number[] {
    return this.api.validSlots(cardId);
  }

  canRetrieve(slotIndex: number): boolean {
    return this.api.canRetrieve(slotIndex);
  }

  landProduction(): number {
    return this.api.landProductionPerTurn();
  }

  // Commands
  playCard(cardId: string, slotIndex: number): void {
    const r = this.api.playCard(cardId, slotIndex);
    this.report(r as any);
    this.refresh();
  }

  retrieve(slotIndex: number): void {
    const r = this.api.retrieveFromTableau(slotIndex);
    this.report(r as any);
    this.refresh();
  }

  playMegaStructure(projectId: string): void {
    const r = this.api.playMegaStructure(projectId);
    this.report(r as any);
    this.refresh();
  }

  purgeDissent(): void {
    const r = this.api.purgeOneDissent();
    this.report(r as any);
    this.refresh();
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
}

let instance: GameService | null = null;

export function getGameService(): GameService {
  if (!instance) instance = new GameService(1);
  return instance;
}

export type { GameService };
