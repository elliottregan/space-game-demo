// Multi-slot save store in localStorage.
// Up to 10 saves; each is the full serialized game state.

import type { Campaign, Epoch } from "../core/types.ts";
import type { EndOfEpochState } from "../core/campaign.ts";

const STORE_KEY = "deck-demo-saves-v2";
const LEGACY_KEY = "deck-demo-save-v1";

export const MAX_SLOTS = 10;

export interface SavedState {
  version: 1;
  campaign: Campaign;
  settingId: string;
  epoch: Epoch;
  endOfEpoch: EndOfEpochState | null;
  seed: number;
}

export interface SaveSlot {
  id: string;
  label: string;
  createdAt: number;
  lastPlayedAt: number;
  state: SavedState;
}

export interface SaveStore {
  version: 2;
  activeSlotId: string | null;
  slots: SaveSlot[]; // newest-last ordering
}

function emptyStore(): SaveStore {
  return { version: 2, activeSlotId: null, slots: [] };
}

export function loadStore(): SaveStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveStore;
      if (parsed.version === 2 && Array.isArray(parsed.slots)) return parsed;
    }
    // Migration from v1 single-save.
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as SavedState;
      if (legacy.version === 1) {
        const slot: SaveSlot = {
          id: newSlotId(),
          label: labelFromState(legacy),
          createdAt: Date.now(),
          lastPlayedAt: Date.now(),
          state: legacy,
        };
        const store: SaveStore = { version: 2, activeSlotId: slot.id, slots: [slot] };
        writeStore(store);
        localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch {
    // corrupted — start fresh
  }
  return emptyStore();
}

export function writeStore(store: SaveStore): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function newSlotId(): string {
  return "slot-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

export function labelFromState(state: SavedState): string {
  const ep = state.epoch.epochNumber;
  const turn = state.epoch.turn;
  const setting = state.settingId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `E${ep} · ${setting} · T${turn}`;
}

// -------------------------------------------------------------------------
// Slot CRUD
// -------------------------------------------------------------------------

export function getActiveSlot(store: SaveStore): SaveSlot | null {
  if (!store.activeSlotId) return null;
  return store.slots.find((s) => s.id === store.activeSlotId) ?? null;
}

export function upsertActiveSlot(store: SaveStore, state: SavedState): SaveStore {
  if (!store.activeSlotId) {
    return addNewSlot(store, state);
  }
  const idx = store.slots.findIndex((s) => s.id === store.activeSlotId);
  if (idx === -1) {
    return addNewSlot(store, state);
  }
  const slot = store.slots[idx]!;
  store.slots[idx] = {
    ...slot,
    state,
    label: labelFromState(state),
    lastPlayedAt: Date.now(),
  };
  return store;
}

/** Add a new slot (evicts oldest if over MAX_SLOTS) and set it active. */
export function addNewSlot(store: SaveStore, state: SavedState): SaveStore {
  const slot: SaveSlot = {
    id: newSlotId(),
    label: labelFromState(state),
    createdAt: Date.now(),
    lastPlayedAt: Date.now(),
    state,
  };
  const slots = [...store.slots, slot];
  while (slots.length > MAX_SLOTS) slots.shift();
  return { ...store, slots, activeSlotId: slot.id };
}

export function switchSlot(store: SaveStore, id: string): SaveStore {
  if (!store.slots.some((s) => s.id === id)) return store;
  return { ...store, activeSlotId: id };
}

export function deleteSlot(store: SaveStore, id: string): SaveStore {
  const slots = store.slots.filter((s) => s.id !== id);
  const activeSlotId =
    store.activeSlotId === id ? (slots[slots.length - 1]?.id ?? null) : store.activeSlotId;
  return { ...store, slots, activeSlotId };
}

export function clearStore(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}
