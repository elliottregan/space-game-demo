// Multi-slot save store in localStorage.
// Up to 10 saves; each is the full serialized game state.

import type { Campaign, Epoch, ProjectUnlock } from "../core/types.ts";
import type { EndOfEpochState } from "../core/engine/campaign.ts";
import { projectMajority } from "../core/data/projects.ts";

const STORE_KEY = "deck-demo-saves-v7";
const PREV_KEY = "deck-demo-saves-v6";
const ARCHIVE_KEY = "deck-demo-saves-v6-archive";

export const MAX_SLOTS = 10;

export interface SavedState {
  version: 7;
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
  version: 7;
  activeSlotId: string | null;
  slots: SaveSlot[];
}

function emptyStore(): SaveStore {
  return { version: 7, activeSlotId: null, slots: [] };
}

/** In-place migrate a parsed v6 store to v7: strip the dead `charter` row from
 *  every column, and backfill each unlock's `promotedIdeology` via
 *  projectMajority (color choice faithful, magnitude rescaled to match a fresh
 *  run — NOT the pre-redesign flat-1 magnitude). Corrupt slots are dropped, not
 *  fatal; the whole call is wrapped in try/catch by loadStore. */
function migrateV6toV7(parsed: { activeSlotId: string | null; slots: unknown[] }): SaveStore {
  const slots: SaveSlot[] = [];
  for (const rawSlot of parsed.slots) {
    try {
      const slot = rawSlot as SaveSlot;
      const epoch = slot.state.epoch as unknown as {
        columns: Array<Record<string, unknown>>;
        unlockedProjects: Array<ProjectUnlock & { cards: unknown }>;
      };
      for (const col of epoch.columns ?? []) {
        delete col.charter;
      }
      for (const u of epoch.unlockedProjects ?? []) {
        if (u.promotedIdeology === undefined) {
          u.promotedIdeology = projectMajority((u.cards as ProjectUnlock["cards"]) ?? []);
        }
      }
      slot.state.version = 7;
      slots.push(slot);
    } catch {
      // drop the corrupt slot, keep migrating the rest
    }
  }
  const activeSlotId =
    parsed.activeSlotId && slots.some((s) => s.id === parsed.activeSlotId)
      ? parsed.activeSlotId
      : (slots[slots.length - 1]?.id ?? null);
  return { version: 7, activeSlotId, slots };
}

export function loadStore(): SaveStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    // 1. Current v7 store — return as-is.
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveStore;
      if (parsed.version === 7 && Array.isArray(parsed.slots)) return parsed;
    }
    // 2. Previous v6 store — migrate, persist under v7, archive the raw string.
    const prevRaw = localStorage.getItem(PREV_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as {
        version?: number;
        activeSlotId: string | null;
        slots?: unknown[];
      };
      if (prev.version === 6 && Array.isArray(prev.slots)) {
        const migrated = migrateV6toV7(prev as { activeSlotId: string | null; slots: unknown[] });
        writeStore(migrated);
        localStorage.setItem(ARCHIVE_KEY, prevRaw); // raw, unmigrated v6
        localStorage.removeItem(PREV_KEY);
        return migrated;
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
  if (!store.activeSlotId) return addNewSlot(store, state);
  const idx = store.slots.findIndex((s) => s.id === store.activeSlotId);
  if (idx === -1) return addNewSlot(store, state);
  const slot = store.slots[idx];
  store.slots[idx] = { ...slot, state, label: labelFromState(state), lastPlayedAt: Date.now() };
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
