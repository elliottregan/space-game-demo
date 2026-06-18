// Multi-slot save store in localStorage.
// Up to 10 saves; each is the full serialized game state.

import type { Campaign, CrisisTree, CrisisTreeState, Epoch, ProjectUnlock } from "../core/types.ts";
import type { EndOfEpochState } from "../core/engine/campaign.ts";
import { projectMajority } from "../core/data/projects.ts";
import { getSetting } from "../core/settings/index.ts";

const STORE_KEY = "deck-demo-saves-v8";
const PREV_KEY = "deck-demo-saves-v7";
const ARCHIVE_KEY = "deck-demo-saves-v7-archive";
// The v6→v7 chain is preserved below loadStore so a still-untouched v6 store
// migrates all the way through v7 to v8 in one call.
const V6_KEY = "deck-demo-saves-v6";
const V6_ARCHIVE_KEY = "deck-demo-saves-v6-archive";

export const MAX_SLOTS = 10;

export interface SavedState {
  version: 8;
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
  version: 8;
  activeSlotId: string | null;
  slots: SaveSlot[];
}

function emptyStore(): SaveStore {
  return { version: 8, activeSlotId: null, slots: [] };
}

/** A default CrisisTreeState for an epoch that predates the Crisis Tree:
 *  active = root, nothing cleared, every node's progress zero-filled to its
 *  requirement count, no ideology bindings. Mirrors epoch.ts seedCrisisTreeState. */
function seedCrisisTreeStateFor(tree: CrisisTree): CrisisTreeState {
  const progress: Record<string, number[]> = {};
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    progress[nodeId] = node.requirements.map(() => 0);
  }
  return { activeNodeId: tree.rootId, cleared: [], progress, boundIdeology: {} };
}

/** In-place migrate a parsed v6 store to v7: strip the dead `charter` row from
 *  every column, and backfill each unlock's `promotedIdeology` via
 *  projectMajority (color choice faithful, magnitude rescaled to match a fresh
 *  run — NOT the pre-redesign flat-1 magnitude). Corrupt slots are dropped, not
 *  fatal; the whole call is wrapped in try/catch by loadStore. Returns the
 *  intermediate (v7) slots; migrateV7toV8 re-stamps the store version to 8. */
function migrateV6toV7(parsed: { activeSlotId: string | null; slots: unknown[] }): {
  activeSlotId: string | null;
  slots: SaveSlot[];
} {
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
      // Intermediate v7 stamp; migrateV7toV8 immediately re-stamps it to 8.
      (slot.state as { version: number }).version = 7;
      slots.push(slot);
    } catch {
      // drop the corrupt slot, keep migrating the rest
    }
  }
  const activeSlotId =
    parsed.activeSlotId && slots.some((s) => s.id === parsed.activeSlotId)
      ? parsed.activeSlotId
      : (slots[slots.length - 1]?.id ?? null);
  return { activeSlotId, slots };
}

/** Migrate a parsed v7 store to v8: backfill `crisisTree` onto every epoch that
 *  lacks it (predates P3), seeded from the slot's Setting's current crisisTree.
 *  Settings are re-resolved fresh via getSetting at load, so only the epoch blob
 *  needs touching — no Setting shape is stored. Corrupt slots are dropped, not
 *  fatal; the whole call is wrapped in try/catch by loadStore. */
function migrateV7toV8(parsed: { activeSlotId: string | null; slots: unknown[] }): SaveStore {
  const slots: SaveSlot[] = [];
  for (const rawSlot of parsed.slots) {
    try {
      const slot = rawSlot as SaveSlot;
      const epoch = slot.state.epoch as unknown as {
        crisisTree?: CrisisTreeState;
      };
      if (epoch.crisisTree === undefined) {
        const setting = getSetting(slot.state.settingId);
        epoch.crisisTree = seedCrisisTreeStateFor(setting.crisisTree);
      }
      slot.state.version = 8;
      slots.push(slot);
    } catch {
      // drop the corrupt slot, keep migrating the rest
    }
  }
  const activeSlotId =
    parsed.activeSlotId && slots.some((s) => s.id === parsed.activeSlotId)
      ? parsed.activeSlotId
      : (slots[slots.length - 1]?.id ?? null);
  return { version: 8, activeSlotId, slots };
}

export function loadStore(): SaveStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    // 1. Current v8 store — return as-is.
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveStore;
      if (parsed.version === 8 && Array.isArray(parsed.slots)) return parsed;
    }
    // 2. Previous v7 store — migrate to v8, persist, archive the raw string.
    const prevRaw = localStorage.getItem(PREV_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as {
        version?: number;
        activeSlotId: string | null;
        slots?: unknown[];
      };
      if (prev.version === 7 && Array.isArray(prev.slots)) {
        const migrated = migrateV7toV8(prev as { activeSlotId: string | null; slots: unknown[] });
        writeStore(migrated);
        localStorage.setItem(ARCHIVE_KEY, prevRaw); // raw, unmigrated v7
        localStorage.removeItem(PREV_KEY);
        return migrated;
      }
    }
    // 3. Legacy v6 store — migrate v6→v7→v8 in one pass, persist, archive raw v6.
    const v6Raw = localStorage.getItem(V6_KEY);
    if (v6Raw) {
      const v6 = JSON.parse(v6Raw) as {
        version?: number;
        activeSlotId: string | null;
        slots?: unknown[];
      };
      if (v6.version === 6 && Array.isArray(v6.slots)) {
        const v7 = migrateV6toV7(v6 as { activeSlotId: string | null; slots: unknown[] });
        const migrated = migrateV7toV8(v7);
        writeStore(migrated);
        localStorage.setItem(V6_ARCHIVE_KEY, v6Raw); // raw, unmigrated v6
        localStorage.removeItem(V6_KEY);
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
