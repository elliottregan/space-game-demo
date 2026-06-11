# Column Storage (M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tableau column gets a 1-slot storage area: play any card into it for free, replace (never retrieve) at the cost of a Dissent-generating discard, and pull stored cards into placements/commits to complete larger hands.

**Architecture:** Mechanic 1 of `docs/superpowers/specs/2026-06-10-column-storage-tech-tree-design.md`. Core: `Column.storage: Card[]` + a `storeCard` command + storage-aware `placeCard`/`commitHand`, all flowing through `dispatch`. Storage is inert — excluded from `columnCards`, so pattern evaluation, ideology derivation, and build snapshots are untouched automatically. Facade bumps the save format v4→v5 (archive, no migration). Renderer adds a `StorageCell` per column (face-up, dimmed until hover) with drag-to-store and a storage-aware commit flow.

**Tech Stack:** TypeScript core (Bun tests), Vue 3 SFC renderer, localStorage persistence.

**Branch:** `feat/column-storage`, based on `feat/project-tree-panel` (stacked on PR #142; merge that first).

**Settled rules (from spec + Elliott):** any card kind storable (Dissent included); capacity is the only limit (base 1/column); storing is free; stored cards are inert (no costs paid, no effects, invisible to evaluation); removal only by replacement (replaced card → discard → +1 Dissent) or by playing the card out; storage is column-local; storage survives Build and Discard-column; face-up dimmed until hover/focus.

---

### Task 0: Branch

- [ ] **Step 1:**

```bash
cd /Users/elliott/Projects/space-game-demo
git checkout feat/project-tree-panel && git pull && git checkout -b feat/column-storage
```

---

### Task 1: Core model — storage field, capacity rule, store event

**Files:**
- Modify: `src/core/engine/column.ts` (Column type, createEmptyColumn, doc comment)
- Modify: `src/core/engine/events.ts` (new event + DiscardSource)
- Modify: `src/core/engine/dispatch.ts` (card-stored handler)
- Modify: `src/core/settings/index.ts` + `homeworld.ts` + `generationShip.ts` + `ruinedHomeworld.ts` (storageCapacity rule)
- Test: `tests/storage.test.ts` (new), `tests/column.test.ts` (one addition)

- [ ] **Step 1: Write the failing tests**

Create `tests/storage.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { createEmptyColumn, columnCards, placeLand } from "../src/core/engine/column.ts";
import { dispatch } from "../src/core/engine/dispatch.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Column, Epoch } from "../src/core/types.ts";

export function freshEpoch(columns: Column[] = [createEmptyColumn()]): Epoch {
  return {
    epochNumber: 1,
    settingId: "test",
    turn: 1,
    phase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: 10,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };
}

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("storage model", () => {
  test("empty column starts with empty storage", () => {
    expect(createEmptyColumn().storage).toEqual([]);
  });

  test("columnCards excludes storage — stored cards are inert", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    col.storage.push(land(8, "heritage"));
    const cards = columnCards(col);
    expect(cards.length).toBe(1);
    expect(cards[0].rank).toBe(7);
  });

  test("card-stored event places the card in the column's storage", () => {
    const ep = freshEpoch();
    const card = land(5, "transformation");
    dispatch(ep, { type: "card-stored", card, columnIndex: 0 });
    expect(ep.columns[0].storage).toEqual([card]);
    expect(ep.eventLog.at(-1)?.type).toBe("card-stored");
  });

  test("card-discarded with source 'storage' adds Dissent like any discard", () => {
    const ep = freshEpoch();
    const card = land(5, "transformation");
    dispatch(ep, { type: "card-discarded", card, source: "storage" });
    expect(ep.discard).toContain(card);
    expect(ep.draw[0]?.tags.includes("dissent")).toBe(true);
  });
});
```

Append to `tests/column.test.ts` (inside the existing `describe("column placement", ...)` or a new describe at file end):

```ts
import { clearColumn as clearColumnFn } from "../src/core/engine/column.ts"; // add to existing import list instead

test("clearColumn wipes rows but leaves storage untouched", () => {
  const col = createEmptyColumn();
  placeLand(col, land(7, "solidarity"));
  col.storage.push(land(8, "heritage"));
  clearColumn(col);
  expect(col.lands.cards.length).toBe(0);
  expect(col.storage.length).toBe(1);
});
```

(`clearColumn` is already exported from `column.ts` — just add it to the existing import at the top of `column.test.ts`.)

- [ ] **Step 2: Run to verify failure**

```bash
bun test tests/storage.test.ts tests/column.test.ts
```

Expected: FAIL — `storage` does not exist on `Column`; `card-stored` not assignable to `GameEvent`; `"storage"` not assignable to `DiscardSource`.

- [ ] **Step 3: Implement**

`src/core/engine/column.ts` — extend the Column shape:

```ts
export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  charter: CharterRow;
  /** Inert staging area: any card kind, capacity-limited, invisible to
   *  pattern/ideology evaluation. Survives Build. See M1 design spec. */
  storage: Card[];
}
```

In `createEmptyColumn()` add `storage: [],`. In `columnFromConfig`, after `const col = createEmptyColumn();` nothing changes (configs don't define storage). **Do not** touch `columnCards` or `clearColumn` — storage is excluded/preserved by construction.

`src/core/engine/events.ts`:

```ts
export type DiscardSource =
  | "tableau-land"
  | "tableau-charter"
  | "column"
  | "hand"
  | "influence-recall"
  | "storage";
```

and add to `GameEvent`:

```ts
  | { type: "card-stored"; card: Card; columnIndex: number }
```

`src/core/engine/dispatch.ts` — new case (before `"turn-ended"`):

```ts
    case "card-stored": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.storage.push(ev.card);
      break;
    }
```

`src/core/settings/index.ts` — add to `SettingRules`:

```ts
  /** Per-column storage slots (inert staging area). */
  storageCapacity: number;
```

Add `storageCapacity: 1,` to the `rules` object in each of `homeworld.ts`, `generationShip.ts`, `ruinedHomeworld.ts`.

- [ ] **Step 4: Run tests**

```bash
bun test
```

Expected: all pass (the dispatch tests' `freshEpoch` builds `Epoch` literals without columns content — columns come from `createEmptyColumn` so they gain storage automatically; if any test constructs a `Column` literal by hand, add `storage: []` to it).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): column storage model — storage field, card-stored event, capacity rule"
```

---

### Task 2: `storeCard` command

**Files:**
- Modify: `src/core/engine/commands.ts`
- Test: `tests/storage.test.ts` (append)

- [ ] **Step 1: Write the failing tests** (append to `tests/storage.test.ts`)

```ts
import { storeCard } from "../src/core/engine/commands.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { makeDissent, roleId } from "../src/core/data/cards.ts"; // merge into existing imports

const SETTING = getSetting("homeworld"); // storageCapacity: 1

describe("storeCard command", () => {
  test("stores a card from hand into the column's storage, free of charge", () => {
    const ep = freshEpoch();
    const card = land(6, "sovereignty");
    ep.hand = [card];
    const before = ep.influence;
    const r = storeCard(ep, SETTING, card.id, 0);
    expect(r.ok).toBe(true);
    expect(ep.hand.length).toBe(0);
    expect(ep.columns[0].storage).toEqual([card]);
    expect(ep.influence).toBe(before);
    expect(ep.draw.length).toBe(0); // storing is not a discard — no Dissent
  });

  test("any card kind is storable — role, charter, even Dissent", () => {
    const ep = freshEpoch([createEmptyColumn(), createEmptyColumn(), createEmptyColumn()]);
    const role = getCard(roleId("scholar", "heritage"));
    const charter = getCard("keystone-pioneer");
    const dissent = makeDissent();
    ep.hand = [role, charter, dissent];
    expect(storeCard(ep, SETTING, role.id, 0).ok).toBe(true);
    expect(storeCard(ep, SETTING, charter.id, 1).ok).toBe(true);
    expect(storeCard(ep, SETTING, dissent.id, 2).ok).toBe(true);
  });

  test("at capacity without replaceId → error, nothing changes", () => {
    const ep = freshEpoch();
    const stored = land(3, "heritage");
    ep.columns[0].storage = [stored];
    const incoming = land(9, "solidarity");
    ep.hand = [incoming];
    const r = storeCard(ep, SETTING, incoming.id, 0);
    expect(r.ok).toBe(false);
    expect(ep.columns[0].storage).toEqual([stored]);
    expect(ep.hand).toContain(incoming);
  });

  test("replacement discards the old card (→ Dissent) and stores the new one", () => {
    const ep = freshEpoch();
    const stored = land(3, "heritage");
    ep.columns[0].storage = [stored];
    const incoming = land(9, "solidarity");
    ep.hand = [incoming];
    const r = storeCard(ep, SETTING, incoming.id, 0, stored.id);
    expect(r.ok).toBe(true);
    expect(ep.columns[0].storage).toEqual([incoming]);
    expect(ep.discard).toContain(stored);
    expect(ep.draw.filter((c) => c.tags.includes("dissent")).length).toBe(1);
  });

  test("guards: ended epoch, wrong phase, unknown card, invalid column", () => {
    const ep = freshEpoch();
    const card = land(6, "sovereignty");
    ep.hand = [card];
    expect(storeCard(ep, SETTING, "nope", 0).ok).toBe(false);
    expect(storeCard(ep, SETTING, card.id, 99).ok).toBe(false);
    ep.phase = "crisis";
    expect(storeCard(ep, SETTING, card.id, 0).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Verify failure** — `bun test tests/storage.test.ts` → FAIL: `storeCard` not exported.

- [ ] **Step 3: Implement** — add to `src/core/engine/commands.ts` (import `Setting` is already imported; pattern-match the other commands):

```ts
/**
 * Store a card from hand into a column's storage. Free; any card kind.
 * Storage is capacity-limited; at capacity the caller must name a stored
 * card to replace — the replaced card is discarded (and breeds Dissent).
 */
export function storeCard(
  epoch: Epoch,
  setting: Setting,
  cardId: string,
  columnIndex: number,
  replaceId?: string,
): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const handIdx = epoch.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) return { ok: false, error: "Card not in hand." };

  const capacity = setting.rules.storageCapacity;
  if (col.storage.length >= capacity) {
    const replaceIdx = replaceId ? col.storage.findIndex((c) => c.id === replaceId) : -1;
    if (replaceIdx === -1) {
      return { ok: false, error: "Storage is full — choose a stored card to replace." };
    }
    const [replaced] = col.storage.splice(replaceIdx, 1);
    dispatch(epoch, { type: "card-discarded", card: replaced, source: "storage" });
  }

  const card = epoch.hand[handIdx];
  epoch.hand.splice(handIdx, 1);
  dispatch(epoch, { type: "card-stored", card, columnIndex });
  return { ok: true, value: card };
}
```

- [ ] **Step 4: Run** — `bun test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): storeCard command — free, any kind, replacement-only removal"
```

---

### Task 3: Pull from storage — `commitHand` + `placeCard`

**Files:**
- Modify: `src/core/engine/commands.ts` (`commitHand` gains `fromStorageIds`; `placeCard` gains `source`)
- Test: `tests/storage.test.ts` (append)

- [ ] **Step 1: Write the failing tests** (append; merge imports — `commitHand`, `placeCard`, `buildColumn` from commands, `placeInfluence`, `placeCharter` from column, `createRng` from rng)

```ts
import { commitHand, placeCard, buildColumn } from "../src/core/engine/commands.ts";
import { placeInfluence, placeCharter } from "../src/core/engine/column.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";

const rng = createRng(7);

describe("pulling from storage", () => {
  test("commitHand combines hand + this column's storage into a straight", () => {
    const ep = freshEpoch();
    const stored = land(4, "heritage");
    ep.columns[0].storage = [stored];
    const handCards = [
      land(2, "solidarity"),
      land(3, "sovereignty"),
      land(5, "transformation"),
      land(6, "heritage"),
    ];
    ep.hand = [...handCards];
    const r = commitHand(
      ep,
      0,
      "land",
      handCards.map((c) => c.id),
      rng,
      [stored.id],
    );
    expect(r.ok).toBe(true);
    expect(ep.columns[0].lands.cards.length).toBe(5);
    expect(ep.columns[0].storage.length).toBe(0); // pulled out
    expect(ep.draw.length).toBe(0); // committing is not a discard
  });

  test("commitHand rejects when combined cards do not form a valid hand", () => {
    const ep = freshEpoch();
    const stored = land(9, "heritage");
    ep.columns[0].storage = [stored];
    const h = land(2, "solidarity");
    ep.hand = [h];
    const r = commitHand(ep, 0, "land", [h.id], rng, [stored.id]);
    expect(r.ok).toBe(false);
    expect(ep.columns[0].storage).toEqual([stored]); // untouched on failure
    expect(ep.hand).toContain(h);
  });

  test("stored roles pay influence and fire effects at commit time, not store time", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const storedRole = getCard(roleId("agitator", "solidarity")); // cost 1, +1 Influence
    col.storage = [storedRole];
    const before = ep.influence;
    const r = commitHand(ep, 0, "influence", [], rng, [storedRole.id]);
    expect(r.ok).toBe(true);
    // cost 1 paid, effect +1 — net zero
    expect(ep.influence).toBe(before);
    expect(col.influence.cards).toContain(storedRole);
  });

  test("commitHand from storage rejects unaffordable roles", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const storedRole = getCard(roleId("architect", "solidarity")); // cost 3
    col.storage = [storedRole];
    ep.influence = 2;
    const r = commitHand(ep, 0, "influence", [], rng, [storedRole.id]);
    expect(r.ok).toBe(false);
    expect(col.storage).toEqual([storedRole]);
  });

  test("placeCard with source 'storage' plays a stored charter", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const charter = getCard("keystone-founding-charter"); // cost 2, +2 Influence
    col.storage = [charter];
    const campaign = createCampaign(1);
    const r = placeCard(ep, campaign, getSetting("homeworld"), charter.id, 0, rng, "storage");
    expect(r.ok).toBe(true);
    expect(col.charter.card).toBe(charter);
    expect(col.storage.length).toBe(0);
  });

  test("Dissent in storage cannot be played out", () => {
    const ep = freshEpoch();
    const d = makeDissent();
    ep.columns[0].storage = [d];
    const campaign = createCampaign(1);
    const r = placeCard(ep, campaign, getSetting("homeworld"), d.id, 0, rng, "storage");
    expect(r.ok).toBe(false);
  });

  test("Build clears the column but storage survives", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    placeCharter(col, getCard("keystone-founding-charter"));
    const kept = land(2, "solidarity");
    col.storage = [kept];
    const r = buildColumn(ep, getSetting("homeworld"), 0);
    expect(r.ok).toBe(true);
    expect(col.lands.cards.length).toBe(0);
    expect(col.storage).toEqual([kept]);
  });
});
```

- [ ] **Step 2: Verify failure** — `bun test tests/storage.test.ts` → FAIL: `commitHand` called with 6 args / `placeCard` with 7; empty `cardIds` also currently rejected.

- [ ] **Step 3: Implement** in `src/core/engine/commands.ts`:

**`placeCard`** — change the signature's tail to `rng: RNG, source: "hand" | "storage" = "hand"` and replace the hand-lookup block:

```ts
export function placeCard(
  epoch: Epoch,
  _campaign: Campaign,
  setting: Setting,
  cardId: string,
  columnIndex: number,
  rng: RNG,
  source: "hand" | "storage" = "hand",
): PlaceResult {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const pool = source === "hand" ? epoch.hand : col.storage;
  const poolIdx = pool.findIndex((c) => c.id === cardId);
  if (poolIdx === -1) {
    return { ok: false, error: source === "hand" ? "Card not in hand." : "Card not in storage." };
  }
  const card = pool[poolIdx];
  if (card.tags.includes("dissent")) return { ok: false, error: "Dissent cannot be played." };
  ...
```

Then every `epoch.hand.splice(handIdx, 1)` in this function (and in `playToTopRow`) becomes a removal from the right pool. The cleanest mechanical change: keep `placeCard` resolving `pool`/`poolIdx`, and pass them into `playToTopRow(epoch, setting, card, columnIndex, pool, poolIdx, eventType, rng)`, replacing its `handIdx` param. Land branch: `pool.splice(poolIdx, 1)` before dispatching `card-played-to-land`. Storage placements pay costs and fire effects identically to hand placements (already the behavior of the shared code path).

**`commitHand`** — extend signature and resolution:

```ts
export function commitHand(
  epoch: Epoch,
  columnIndex: number,
  row: "land" | "influence",
  cardIds: string[],
  rng: RNG,
  fromStorageIds: string[] = [],
): CmdResult<Card[]> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  if (cardIds.length + fromStorageIds.length === 0) return { ok: false, error: "No cards to commit." };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  // 1. Resolve hand ids → Cards, then storage ids → Cards (this column only).
  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = epoch.hand.find((h) => h.id === id);
    if (!c) return { ok: false, error: `Card ${id} not in hand.` };
    cards.push(c);
  }
  const storageCards: Card[] = [];
  for (const id of fromStorageIds) {
    const c = col.storage.find((s) => s.id === id);
    if (!c) return { ok: false, error: `Card ${id} not in this column's storage.` };
    storageCards.push(c);
  }
  const all = [...cards, ...storageCards];
  if (all.some((c) => c.tags.includes("dissent"))) {
    return { ok: false, error: "Dissent cannot be played." };
  }

  // 2. Kind check + row-hand validation over the combined set.
  if (!canCommitHand(col, row, all)) {
    return { ok: false, error: "Not a valid hand." };
  }

  // 3. For influence row, check affordability over the combined set.
  if (row === "influence") {
    const totalCost = all.reduce((sum, c) => sum + c.influenceCost, 0);
    if (epoch.influence < totalCost) {
      return { ok: false, error: "Not enough Influence." };
    }
    epoch.influence -= totalCost;
  }

  // 4. Remove from hand and from storage.
  const idsSet = new Set(cardIds);
  epoch.hand = epoch.hand.filter((h) => !idsSet.has(h.id));
  const storageSet = new Set(fromStorageIds);
  col.storage = col.storage.filter((s) => !storageSet.has(s.id));

  // 5. Dispatch — handler appends cards to the row in order.
  dispatch(epoch, { type: "cards-committed", columnIndex, row, cards: all });

  // 6. Fire per-card effects in placement order.
  if (row === "influence") {
    for (const card of all) {
      applyEffect(card.effect, { epoch, rng });
    }
  }

  return { ok: true, value: all };
}
```

(The Dissent guard is new but consistent: `canCommitHand` would already reject Dissent in the land/influence kind check; the explicit guard gives a better error and future-proofs.)

- [ ] **Step 4: Run** — `bun test` → all pass (existing `commitHand` tests still pass: `fromStorageIds` defaults to `[]`, and the old "empty cardIds" test still fails-fast since both lists are empty).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): pull stored cards into placeCard and commitHand"
```

---

### Task 4: Facade — GameAPI + save format v5

**Files:**
- Modify: `src/facade/GameAPI.ts`
- Modify: `src/facade/persistence.ts`

- [ ] **Step 1: GameAPI changes**

- `snapshot()`: in `columnsView`, clone storage: `storage: [...c.storage],` alongside lands/influence/charter.
- New command passthroughs (mirror existing patterns):

```ts
  storeCard(cardId: string, columnIndex: number, replaceId?: string): CommandResult<Card> {
    return storeCardCore(this.epoch, this.setting, cardId, columnIndex, replaceId);
  }

  placeFromStorage(cardId: string, columnIndex: number): CommandResult<Card> {
    const r = placeCardCore(
      this.epoch,
      this.campaign,
      this.setting,
      cardId,
      columnIndex,
      this.rng,
      "storage",
    );
    return r.ok ? { ok: true, value: r.card } : r;
  }
```

- `commitHand(columnIndex, row, cardIds, fromStorageIds: string[] = [])` — pass through to core with the extra arg.
- Import `storeCard as storeCardCore` in the commands import block.

- [ ] **Step 2: persistence v4 → v5** (archive precedent, no migration):

```ts
const STORE_KEY = "deck-demo-saves-v5";
const PREV_KEY = "deck-demo-saves-v4";
const ARCHIVE_KEY = "deck-demo-saves-v4-archive";
```

`SavedState.version: 5`, `SaveStore.version: 5`, `emptyStore()` returns version 5, `loadStore` checks `parsed.version === 5`, and the one-time archival comment/keys move from v3→v4 naming. In `GameAPI.exportState()`, `version: 4` becomes `version: 5`.

- [ ] **Step 3: Verify + commit**

```bash
bun run typecheck && bun test
git add -A && git commit -m "feat(facade): storage commands + save format v5 (archive v4, no migration)"
```

---

### Task 5: Renderer — StorageCell + column wiring

**Files:**
- Modify: `src/renderer/util/dragState.ts` (payload unchanged — hand-only drags still)
- Create: `src/renderer/components/game/StorageCell.vue`
- Modify: `src/renderer/components/game/TableauColumn.vue`
- Modify: `src/renderer/components/game/TableauPanel.vue` (row label + emit wiring)
- Modify: `src/renderer/theme.css` (cell styling hooks if needed — prefer scoped styles)

- [ ] **Step 1: Create `StorageCell.vue`**

```vue
<template>
  <div
    :class="[
      'cell storage-cell',
      { occupied: cards.length > 0, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="cards.length === 0" class="cell-empty">
      <span class="cell-empty-label">Storage</span>
    </div>
    <div v-else class="storage-cards">
      <div v-for="card in cards" :key="card.id" class="storage-card">
        <Card
          :card="card"
          :compact="true"
          :selectable="true"
          :selected="selectedIds.includes(card.id)"
          @select="$emit('toggleSelect', card.id)"
        />
        <button
          v-if="canPlace(card)"
          class="cell-action"
          @click.stop="$emit('placeFromStorage', card.id)"
        >
          Play
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../../core/types.ts";
import Card from "../core/Card.vue";

defineProps<{
  cards: CardT[];
  selectedIds: string[];
  isDropTarget: boolean;
  isDragOver: boolean;
  /** Per-card: can this stored card be single-placed into this column right now? */
  canPlace: (card: CardT) => boolean;
}>();

defineEmits<{
  toggleSelect: [cardId: string];
  placeFromStorage: [cardId: string];
}>();
</script>

<style scoped>
/* Stored cards are plans, not assets: dimmed until attention lands on them. */
.storage-card {
  opacity: 0.55;
  transition: opacity 120ms ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.storage-card:hover,
.storage-card:focus-within {
  opacity: 1;
}
.storage-cards {
  display: flex;
  gap: var(--space-1);
}
</style>
```

- [ ] **Step 2: Wire into `TableauColumn.vue`**

Template — add below `LandCell`, above `ColumnFooter`:

```html
    <StorageCell
      :cards="column.storage"
      :selected-ids="selectedStorageIds"
      :is-drop-target="storageDropTarget"
      :is-drag-over="dragOver === 'storage'"
      :can-place="canPlaceFromStorage"
      @dragenter.prevent="dragOver = storageDropTarget ? 'storage' : null"
      @dragover.prevent="onDragOver($event, 'storage')"
      @dragleave="dragOver = null"
      @drop.prevent="onStorageDrop($event)"
      @toggle-select="(id) => $emit('toggle-storage-select', id)"
      @place-from-storage="(id) => $emit('place-from-storage', id)"
    />
```

Script — new props/emits/logic:

```ts
const props = defineProps<{
  column: Column;
  buildable: boolean;
  buildTooltip: string;
  validForDrag: { land: boolean; influence: boolean; charter: boolean };
  selectedStorageIds: string[];
  storageCapacity: number;
  canPlaceFromStorage: (card: CardT) => boolean;
}>();

const emit = defineEmits<{
  "place-card": [cardId: string];
  "store-card": [cardId: string];
  "toggle-storage-select": [cardId: string];
  "place-from-storage": [cardId: string];
  "discard-land": [];
  "discard-charter": [];
  "recall-influence": [];
  "discard-column": [];
  build: [];
}>();

const dragOver = ref<"land" | "influence" | "charter" | "storage" | null>(null);

// Storage accepts ANY dragged card; a full slot still accepts (replace).
const storageDropTarget = computed(() => dragging.value !== null);

function onStorageDrop(e: DragEvent): void {
  dragOver.value = null;
  const payload = readDragPayload(e);
  if (!payload) return;
  emit("store-card", payload.cardId);
  endDrag();
}
```

(`onDragOver`'s `rowAcceptsDrag` gains a `storage` arm returning `storageDropTarget.value`. Import `Card as CardT` type. `anyDropTarget` should now also include `storageDropTarget` so the column highlights.)

Grid rows: `grid-template-rows: 150px 150px 150px auto auto;` (storage row + footer).

- [ ] **Step 3: Wire `TableauPanel.vue`**

- Row labels column gains a `<div class="row-label">Storage</div>` between the Land label and the footer spacer.
- `TableauColumn` invocation passes through new props/emits:

```html
          :selected-storage-ids="selectedStorageFor(i)"
          :storage-capacity="storageCapacity"
          :can-place-from-storage="(card) => canPlaceStored(i, card)"
          @store-card="(cardId) => $emit('storeCard', cardId, i)"
          @toggle-storage-select="(cardId) => $emit('toggleStorageSelect', i, cardId)"
          @place-from-storage="(cardId) => $emit('placeFromStorage', cardId, i)"
```

- New props on TableauPanel: `selectedStorageFor: (col: number) => string[]`, `storageCapacity: number`, `canPlaceStored: (col: number, card: Card) => boolean`; new emits `storeCard`, `toggleStorageSelect`, `placeFromStorage` (all `[cardId: string, columnIndex: number]`-shaped as shown).

- [ ] **Step 4: Verify + commit**

```bash
bun run typecheck
git add -A && git commit -m "feat(renderer): StorageCell — drag-to-store, dimmed stored cards, play-from-storage"
```

(App.vue doesn't compile against the new required props yet — that's Task 6; if typecheck fails ONLY on App.vue's TableauPanel usage, proceed to Task 6 and commit both together instead.)

---

### Task 6: Renderer — App/GameService/HandPanel storage-aware flow

**Files:**
- Modify: `src/renderer/GameService.ts`
- Modify: `src/renderer/App.vue`
- Modify: `src/renderer/components/game/HandPanel.vue`

- [ ] **Step 1: GameService** — add passthroughs + extend commit:

```ts
  storeCard(cardId: string, columnIndex: number, replaceId?: string): void {
    const r = this.api.storeCard(cardId, columnIndex, replaceId);
    this.report(r as any);
    this.refresh();
  }
  placeFromStorage(cardId: string, columnIndex: number): void {
    const r = this.api.placeFromStorage(cardId, columnIndex);
    this.report(r as any);
    this.refresh();
  }
```

`commitToRow(columnIndex, row, fromStorageIds: string[] = [])` passes the extra arg to `api.commitHand`. `canCommitToRow(columnIndex, row, storageCards: Card[] = [])` validates `[...handCards, ...storageCards]` via `canCommitHand`.

- [ ] **Step 2: App.vue** — storage selection state + handlers:

```ts
// Storage selection: cards are column-local, so at most one column's
// storage can participate in a commit at a time.
const selectedStorage = ref<{ columnIndex: number; ids: string[] } | null>(null);

function onToggleStorageSelect(columnIndex: number, cardId: string): void {
  const cur = selectedStorage.value;
  if (!cur || cur.columnIndex !== columnIndex) {
    selectedStorage.value = { columnIndex, ids: [cardId] };
    return;
  }
  const ids = cur.ids.includes(cardId)
    ? cur.ids.filter((x) => x !== cardId)
    : [...cur.ids, cardId];
  selectedStorage.value = ids.length ? { columnIndex, ids } : null;
}

function onStoreCard(cardId: string, columnIndex: number): void {
  // Capacity 1: replace the current occupant implicitly when full.
  const occupant = epoch.value.columns[columnIndex]?.storage[0];
  const capacity = setting.value.rules.storageCapacity;
  const full = (epoch.value.columns[columnIndex]?.storage.length ?? 0) >= capacity;
  game.storeCard(cardId, columnIndex, full ? occupant?.id : undefined);
  selectedIds.value = selectedIds.value.filter((x) => x !== cardId);
}

function onPlaceFromStorage(cardId: string, columnIndex: number): void {
  game.placeFromStorage(cardId, columnIndex);
  selectedStorage.value = null;
}

const storageSelection = computed(() => {
  const sel = selectedStorage.value;
  if (!sel) return null;
  const col = epoch.value.columns[sel.columnIndex];
  const cards = sel.ids.flatMap((id) => {
    const c = col?.storage.find((s) => s.id === id);
    return c ? [c] : [];
  });
  return cards.length ? { columnIndex: sel.columnIndex, cards } : null;
});

function selectedStorageFor(col: number): string[] {
  return selectedStorage.value?.columnIndex === col ? selectedStorage.value.ids : [];
}

function canPlaceStored(col: number, card: Card): boolean {
  const column = epoch.value.columns[col];
  if (!column || card.tags.includes("dissent")) return false;
  if (card.kind === "land") return canPlaceLand(column, card);
  if (card.kind === "role")
    return canPlaceInfluence(column, card) && epoch.value.influence >= card.influenceCost;
  if (card.kind === "charter")
    return canPlaceCharter(column, card) && epoch.value.influence >= card.influenceCost;
  return false;
}
```

(Import `canPlaceLand/Influence/Charter` from `core/engine/column.ts`.) `onCommitToRow` passes storage ids when the target column matches:

```ts
function onCommitToRow(columnIndex: number, row: "land" | "influence"): void {
  game.commitBuffer.value = [...selectedIds.value];
  const sel = selectedStorage.value;
  const fromStorage = sel && sel.columnIndex === columnIndex ? sel.ids : [];
  game.commitToRow(columnIndex, row, fromStorage);
  if (game.commitBuffer.value.length === 0) {
    selectedIds.value = [];
    selectedStorage.value = null;
  }
}
```

Template: pass the three new props/emits to `TableauPanel` (`:selected-storage-for="selectedStorageFor"`, `:storage-capacity="setting.rules.storageCapacity"`, `:can-place-stored="canPlaceStored"`, `@store-card="onStoreCard"`, `@toggle-storage-select="onToggleStorageSelect"`, `@place-from-storage="onPlaceFromStorage"`), and `:storage-selection="storageSelection"` to `HandPanel`. Clear `selectedStorage` in `onEndTurn`/`onSwitchSlot`/`onNewSlot`/`onDeleteSlot`/`onAdvance` alongside `selectedIds`.

- [ ] **Step 3: HandPanel.vue** — storage-aware commits. New prop:

```ts
  storageSelection: { columnIndex: number; cards: CardT[] } | null;
```

- `combinedSelection` computed: `[...playableSelection, ...(props.storageSelection?.cards ?? [])]` (storage cards are pre-filtered to non-dissent by selection UI; filter anyway).
- `commitTargets`: when `storageSelection` is non-null, only test its `columnIndex` and use the combined set; minimum total of 1 card (a lone stored card commits via its Play button instead, so keep the `>= 2` threshold on the combined count). When null, behavior unchanged.
- `rowHandLabel`/`rowHandForRow` use the combined set.
- `validSharedSlots` (single-card sequential placement) ignores storage — unchanged.
- The `action-meta` line shows e.g. `2 selected + 1 stored` when storage is selected:

```html
<span>{{ selectedIds.length }} selected<template v-if="storageSelection"> + {{ storageSelection.cards.length }} stored (Col {{ storageSelection.columnIndex + 1 }})</template></span>
```

- The hand-actions hint also shows when ONLY storage is selected (adjust the outer `v-if` from `selectedCards.length === 0` to `selectedCards.length === 0 && !storageSelection`).

- [ ] **Step 4: Verify + commit**

```bash
bun run typecheck && bun test
git add -A && git commit -m "feat(renderer): storage-aware selection and commit flow"
```

---

### Task 7: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Update CLAUDE.md:
- Invariants section, add: **"Each column has an inert storage area** (base capacity `rules.storageCapacity`): any card may be stored for free; stored cards are invisible to pattern/ideology evaluation and survive Build; removal is replacement-only and the replaced card's discard adds Dissent like any other."
- `engine/commands.ts` line: add `storeCard` to the verb list.
- `persistence.ts` line: `deck-demo-saves-v4` → `deck-demo-saves-v5` (archives v4, no migration).
- `engine/column.ts` line: mention storage in the helper list.

- [ ] **Step 2:** Commit:

```bash
git add CLAUDE.md && git commit -m "docs: column storage invariants, storeCard verb, save v5"
```

---

### Task 8: Verification + PR

- [ ] **Step 1: Gates** — `bun run typecheck && bun test && bun run lint` → clean (13 pre-existing script warnings OK).

- [ ] **Step 2: Visual verification** — `bun run dev`, then check: (1) Storage row labeled under Land with an empty "Storage" cell per column; (2) drag a hand card onto storage → it sits dimmed, full opacity on hover, NO Dissent added; (3) drag another card onto the occupied slot → old card goes to discard, Dissent count +1; (4) stored card "Play" button places it (charter test: into a column with influence filled); (5) select 4 sequential lands in hand + click a stored 5th sequential land → "Lay down as Land → Col N" appears only for that column and commits a Straight; (6) Build a column with a stored card → storage survives; (7) fresh save slot created automatically (v5 store; old v4 saves archived, not loaded).

- [ ] **Step 3: PR**

```bash
git push -u origin feat/column-storage
gh pr create --base feat/project-tree-panel --title "feat: column storage (M1) — store cards toward larger hands" --body "..."
```

PR body: summary of rules (free store, any kind, capacity 1, replacement-only → Dissent, survives Build, pull into placeCard/commitHand), save v5 note, "greedy simulator does not use storage — M2 upgrades it before any tuning", stacked on #142.

---

## Out of scope

- Simulator storage/commit heuristic (M2), capacity upgrades (M3), soft gates (M4).
- Multi-column storage pulls, charter-storability restrictions, Dissent-storage rules beyond "allowed" — open questions tracked in the spec.
