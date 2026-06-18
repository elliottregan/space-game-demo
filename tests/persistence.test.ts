import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Card, Ideology } from "../src/core/data/cards.ts";
import { projectMajority } from "../src/core/data/projects.ts";
import { loadStore } from "../src/facade/persistence.ts";
import { GameAPI } from "../src/facade/GameAPI.ts";
import { getSetting } from "../src/core/settings/index.ts";

// C1: cards.ts has NO `land` export — define a local helper mirroring the
// other suites (column.test.ts) instead of importing a non-existent symbol.
const land = (rank: number, ideo: Ideology): Card => getCard(landId(rank, ideo));

// ---------------------------------------------------------------------------
// localStorage stub — Bun's test runtime has no `localStorage`, so without this
// loadStore() early-returns emptyStore() and the migrator is never exercised.
// ---------------------------------------------------------------------------
function installLocalStorage(): Map<string, string> {
  const map = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = stub;
  return map;
}

const V8_KEY = "deck-demo-saves-v8";
const V7_KEY = "deck-demo-saves-v7";
const V7_ARCHIVE_KEY = "deck-demo-saves-v7-archive";
const V6_KEY = "deck-demo-saves-v6";
const V6_ARCHIVE_KEY = "deck-demo-saves-v6-archive";

/** A minimal v6 save slot: one column with a charter row, two unlocks (one a
 *  solidarity-majority pair → migrates to "solidarity", one an all-wild/tie
 *  build → migrates to null). `promotedIdeology` is intentionally absent. */
function v6SaveStore() {
  const solPair = [land(2, "solidarity"), land(2, "solidarity"), land(3, "heritage")];
  // sanity: projectMajority(solPair) === "solidarity"
  return {
    version: 6,
    activeSlotId: "slot-a",
    slots: [
      {
        id: "slot-a",
        label: "E1 · Homeworld · T3",
        createdAt: 1,
        lastPlayedAt: 2,
        state: {
          version: 6,
          settingId: "homeworld",
          seed: 7,
          endOfEpoch: null,
          campaign: { seed: 7 },
          epoch: {
            columns: [
              {
                lands: { cards: [land(2, "solidarity")] },
                influence: { cards: [] },
                charter: { card: land(9, "solidarity") }, // dead field — must be deleted
                storage: [],
              },
            ],
            unlockedProjects: [
              { projectId: "p-sol", pattern: "pair", turn: 1, cards: solPair }, // → "solidarity"
              { projectId: "p-tie", pattern: "high-card", turn: 2, cards: [] }, // all-wild → null
            ],
          },
        },
      },
    ],
  };
}

