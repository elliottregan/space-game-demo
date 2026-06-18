// Reactive bridge between the pure GameAPI and Vue components.

import { shallowRef, ref, type Ref, type ShallowRef } from "vue";
import { GameAPI, type CommandResult, type Snapshot } from "../facade/GameAPI.ts";
import type { SaveSlot } from "../facade/persistence.ts";
import type { Ideology, LegacyUpgrade } from "../core/types.ts";

class GameService {
  private api: GameAPI;

  snapshot: ShallowRef<Snapshot>;
  lastError: Ref<string | null>;
  endOfEpoch: ShallowRef<ReturnType<GameAPI["endOfEpochState"]>>;
  slots: ShallowRef<SaveSlot[]>;
  activeSlotId: Ref<string | null>;

  /** Cards currently staged in the commit buffer (card ids). */
  commitBuffer: Ref<string[]>;

  constructor(seed = 1) {
    this.api = new GameAPI(seed);
    this.snapshot = shallowRef(this.api.snapshot());
    this.lastError = ref<string | null>(null);
    this.endOfEpoch = shallowRef(this.api.endOfEpochState());
    this.slots = shallowRef(this.api.listSlots());
    this.activeSlotId = ref(this.api.activeSlotId());
    this.commitBuffer = ref<string[]>([]);
    // Ensure the current game has a slot.
    this.api.persist();
    this.reloadSlotList();
  }

  /**
   * Single command-dispatch chokepoint. Runs `fn`, surfaces any failure on
   * `lastError` (and clears it on success), then refreshes the snapshot ref and
   * persists exactly once. Every mutating command flows through here, so the
   * "mutate → reflect in Vue → save" sequence lives in one place.
   */
  private run<T>(fn: () => CommandResult<T>): CommandResult<T> {
    const r = fn();
    // An error persists until the next command (success clears it, another
    // failure replaces it) — no time-based auto-dismiss.
    this.lastError.value = r.ok ? null : r.error;
    this.refresh();
    return r;
  }

  /** Snapshot the API, persist once, and re-read the slot list into refs. */
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

  // Queries
  validColumns(cardId: string): number[] {
    return this.api.validColumns(cardId);
  }
  promotableIdeologies(columnIndex: number): Ideology[] {
    return this.api.promotableIdeologies(columnIndex);
  }

  // Commands
  placeCard(cardId: string, columnIndex: number): void {
    this.run(() => this.api.placeCard(cardId, columnIndex));
  }
  discardLand(columnIndex: number): void {
    this.run(() => this.api.discardLand(columnIndex));
  }
  recallInfluence(columnIndex: number): void {
    this.run(() => this.api.recallInfluence(columnIndex));
  }
  discardColumn(columnIndex: number): void {
    this.run(() => this.api.discardColumn(columnIndex));
  }
  discardFromHand(cardId: string): void {
    this.run(() => this.api.discardFromHand(cardId));
  }
  buildColumn(columnIndex: number, promote?: Ideology): void {
    this.run(() => this.api.buildColumn(columnIndex, promote));
  }
  storeCard(cardId: string, columnIndex: number, replaceId?: string): void {
    this.run(() => this.api.storeCard(cardId, columnIndex, replaceId));
  }
  placeFromStorage(cardId: string, columnIndex: number): void {
    this.run(() => this.api.placeFromStorage(cardId, columnIndex));
  }
  resolveCrisis(): void {
    this.run(() => this.api.resolveCrisis());
  }

  endTurn(): void {
    this.run(() => this.api.endTurn());
  }

  advanceEpoch(choices: Record<string, LegacyUpgrade>): void {
    this.run(() => this.api.advanceEpoch(choices));
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

  // -----------------------------------------------------------------------
  // Commit buffer — multi-card lay-down-hand flow
  // -----------------------------------------------------------------------

  toggleBufferCard(id: string): void {
    const buf = this.commitBuffer.value;
    const i = buf.indexOf(id);
    if (i >= 0) {
      this.commitBuffer.value = buf.filter((x) => x !== id);
    } else {
      this.commitBuffer.value = [...buf, id];
    }
  }

  clearBuffer(): void {
    this.commitBuffer.value = [];
  }

  commitToRow(columnIndex: number, row: "land" | "influence", fromStorageIds: string[] = []): void {
    const r = this.run(() =>
      this.api.commitHand(columnIndex, row, [...this.commitBuffer.value], fromStorageIds),
    );
    if (r.ok) this.clearBuffer();
  }

  // -----------------------------------------------------------------------
  // Policy tableau — candidate draw + slotting
  // -----------------------------------------------------------------------

  /** Resolve the drawn-policy phase in one batch: keep the named candidate ids
   *  (stacking onto matching slots), discard the rest, advance to play. */
  enactPolicies(keepIds: string[]): CommandResult {
    return this.run(() => this.api.enactPolicies(keepIds));
  }
  removePolicy(slotIndex: number): void {
    this.run(() => this.api.removePolicy(slotIndex));
  }

  // -----------------------------------------------------------------------
  // Crisis Tree — active objective selection
  // -----------------------------------------------------------------------

  /** Select an available Crisis Tree node as the active objective. For a
   *  requireSameIdeology (Doctrine) node, `ideology` binds the counted color. */
  setActiveObjective(nodeId: string, ideology?: Ideology): void {
    this.run(() => this.api.setActiveObjective(nodeId, ideology));
  }
}

let instance: GameService | null = null;

export function getGameService(): GameService {
  if (!instance) instance = new GameService(1);
  return instance;
}

export type { GameService };