let store: Map<string, string>;
beforeEach(() => {
  store = installLocalStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("persistence v6 → v7 migration", () => {
  test("migrates a v6 save: charter dropped, promotedIdeology backfilled, version 7", () => {
    store.set(V6_KEY, JSON.stringify(v6SaveStore()));

    const migrated = loadStore();

    expect(migrated.version).toBe(8);
    expect(migrated.slots).toHaveLength(1);
    const slot = migrated.slots[0];
    expect(slot.state.version).toBe(8);

    // Charter field stripped from every column.
    const col = slot.state.epoch.columns[0] as unknown as Record<string, unknown>;
    expect("charter" in col).toBe(false);

    // promotedIdeology backfilled via projectMajority (solidarity), null retained on tie.
    const unlocks = slot.state.epoch.unlockedProjects;
    expect(unlocks[0].promotedIdeology).toBe("solidarity");
    expect(unlocks[1].promotedIdeology).toBe(null);
  });

  test("backfill matches projectMajority exactly", () => {
    const raw = v6SaveStore();
    const cards = raw.slots[0].state.epoch.unlockedProjects[0].cards;
    store.set(V6_KEY, JSON.stringify(raw));

    const migrated = loadStore();
    expect(migrated.slots[0].state.epoch.unlockedProjects[0].promotedIdeology).toBe(
      projectMajority(cards),
    );
  });

  test("archives the raw v6 string to v6-archive and removes the v6 key", () => {
    const raw = JSON.stringify(v6SaveStore());
    store.set(V6_KEY, raw);

    loadStore();

    expect(store.get(V6_ARCHIVE_KEY)).toBe(raw); // RAW, unmigrated string
    expect(store.has(V6_KEY)).toBe(false);
    // Migrated store chains v6→v7→v8 and is written under the final v8 key.
    expect(JSON.parse(store.get(V8_KEY)!).version).toBe(8);
  });

  test("a corrupt slot is dropped without throwing", () => {
    const raw = v6SaveStore();
    // Second slot has a null state → migrator must skip it, not crash.
    raw.slots.push({
      id: "slot-bad",
      label: "corrupt",
      createdAt: 0,
      lastPlayedAt: 0,
      state: null as unknown as (typeof raw.slots)[0]["state"],
    });
    store.set(V6_KEY, JSON.stringify(raw));

    let migrated!: ReturnType<typeof loadStore>;
    expect(() => {
      migrated = loadStore();
    }).not.toThrow();
    // Good slot survives; corrupt slot dropped.
    expect(migrated.slots).toHaveLength(1);
    expect(migrated.slots[0].id).toBe("slot-a");
  });

  test("totally corrupt v6 JSON falls through to an empty v8 store", () => {
    store.set(V6_KEY, "{not json");
    const migrated = loadStore();
    expect(migrated.version).toBe(8);
    expect(migrated.slots).toHaveLength(0);
  });

  test("no localStorage ⇒ empty v8 store, no throw", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    const migrated = loadStore();
    expect(migrated.version).toBe(8);
    expect(migrated.slots).toHaveLength(0);
  });
});

/** A minimal v7 save slot whose epoch has NO `crisisTree` (predates P3) — the
 *  migrator must backfill a seeded CrisisTreeState from the slot's Setting. */
function v7SaveStore() {
  return {
    version: 7,
    activeSlotId: "slot-a",
    slots: [
      {
        id: "slot-a",
        label: "E1 · Homeworld · T3",
        createdAt: 1,
        lastPlayedAt: 2,
        state: {
          version: 7,
          settingId: "homeworld",
          seed: 7,
          endOfEpoch: null,
          campaign: { seed: 7 },
          epoch: {
            settingId: "homeworld",
            turn: 3,
            phase: "play",
            turnPhase: "play",
            columns: [],
            unlockedProjects: [
              {
                projectId: "homeworld-commons",
                pattern: "pair",
                turn: 1,
                cards: [],
                promotedIdeology: null,
              },
            ],
            // NOTE: no `crisisTree` key — this is the pre-P3 shape.
          },
        },
      },
    ],
  };
}

describe("persistence v7 → v8 migration", () => {
  test("migrates a v7 save: crisisTree seeded, version 8", () => {
    store.set(V7_KEY, JSON.stringify(v7SaveStore()));

    const migrated = loadStore();

    expect(migrated.version).toBe(8);
    expect(migrated.slots).toHaveLength(1);
    const slot = migrated.slots[0];
    expect(slot.state.version).toBe(8);

    // crisisTree seeded from the Homeworld tree: active node = its root.
    const ct = (slot.state.epoch as unknown as { crisisTree: unknown }).crisisTree as {
      activeNodeId: string;
      cleared: unknown[];
      progress: Record<string, number[]>;
      boundIdeology: Record<string, unknown>;
    };
    const rootId = getSetting("homeworld").crisisTree.rootId;
    expect(ct.activeNodeId).toBe(rootId);
    expect(ct.cleared).toEqual([]);
    expect(ct.boundIdeology).toEqual({});
    // progress has one zero-filled array per node, sized to that node's reqs.
    const tree = getSetting("homeworld").crisisTree;
    for (const [nodeId, node] of Object.entries(tree.nodes)) {
      expect(ct.progress[nodeId]).toEqual(node.requirements.map(() => 0));
    }
  });

  test("a v7 slot that ALREADY has a crisisTree is left untouched", () => {
    const raw = v7SaveStore();
    const customTree = {
      activeNodeId: "already-set",
      cleared: ["establish-x"],
      progress: { foo: [1, 2] },
      boundIdeology: { bar: "solidarity" },
    };
    (raw.slots[0].state.epoch as unknown as { crisisTree: unknown }).crisisTree = customTree;
    store.set(V7_KEY, JSON.stringify(raw));

    const migrated = loadStore();
    const ct = (migrated.slots[0].state.epoch as unknown as { crisisTree: unknown }).crisisTree;
    expect(ct).toEqual(customTree); // not clobbered
  });

  test("archives the raw v7 string to v7-archive and removes the v7 key", () => {
    const raw = JSON.stringify(v7SaveStore());
    store.set(V7_KEY, raw);

    loadStore();

    expect(store.get(V7_ARCHIVE_KEY)).toBe(raw); // RAW, unmigrated string
    expect(store.has(V7_KEY)).toBe(false);
    expect(JSON.parse(store.get(V8_KEY)!).version).toBe(8);
  });

  test("a v8 store is returned as-is (no re-migration)", () => {
    const v8 = { version: 8, activeSlotId: null, slots: [] };
    store.set(V8_KEY, JSON.stringify(v8));

    const loaded = loadStore();
    expect(loaded.version).toBe(8);
    expect(loaded.slots).toHaveLength(0);
    expect(store.has(V7_ARCHIVE_KEY)).toBe(false); // v7 path untouched when v8 present
  });

  test("a corrupt v7 slot is dropped without throwing", () => {
    const raw = v7SaveStore();
    raw.slots.push({
      id: "slot-bad",
      label: "corrupt",
      createdAt: 0,
      lastPlayedAt: 0,
      state: null as unknown as (typeof raw.slots)[0]["state"],
    });
    store.set(V7_KEY, JSON.stringify(raw));

    let migrated!: ReturnType<typeof loadStore>;
    expect(() => {
      migrated = loadStore();
    }).not.toThrow();
    expect(migrated.slots).toHaveLength(1);
    expect(migrated.slots[0].id).toBe("slot-a");
  });

  test("totally corrupt v7 JSON falls through to an empty v8 store", () => {
    store.set(V7_KEY, "{not json");
    const migrated = loadStore();
    expect(migrated.version).toBe(8);
    expect(migrated.slots).toHaveLength(0);
  });
});

describe("GameAPI defensive promotedIdeology backfill", () => {
  test("a loaded unlock with undefined promotedIdeology is defaulted to null", () => {
    // A v7 store whose unlock somehow still lacks promotedIdeology (hand-edit /
    // migrator-skipped). The migrator isn't involved here — the constructor's
    // defensive loop must fill undefined → null so influence math stays a number.
    //
    // We start from a real, fully-formed epoch (skipLoad: true → a fresh epoch)
    // so snapshot() has a complete deck/policy state to read, then inject an
    // unlock whose promotedIdeology is intentionally undefined and round-trip it
    // through a v7 store. The plan's hand-built sparse epoch literal would crash
    // snapshot() (no hand/draw/discard/policy) — resolved per spec §7 intent:
    // the defensive loop fills undefined → null on load.
    const seed = new GameAPI(3, { skipLoad: true });
    const state = JSON.parse(JSON.stringify(seed.exportState())) as Record<string, unknown>;
    const epoch = state.epoch as { unlockedProjects: unknown[] };
    epoch.unlockedProjects = [{ projectId: "p", pattern: "pair", turn: 1, cards: [] }]; // no promotedIdeology

    const v7 = {
      version: 7,
      activeSlotId: "slot-x",
      slots: [
        {
          id: "slot-x",
          label: "E1 · Homeworld · T1",
          createdAt: 1,
          lastPlayedAt: 1,
          state,
        },
      ],
    };
    store.set(V7_KEY, JSON.stringify(v7));

    const api = new GameAPI(1);
    const snap = api.snapshot();
    const u = snap.epoch.unlockedProjects[0] as { promotedIdeology: unknown };
    expect(u.promotedIdeology).toBe(null);
  });
});
