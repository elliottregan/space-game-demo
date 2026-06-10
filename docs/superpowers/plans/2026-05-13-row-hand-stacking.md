# Row-hand stacking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Influence rows stack like Land rows. Each row must form a valid poker hand after every placement; new patterns (two-pair, straight, full-house, straight-flush, royal-flush) join the existing pattern set. Multi-card "lay down a hand" action lets players play straights/etc. in one move.

**Architecture:** Three layers as today (`core/` → `facade/` → `renderer/`). New file `src/core/engine/rowHands.ts` holds row-hand classification (separating "what hand is this stack?" from `column.ts`'s placement helpers and `columnPatterns.ts`'s column-level resolution). `InfluenceRow.card: Card | null` → `cards: Card[]`. New event `cards-committed` and command `commitHand` mirror the existing `card-placed`/`placeCard` flow but accept N cards atomically and add no Dissent. Persistence bumps from `v3` → `v4`; `v3` saves archived without migration. Implementation lands as a PR back into `feat/ui-colocate-projects-ideology-panels`, not `main`.

**Tech Stack:** Vue 3 + TypeScript + Vite + Bun (test runner + runtime). Bun test runner via `bun test`. Lefthook pre-commit runs `oxlint --fix` + `prettier --write` on staged files and `tsc --noEmit` on the project. Crisis simulator at `scripts/analyze-crisis.ts`.

**Spec:** `docs/superpowers/specs/2026-05-13-row-hand-stacking-design.md`

---

## Phase 0: Worktree setup

### Task 0: Create worktree branched from current branch

The plan executes in an isolated worktree branched from `feat/ui-colocate-projects-ideology-panels`. The execution skill (subagent-driven-development or executing-plans) creates this via `superpowers:using-git-worktrees`. The worktree branch name should be `feat/row-hand-stacking`; the PR target is `feat/ui-colocate-projects-ideology-panels`, not `main`.

- [ ] **Step 1: Confirm worktree is on a branch named `feat/row-hand-stacking` branched from `feat/ui-colocate-projects-ideology-panels`.**

```bash
git rev-parse --abbrev-ref HEAD
# Expected: feat/row-hand-stacking

git log --oneline -1
# Expected: tip matches feat/ui-colocate-projects-ideology-panels at start
```

- [ ] **Step 2: Install dependencies and confirm baseline tests pass.**

```bash
bun install
bun test
bun run typecheck
```

Expected: all tests green, typecheck clean. If anything is red on the baseline, stop and surface — do not modify code to "fix" a pre-existing failure.

---

## Phase 1: Pattern set & row-hand helpers

No behavior change in this phase; we're laying down types and pure helpers.

### Task 1: Extend `PatternKind` and the per-pattern defaults

**Files:**
- Modify: `src/core/data/projects.ts`
- Test: `tests/projects.test.ts`

- [ ] **Step 1: Add failing test for the extended ordering and defaults.**

Add to `tests/projects.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import {
  PATTERNS_IN_ORDER,
  DEFAULT_PROJECT_VALUE,
  reversePatternOrder,
} from "../src/core/data/projects.ts";

describe("PatternKind extension", () => {
  it("PATTERNS_IN_ORDER lists all ten patterns ascending", () => {
    expect(PATTERNS_IN_ORDER).toEqual([
      "high-card",
      "pair",
      "two-pair",
      "three-of-a-kind",
      "straight",
      "flush",
      "full-house",
      "four-of-a-kind",
      "straight-flush",
      "royal-flush",
    ]);
  });

  it("DEFAULT_PROJECT_VALUE has an entry per pattern with poker-strength scaling", () => {
    expect(DEFAULT_PROJECT_VALUE).toEqual({
      "high-card": 1,
      pair: 2,
      "two-pair": 3,
      "three-of-a-kind": 4,
      straight: 5,
      flush: 6,
      "full-house": 7,
      "four-of-a-kind": 8,
      "straight-flush": 10,
      "royal-flush": 12,
    });
  });

  it("reversePatternOrder walks royal-flush → ... → high-card", () => {
    expect(reversePatternOrder()[0]).toBe("royal-flush");
    expect(reversePatternOrder().at(-1)).toBe("high-card");
  });
});
```

- [ ] **Step 2: Run the test — expect failure.**

```bash
bun test tests/projects.test.ts
```

Expected: type errors and assertion mismatches on the new patterns.

- [ ] **Step 3: Update `src/core/data/projects.ts`.**

Replace the `PatternKind`, `PATTERNS_IN_ORDER`, and `DEFAULT_PROJECT_VALUE` declarations:

```ts
export type PatternKind =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush"
  | "royal-flush";

// ... (other declarations unchanged) ...

export const PATTERNS_IN_ORDER: PatternKind[] = [
  "high-card",
  "pair",
  "two-pair",
  "three-of-a-kind",
  "straight",
  "flush",
  "full-house",
  "four-of-a-kind",
  "straight-flush",
  "royal-flush",
];

export const DEFAULT_PROJECT_VALUE: Record<PatternKind, number> = {
  "high-card": 1,
  pair: 2,
  "two-pair": 3,
  "three-of-a-kind": 4,
  straight: 5,
  flush: 6,
  "full-house": 7,
  "four-of-a-kind": 8,
  "straight-flush": 10,
  "royal-flush": 12,
};
```

- [ ] **Step 4: Run tests + typecheck.**

```bash
bun test tests/projects.test.ts
bun run typecheck
```

The typecheck will flag every Setting whose `projects` array is now an incomplete `Record<PatternKind, KeystoneProject>` — that's expected. Subsequent tasks address it. **For now, the per-pattern lookups in `columnPatterns.ts` and `getProjectForPattern` use `find` (not record indexing), so missing entries return `null` at runtime rather than crash; typecheck stays clean on those call sites.**

If typecheck flags Setting files, leave them broken — they're updated in Phase 4. Mark this step done.

- [ ] **Step 5: Commit.**

```bash
git add src/core/data/projects.ts tests/projects.test.ts
git commit -m "feat(core): extend PatternKind with two-pair, straight, full-house, straight-flush, royal-flush"
```

---

### Task 2: Add `rowHands.ts` — `RowHand` type and `identifyRowHand`

**Files:**
- Create: `src/core/engine/rowHands.ts`
- Create: `tests/rowHands.test.ts`

**Rationale for a new file:** keeps `column.ts` focused on placement/data and `columnPatterns.ts` focused on column-level resolution; row-hand classification is its own concern and is exercised independently.

- [ ] **Step 1: Write the failing test.**

Create `tests/rowHands.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { identifyRowHand } from "../src/core/engine/rowHands.ts";
import { ALL_CARDS, type Card } from "../src/core/data/cards.ts";

// Helpers: pick cards by id from the static pool.
const byId = (id: string): Card => {
  const c = ALL_CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown card id: ${id}`);
  return c;
};

describe("identifyRowHand", () => {
  it("empty stack returns null", () => {
    expect(identifyRowHand([])).toBeNull();
  });

  it("one card is high-card", () => {
    const c = ALL_CARDS.find((x) => x.kind === "land")!;
    expect(identifyRowHand([c])).toBe("high-card");
  });

  it("two same-rank cards is pair", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const pair = pairOfRank(lands);
    expect(identifyRowHand(pair)).toBe("pair");
  });

  it("three same-rank cards is three-of-a-kind", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const three = nOfRank(lands, 3);
    expect(identifyRowHand(three)).toBe("three-of-a-kind");
  });

  it("four same-rank cards is four-of-a-kind", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const four = nOfRank(lands, 4);
    expect(identifyRowHand(four)).toBe("four-of-a-kind");
  });

  it("five consecutive ranks is straight", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const straight = consecutiveLands(lands, 5);
    expect(identifyRowHand(straight)).toBe("straight");
  });

  it("two ranks each appearing twice is two-pair", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const twoPair = [...pairOfRank(lands), ...pairOfRank(lands, /*differentRank*/ true)];
    expect(identifyRowHand(twoPair)).toBe("two-pair");
  });

  it("3+2 is full-house", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const fh = [...nOfRank(lands, 3), ...pairOfRank(lands, /*differentRank*/ true)];
    expect(identifyRowHand(fh)).toBe("full-house");
  });

  it("two different ranks single each rejects (not a hand)", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const a = lands.find((c) => c.rank === 4)!;
    const b = lands.find((c) => c.rank === 5)!;
    expect(identifyRowHand([a, b])).toBeNull();
  });
});

// --- helpers ---

function pairOfRank(pool: Card[], differentRank = false): Card[] {
  const used = differentRank ? new Set<number>() : new Set<number>();
  for (const r of [2, 3, 4, 5, 6, 7, 8, 9]) {
    if (used.has(r)) continue;
    const sameRank = pool.filter((c) => c.rank === r);
    if (sameRank.length >= 2) {
      if (differentRank) used.add(r);
      return sameRank.slice(0, 2);
    }
  }
  throw new Error("no pair available in pool");
}

function nOfRank(pool: Card[], n: number): Card[] {
  for (const r of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const same = pool.filter((c) => c.rank === r);
    if (same.length >= n) return same.slice(0, n);
  }
  throw new Error(`no ${n}-of-a-kind available`);
}

function consecutiveLands(pool: Card[], n: number): Card[] {
  for (let start = 2; start + n - 1 <= 9; start++) {
    const cards: Card[] = [];
    let ok = true;
    for (let i = 0; i < n; i++) {
      const c = pool.find((x) => x.rank === start + i);
      if (!c) { ok = false; break; }
      cards.push(c);
    }
    if (ok) return cards;
  }
  throw new Error("no straight available");
}
```

- [ ] **Step 2: Run — expect failure.**

```bash
bun test tests/rowHands.test.ts
```

Expected: module-not-found / import error.

- [ ] **Step 3: Implement `rowHands.ts`.**

Create `src/core/engine/rowHands.ts`:

```ts
// Row-hand classification: given a stack of cards in a Land or Influence row,
// identify which poker hand the stack forms (or null if it's not a hand).
// Flush, straight-flush, and royal-flush are column-level; this module does
// not classify them.

import type { Card } from "../data/cards.ts";

export type RowHand =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "four-of-a-kind"
  | "full-house";

export function identifyRowHand(cards: Card[]): RowHand | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return "high-card";

  const counts = rankCounts(cards);
  const sortedCounts = [...counts.values()].sort((a, b) => b - a);

  if (cards.length === 5 && isStraight(cards)) return "straight";
  if (sortedCounts[0] === 4 && cards.length === 4) return "four-of-a-kind";
  if (sortedCounts[0] === 3 && sortedCounts[1] === 2 && cards.length === 5) return "full-house";
  if (sortedCounts[0] === 3 && cards.length === 3) return "three-of-a-kind";
  if (sortedCounts[0] === 2 && sortedCounts[1] === 2 && cards.length === 4) return "two-pair";
  if (sortedCounts[0] === 2 && cards.length === 2) return "pair";
  return null;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const c of cards) out.set(c.rank, (out.get(c.rank) ?? 0) + 1);
  return out;
}

function isStraight(cards: Card[]): boolean {
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== cards.length) return false;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run — expect pass.**

```bash
bun test tests/rowHands.test.ts
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/core/engine/rowHands.ts tests/rowHands.test.ts
git commit -m "feat(core): add row-hand classification (identifyRowHand)"
```

---

### Task 3: Add `validateRowHand` and `canCommitHand`

**Files:**
- Modify: `src/core/engine/rowHands.ts`
- Modify: `tests/rowHands.test.ts`

- [ ] **Step 1: Add failing tests.**

Append to `tests/rowHands.test.ts`:

```ts
import { validateRowHand, canCommitHand } from "../src/core/engine/rowHands.ts";
import { createEmptyColumn, placeLand, placeCharter } from "../src/core/engine/column.ts";

describe("validateRowHand", () => {
  it("returns true for an identified hand", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    expect(validateRowHand(nOfRank(lands, 2))).toBe(true);
  });

  it("returns false for a non-hand state", () => {
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const a = lands.find((c) => c.rank === 4)!;
    const b = lands.find((c) => c.rank === 5)!;
    expect(validateRowHand([a, b])).toBe(false);
  });
});

describe("canCommitHand", () => {
  it("growing from pair to three by adding a same-rank card is valid", () => {
    const col = createEmptyColumn();
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const three = nOfRank(lands, 3);
    placeLand(col, three[0]);
    placeLand(col, three[1]);
    expect(canCommitHand(col, "land", [three[2]])).toBe(true);
  });

  it("committing 4 lands of two ranks (2+2) to an empty row is two-pair, valid", () => {
    const col = createEmptyColumn();
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const twoPair = [...pairOfRank(lands), ...pairOfRank(lands, true)];
    expect(canCommitHand(col, "land", twoPair)).toBe(true);
  });

  it("committing two different-rank cards to an empty row is rejected (not a hand)", () => {
    const col = createEmptyColumn();
    const lands = ALL_CARDS.filter((x) => x.kind === "land");
    const a = lands.find((c) => c.rank === 4)!;
    const b = lands.find((c) => c.rank === 5)!;
    expect(canCommitHand(col, "land", [a, b])).toBe(false);
  });

  it("rejects cards of the wrong kind for the row", () => {
    const col = createEmptyColumn();
    const role = ALL_CARDS.find((x) => x.kind === "role")!;
    expect(canCommitHand(col, "land", [role])).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure.**

```bash
bun test tests/rowHands.test.ts
```

- [ ] **Step 3: Implement the helpers.**

Append to `src/core/engine/rowHands.ts`:

```ts
import type { Column } from "./column.ts";

export function validateRowHand(cards: Card[]): boolean {
  return identifyRowHand(cards) !== null;
}

export function canCommitHand(
  col: Column,
  row: "land" | "influence",
  newCards: Card[],
): boolean {
  if (newCards.length === 0) return false;
  const requiredKind = row === "land" ? "land" : "role";
  if (newCards.some((c) => c.kind !== requiredKind)) return false;

  const existing = row === "land" ? col.lands.cards : col.influence.cards;
  const after = [...existing, ...newCards];
  return validateRowHand(after);
}
```

Note: `col.influence.cards` does not exist yet — that's the refactor in Task 5. Until then, this function references a field that does not compile. To keep typecheck green at every commit, **defer the implementation body for `canCommitHand` until after Task 5**:

Implement only `validateRowHand` in this task; stub `canCommitHand` to throw:

```ts
export function canCommitHand(
  _col: Column,
  _row: "land" | "influence",
  _newCards: Card[],
): boolean {
  throw new Error("canCommitHand requires InfluenceRow.cards refactor — see Task 5");
}
```

The corresponding tests for `canCommitHand` should be marked `it.skip` for this task and re-enabled in Task 5.

- [ ] **Step 4: Run — expect pass on `validateRowHand` tests, skipped `canCommitHand`.**

```bash
bun test tests/rowHands.test.ts
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/core/engine/rowHands.ts tests/rowHands.test.ts
git commit -m "feat(core): add validateRowHand; stub canCommitHand pending InfluenceRow refactor"
```

---

## Phase 2: Schema refactor + evaluator rewrite

### Task 4: Refactor `InfluenceRow.card` → `InfluenceRow.cards`

This is the schema change. It touches every reader of `InfluenceRow`. Each reader switches to `cards[0]` (single-card behavior preserved) so existing tests still pass.

**Files:**
- Modify: `src/core/engine/column.ts`
- Modify: `src/core/engine/commands.ts`
- Modify: `src/facade/GameAPI.ts`
- Modify: `src/renderer/components/game/InfluenceCell.vue`
- Modify: `src/renderer/components/game/TableauColumn.vue`
- Modify: `src/renderer/components/game/ColumnFooter.vue`
- Modify any other readers surfaced by typecheck
- Test: existing tests (`tests/column.test.ts`, `tests/dispatch.test.ts`, `tests/smoke.test.ts`) should still pass after refactor

- [ ] **Step 1: Update `InfluenceRow` and `ColumnConfig`.**

In `src/core/engine/column.ts`:

```ts
export interface InfluenceRow {
  /** All same rank when non-empty; max 4 cards by pattern set. */
  cards: Card[];
}

export interface ColumnConfig {
  lands: string[];
  influence?: string[];
  charter?: string;
}
```

Update `createEmptyColumn`:

```ts
export function createEmptyColumn(): Column {
  return {
    lands: { cards: [] },
    influence: { cards: [] },
    charter: { card: null },
  };
}
```

Update `canPlaceInfluence` (still preserves single-card behavior for now — Task 6 adds row-hand validation):

```ts
export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (card.kind !== "role") return false;
  if (col.influence.cards.length >= 1) return false;
  return col.lands.cards.length >= 1;
}
```

Update `placeInfluence`:

```ts
export function placeInfluence(col: Column, card: Card): void {
  col.influence.cards.push(card);
}
```

Update `columnCards`:

```ts
export function columnCards(col: Column): Card[] {
  const out: Card[] = [...col.lands.cards];
  out.push(...col.influence.cards);
  if (col.charter.card) out.push(col.charter.card);
  return out;
}
```

Update `isBuildable`:

```ts
export function isBuildable(col: Column): boolean {
  return (
    col.lands.cards.length >= 1 &&
    col.influence.cards.length >= 1 &&
    col.charter.card !== null
  );
}
```

Update `columnFromConfig`:

```ts
export function columnFromConfig(
  cfg: ColumnConfig,
  resolve: (id: string) => Card | undefined,
): Column {
  const col = createEmptyColumn();
  for (const id of cfg.lands) {
    const c = resolve(id);
    if (c) col.lands.cards.push(c);
  }
  for (const id of cfg.influence ?? []) {
    const c = resolve(id);
    if (c) col.influence.cards.push(c);
  }
  if (cfg.charter) {
    const c = resolve(cfg.charter);
    if (c) col.charter.card = c;
  }
  return col;
}
```

Update `clearColumn`:

```ts
export function clearColumn(col: Column): void {
  col.lands.cards.length = 0;
  col.influence.cards.length = 0;
  col.charter.card = null;
}
```

- [ ] **Step 2: Update `recallInfluence` in `commands.ts` to wipe the entire influence stack.**

Replace the existing `recallInfluence`:

```ts
export function recallInfluence(
  epoch: Epoch,
  columnIndex: number,
): CmdResult<Card[]> {
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "no such column" };
  if (col.influence.cards.length === 0) return { ok: false, error: "no influence to recall" };
  const recalled = [...col.influence.cards];
  for (const card of recalled) {
    dispatch(epoch, { type: "card-discarded", card, source: "influence-recall" });
  }
  col.influence.cards.length = 0;
  return { ok: true, value: recalled };
}
```

Each card emits a `card-discarded` event — the existing handler adds 1 Dissent per discard, matching the user's stated rule for row-wipe discards.

- [ ] **Step 3: Update `GameAPI.snapshot()` to deep-clone influence stacks.**

Find the section in `src/facade/GameAPI.ts` that builds the column snapshot. Update influence cloning so the snapshot's `influence.cards` is a fresh array:

```ts
// inside the column-cloning loop
influence: { cards: col.influence.cards.map((c) => ({ ...c })) },
```

- [ ] **Step 4: Update renderer readers to `cards[0]`.**

In `src/renderer/components/game/InfluenceCell.vue`, wherever the template references `col.influence.card`, change to:

```vue
<!-- Single-card behavior preserved until Task 14 introduces stack rendering. -->
<script setup lang="ts">
const card = computed(() => props.col.influence.cards[0] ?? null);
</script>
```

Same change anywhere `col.influence.card` is referenced in `TableauColumn.vue`, `ColumnFooter.vue`, etc. Use `cards[0] ?? null`.

- [ ] **Step 5: Re-enable the skipped `canCommitHand` tests from Task 3.**

Change `it.skip(...)` back to `it(...)` for the four `canCommitHand` cases in `tests/rowHands.test.ts`.

Replace the stub implementation in `src/core/engine/rowHands.ts` with the real one (the `_col`/`_row`/`_newCards` stub becomes the body shown in Task 3 Step 3 above).

- [ ] **Step 6: Run the full test suite and typecheck.**

```bash
bun test
bun run typecheck
```

Expected: all green, including the four `canCommitHand` tests. Pre-existing tests should still pass — single-card behavior was preserved.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "refactor(core): InfluenceRow holds a card stack (cards: Card[])

Single-card placement and rendering preserved; row-stacking gameplay
arrives in subsequent commits. recallInfluence now emits a discard
event per card in the recalled stack."
```

---

### Task 5: Rewrite `evaluateColumn` for the 10-pattern column resolution

**Files:**
- Modify: `src/core/engine/columnPatterns.ts`
- Modify: `tests/columnPatterns.test.ts`

- [ ] **Step 1: Add failing tests for each new pattern and combination.**

Add to `tests/columnPatterns.test.ts` (alongside existing cases):

```ts
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import { createEmptyColumn, placeLand, placeInfluence, placeCharter } from "../src/core/engine/column.ts";
import { ALL_CARDS } from "../src/core/data/cards.ts";

const projects = [
  { id: "p-hc",   pattern: "high-card",       name: "", flavor: "", value: 1 },
  { id: "p-pr",   pattern: "pair",            name: "", flavor: "", value: 2 },
  { id: "p-2p",   pattern: "two-pair",        name: "", flavor: "", value: 3 },
  { id: "p-3",    pattern: "three-of-a-kind", name: "", flavor: "", value: 4 },
  { id: "p-st",   pattern: "straight",        name: "", flavor: "", value: 5 },
  { id: "p-fl",   pattern: "flush",           name: "", flavor: "", value: 6 },
  { id: "p-fh",   pattern: "full-house",      name: "", flavor: "", value: 7 },
  { id: "p-4",    pattern: "four-of-a-kind",  name: "", flavor: "", value: 8 },
  { id: "p-sf",   pattern: "straight-flush",  name: "", flavor: "", value: 10 },
  { id: "p-rf",   pattern: "royal-flush",     name: "", flavor: "", value: 12 },
] as const;

describe("evaluateColumn — new patterns", () => {
  it("identifies two-pair via cross-row pair + pair", () => {
    const col = buildColumn({
      lands: [pickLandPair()],            // 2 same-rank lands
      roles: [pickRolePair()],            // 2 same-role roles
      charter: anyCharter(),
    });
    expect(evaluateColumn(col, projects)?.kind).toBe("two-pair");
  });

  it("identifies full-house via three-in-land + pair-in-role", () => {
    const col = buildColumn({
      lands: nOfRank(landsPool(), 3),
      roles: pairOfRole(),
      charter: anyCharter(),
    });
    expect(evaluateColumn(col, projects)?.kind).toBe("full-house");
  });

  it("identifies straight when the land row is 5 consecutive ranks", () => {
    const col = buildColumn({
      lands: consecutiveLands(landsPool(), 5),
      roles: [anyRole()],
      charter: anyCharter(),
    });
    expect(evaluateColumn(col, projects)?.kind).toBe("straight");
  });

  it("identifies straight-flush — land-row straight + every column card shares ideology", () => {
    const col = buildColumn(monoideologicalStraightLand());
    expect(evaluateColumn(col, projects)?.kind).toBe("straight-flush");
  });

  it("identifies royal-flush — role-row straight (10-A) + every column card shares ideology", () => {
    const col = buildColumn(monoideologicalRoleStraight());
    expect(evaluateColumn(col, projects)?.kind).toBe("royal-flush");
  });

  it("flush beats straight (every-card-same-ideology, no straight)", () => {
    const col = buildColumn(monoideologicalNonStraight());
    expect(evaluateColumn(col, projects)?.kind).toBe("flush");
  });

  it("four-of-a-kind beats flush", () => {
    const col = buildColumn({
      lands: nOfRank(landsPool(), 4),  // four-of-a-kind in lands
      roles: [anyRole()],
      charter: anyCharter(),
    });
    expect(evaluateColumn(col, projects)?.kind).toBe("four-of-a-kind");
  });
});

// --- builders ---
// (Add helpers analogous to the rowHands.test.ts pattern, returning ready
// Card[] arrays or fully-built Columns. See rowHands.test.ts for the
// helper style; reuse identical pickers where possible.)
```

(Helpers `landsPool`, `pickLandPair`, `pickRolePair`, `nOfRank`, `consecutiveLands`, `monoideologicalStraightLand`, `monoideologicalRoleStraight`, `monoideologicalNonStraight`, `anyRole`, `anyCharter`, `buildColumn` mirror the row-hand helpers — implement them inline at the top or bottom of the test file. **Do not** import them from `rowHands.test.ts`; duplicate the helpers to keep test files self-contained.)

- [ ] **Step 2: Run — expect failures.**

```bash
bun test tests/columnPatterns.test.ts
```

- [ ] **Step 3: Replace `evaluateColumn` in `src/core/engine/columnPatterns.ts`.**

```ts
import type { Card, Column, KeystoneProject, PatternKind } from "../types.ts";
import { columnCards, isBuildable } from "./column.ts";
import { identifyRowHand, type RowHand } from "./rowHands.ts";

export interface PatternMatch {
  kind: PatternKind;
  projectId: string;
  cards: Card[];
}

export function evaluateColumn(col: Column, projects: KeystoneProject[]): PatternMatch | null {
  if (!isBuildable(col)) return null;

  const cards = columnCards(col);
  const landHand = identifyRowHand(col.lands.cards);
  const roleHand = identifyRowHand(col.influence.cards);
  const isColumnFlush = sharesOneIdeology(cards);

  const kind = resolveColumnPattern(landHand, roleHand, isColumnFlush);
  if (kind === null) return null;

  const project = projects.find((p) => p.pattern === kind);
  if (!project) return null;
  return { kind, projectId: project.id, cards };
}

function resolveColumnPattern(
  land: RowHand | null,
  role: RowHand | null,
  flush: boolean,
): PatternKind | null {
  if (land === null || role === null) return null;

  // 1. royal-flush — role-row straight + column-flush
  if (role === "straight" && flush) return "royal-flush";

  // 2. straight-flush — land-row straight + column-flush
  if (land === "straight" && flush) return "straight-flush";

  // 3. four-of-a-kind — any row has four
  if (land === "four-of-a-kind" || role === "four-of-a-kind") return "four-of-a-kind";

  // 4. full-house — row has full-house, OR one row has three + the other has at least a pair
  if (land === "full-house" || role === "full-house") return "full-house";
  if (land === "three-of-a-kind" && containsPair(role)) return "full-house";
  if (role === "three-of-a-kind" && containsPair(land)) return "full-house";

  // 5. flush — column-wide ideology
  if (flush) return "flush";

  // 6. straight — any row contains a straight
  if (land === "straight" || role === "straight") return "straight";

  // 7. three-of-a-kind — any row has three
  if (land === "three-of-a-kind" || role === "three-of-a-kind") return "three-of-a-kind";

  // 8. two-pair — row has two-pair, OR both rows have at least a pair
  if (land === "two-pair" || role === "two-pair") return "two-pair";
  if (containsPair(land) && containsPair(role)) return "two-pair";

  // 9. pair — any row has a pair
  if (land === "pair" || role === "pair") return "pair";

  // 10. high-card
  return "high-card";
}

function containsPair(h: RowHand | null): boolean {
  // "Has at least a pair structurally" — any row with 2+ same-rank cards.
  return (
    h === "pair" ||
    h === "two-pair" ||
    h === "three-of-a-kind" ||
    h === "four-of-a-kind" ||
    h === "full-house"
  );
}

function sharesOneIdeology(cards: Card[]): boolean {
  if (cards.some((c) => c.ideology === "wild")) return false;
  if (cards.length === 0) return false;
  const ideology = cards[0].ideology;
  return cards.every((c) => c.ideology === ideology);
}
```

Note the explicit "three + pair across rows = full-house" rule: this is checked via `hasThree && hasPair`, and we guard that the three and the pair aren't both supplied by the *same* hand classification — handled by the row-level full-house check earlier.

- [ ] **Step 4: Run — expect pass on the new tests and all pre-existing.**

```bash
bun test
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/core/engine/columnPatterns.ts tests/columnPatterns.test.ts
git commit -m "feat(core): evaluateColumn handles the 10-pattern row+column resolution"
```

---

### Task 6: Tighten `canPlaceInfluence` — single-card placement must keep the row a valid hand

**Files:**
- Modify: `src/core/engine/column.ts`
- Modify: `tests/column.test.ts`

- [ ] **Step 1: Add failing tests.**

Add to `tests/column.test.ts`:

```ts
import { canPlaceInfluence, placeInfluence, createEmptyColumn, placeLand } from "../src/core/engine/column.ts";
import { ALL_CARDS } from "../src/core/data/cards.ts";

describe("canPlaceInfluence single-card growth", () => {
  it("first role on an empty influence row is valid (high-card)", () => {
    const col = createEmptyColumn();
    placeLand(col, anyLand());
    const role = ALL_CARDS.find((c) => c.kind === "role")!;
    expect(canPlaceInfluence(col, role)).toBe(true);
  });

  it("adding a same-role-type role grows pair (valid)", () => {
    const col = createEmptyColumn();
    placeLand(col, anyLand());
    const sameRolePair = nOfRole(ALL_CARDS, 2); // 2 cards with the same role
    placeInfluence(col, sameRolePair[0]);
    expect(canPlaceInfluence(col, sameRolePair[1])).toBe(true);
  });

  it("adding a different-role role to a single high-card role is rejected", () => {
    const col = createEmptyColumn();
    placeLand(col, anyLand());
    const a = ALL_CARDS.find((c) => c.kind === "role" && c.role === "agitator")!;
    const b = ALL_CARDS.find((c) => c.kind === "role" && c.role === "scholar")!;
    placeInfluence(col, a);
    expect(canPlaceInfluence(col, b)).toBe(false);
  });

  it("requires at least one land in the column", () => {
    const col = createEmptyColumn();
    const role = ALL_CARDS.find((c) => c.kind === "role")!;
    expect(canPlaceInfluence(col, role)).toBe(false);
  });
});

function anyLand() { return ALL_CARDS.find((c) => c.kind === "land")!; }
function nOfRole(pool: typeof ALL_CARDS, n: number) {
  for (const role of ["agitator", "scholar", "preacher", "engineer", "architect"] as const) {
    const same = pool.filter((c) => c.kind === "role" && c.role === role);
    if (same.length >= n) return same.slice(0, n);
  }
  throw new Error(`no n-role available`);
}
```

- [ ] **Step 2: Run — expect failure on the "different-role" rejection case (currently `canPlaceInfluence` only checks that `cards.length >= 1` blocks placement).**

```bash
bun test tests/column.test.ts
```

- [ ] **Step 3: Update `canPlaceInfluence`.**

```ts
import { validateRowHand } from "./rowHands.ts";

export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (card.kind !== "role") return false;
  if (col.lands.cards.length < 1) return false;
  return validateRowHand([...col.influence.cards, card]);
}
```

Also tighten `canPlaceLand` symmetrically for consistency (lands already enforce same-rank, but route through `validateRowHand` to share the codepath):

```ts
export function canPlaceLand(col: Column, card: Card): boolean {
  if (card.kind !== "land") return false;
  return validateRowHand([...col.lands.cards, card]);
}
```

The existing `MAX_LAND_DEPTH = 4` constant becomes redundant (`validateRowHand` rejects 5 same-rank cards because 5-of-a-kind is not a row hand). Leave the constant in place for export-compat but stop relying on it for the gate.

- [ ] **Step 4: Run — expect pass.**

```bash
bun test
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/core/engine/column.ts tests/column.test.ts
git commit -m "feat(core): single-card placement routes through validateRowHand"
```

---

## Phase 3: Multi-card commit

### Task 7: Add `cards-committed` event + dispatch handler

**Files:**
- Modify: `src/core/engine/events.ts`
- Modify: `src/core/engine/dispatch.ts`
- Modify: `tests/dispatch.test.ts`

- [ ] **Step 1: Add failing test.**

Add to `tests/dispatch.test.ts`:

```ts
import { dispatch } from "../src/core/engine/dispatch.ts";
import { createEpoch } from "../src/core/engine/epoch.ts";
import { ALL_CARDS } from "../src/core/data/cards.ts";

describe("cards-committed event", () => {
  it("appends cards to the target row in order", () => {
    const epoch = createEpoch(/* test fixture */);
    const lands = ALL_CARDS.filter((c) => c.kind === "land");
    const pair = nOfRank(lands, 2);
    dispatch(epoch, {
      type: "cards-committed",
      columnIndex: 0,
      row: "land",
      cards: pair,
    });
    expect(epoch.columns[0].lands.cards.map((c) => c.id)).toEqual([pair[0].id, pair[1].id]);
  });

  it("does NOT add Dissent", () => {
    const epoch = createEpoch(/* test fixture */);
    const before = countDissentInDeck(epoch); // import from effects.ts
    const lands = ALL_CARDS.filter((c) => c.kind === "land");
    dispatch(epoch, {
      type: "cards-committed",
      columnIndex: 0,
      row: "land",
      cards: nOfRank(lands, 2),
    });
    expect(countDissentInDeck(epoch)).toBe(before);
  });

  it("fires each card's immediate effect in placement order", () => {
    // Choose cards with measurable side effects (e.g. gainInfluence). Assert
    // running influence increments stepwise.
  });
});
```

(`createEpoch` test fixture: use `forceSettingId: "homeworld"` and a fixed seed; copy the pattern from existing `dispatch.test.ts` cases.)

- [ ] **Step 2: Run — expect failure (event type unknown).**

```bash
bun test tests/dispatch.test.ts
```

- [ ] **Step 3: Add the event type.**

In `src/core/engine/events.ts`, extend the `GameEvent` union:

```ts
export type GameEvent =
  // ... existing variants ...
  | {
      type: "cards-committed";
      columnIndex: number;
      row: "land" | "influence";
      cards: Card[];
    };
```

- [ ] **Step 4: Add the handler.**

In `src/core/engine/dispatch.ts`, in the central `switch (ev.type)`:

```ts
case "cards-committed": {
  const col = epoch.columns[ev.columnIndex];
  if (!col) return;
  const target = ev.row === "land" ? col.lands.cards : col.influence.cards;
  for (const card of ev.cards) {
    target.push(card);
    // Per-card immediate effect — same path used by single placements.
    applyEffect(epoch, card.effect, card);
  }
  return;
}
```

Note: **no Dissent path here.** The `card-discarded` handler stays the only source of Dissent.

- [ ] **Step 5: Run — expect pass.**

```bash
bun test
bun run typecheck
```

- [ ] **Step 6: Commit.**

```bash
git add src/core/engine/events.ts src/core/engine/dispatch.ts tests/dispatch.test.ts
git commit -m "feat(core): cards-committed event appends N cards with per-card effects, no Dissent"
```

---

### Task 8: Add `commitHand` command

**Files:**
- Modify: `src/core/engine/commands.ts`
- Modify: `tests/column.test.ts` or create `tests/commands.test.ts` if it doesn't exist

- [ ] **Step 1: Add failing test.**

```ts
import { commitHand } from "../src/core/engine/commands.ts";

describe("commitHand", () => {
  it("succeeds when the resulting row is a valid hand and the player can afford it", () => {
    const epoch = createEpoch({ forceSettingId: "homeworld" });
    epoch.hand = [/* set up hand with 2 same-rank lands by mutation or fixture */];
    const result = commitHand(epoch, 0, "land", [epoch.hand[0].id, epoch.hand[1].id]);
    expect(result.ok).toBe(true);
    expect(epoch.columns[0].lands.cards.length).toBe(2);
  });

  it("rejects when cards aren't in hand", () => {
    const epoch = createEpoch({ forceSettingId: "homeworld" });
    const result = commitHand(epoch, 0, "land", ["card-that-isn't-in-hand"]);
    expect(result.ok).toBe(false);
  });

  it("rejects when the resulting row isn't a valid hand", () => {
    // Two different-rank lands → not a hand.
    const epoch = createEpoch({ forceSettingId: "homeworld" });
    // Ensure hand contains two different-rank lands.
    const result = commitHand(epoch, 0, "land", [twoDifferentLandIds]);
    expect(result.ok).toBe(false);
  });

  it("deducts the summed influence cost", () => {
    // Set up: hand with two roles whose total influenceCost is known.
    // After commit, epoch.influence should drop by the sum.
  });
});
```

- [ ] **Step 2: Run — expect failure.**

```bash
bun test
```

- [ ] **Step 3: Implement `commitHand`.**

Add to `src/core/engine/commands.ts`:

```ts
import { canCommitHand } from "./rowHands.ts";

export function commitHand(
  epoch: Epoch,
  columnIndex: number,
  row: "land" | "influence",
  cardIds: string[],
): CmdResult<Card[]> {
  if (cardIds.length === 0) return { ok: false, error: "no cards" };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "no such column" };

  // 1. Resolve cardIds → Card[] in hand, preserving order.
  const cards: Card[] = [];
  for (const id of cardIds) {
    const c = epoch.hand.find((h) => h.id === id);
    if (!c) return { ok: false, error: `card ${id} not in hand` };
    cards.push(c);
  }

  // 2. Kind check + row-hand validation.
  if (!canCommitHand(col, row, cards)) {
    return { ok: false, error: "not a valid hand" };
  }

  // 3. Influence affordability (roles only — lands have no influenceCost in play).
  if (row === "influence") {
    const totalCost = cards.reduce((sum, c) => sum + effectiveInfluenceCost(epoch, c), 0);
    if (epoch.influence < totalCost) {
      return { ok: false, error: "not enough influence" };
    }
    epoch.influence -= totalCost;
  }

  // 4. Remove cards from hand.
  epoch.hand = epoch.hand.filter((h) => !cardIds.includes(h.id));

  // 5. Dispatch the event (handler appends + fires effects).
  dispatch(epoch, {
    type: "cards-committed",
    columnIndex,
    row,
    cards,
  });

  return { ok: true, value: cards };
}
```

- [ ] **Step 4: Run — expect pass.**

```bash
bun test
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/core/engine/commands.ts tests/
git commit -m "feat(core): commitHand command — atomic multi-card row placement"
```

---

### Task 9: Expose `commitHand` via `GameAPI` + extend smoke test

**Files:**
- Modify: `src/facade/GameAPI.ts`
- Modify: `tests/smoke.test.ts`

- [ ] **Step 1: Add failing test.**

In `tests/smoke.test.ts`:

```ts
it("commits a pair of lands via GameAPI.commitHand", () => {
  const api = new GameAPI({ forceSettingId: "homeworld" });
  // Cycle/draw until hand contains two same-rank lands.
  // ...
  const ids = [/* two land ids of matching rank in api.snapshot().hand */];
  const result = api.commitHand(0, "land", ids);
  expect(result.ok).toBe(true);
  expect(api.snapshot().columns[0].lands.cards.length).toBe(2);
});
```

- [ ] **Step 2: Run — expect failure (method missing).**

- [ ] **Step 3: Add `commitHand` to GameAPI.**

```ts
import { commitHand as commitHandCmd } from "../core/engine/commands.ts";

// inside the GameAPI class:
commitHand(
  columnIndex: number,
  row: "land" | "influence",
  cardIds: string[],
): CommandResult<Card[]> {
  const result = commitHandCmd(this.epoch, columnIndex, row, cardIds);
  if (result.ok) this.persist();
  return result;
}
```

- [ ] **Step 4: Run — expect pass.**

```bash
bun test
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/facade/GameAPI.ts tests/smoke.test.ts
git commit -m "feat(facade): GameAPI.commitHand"
```

---

### Task 10: Bump persistence to `v4`; archive `v3` saves

**Files:**
- Modify: `src/facade/persistence.ts`

- [ ] **Step 1: Update keys.**

```ts
const STORE_KEY = "deck-demo-saves-v4";
const PREV_KEY = "deck-demo-saves-v3";
const ARCHIVE_KEY = "deck-demo-saves-v3-archive";
```

The existing archive-on-first-load code path (which moved `v2` → `v2-archive`) already handles the new versions correctly via the constants — just verify by reading the file. **No migration code; existing v3 saves are archived as-is.**

- [ ] **Step 2: Run typecheck and the smoke test.**

```bash
bun test tests/smoke.test.ts
bun run typecheck
```

- [ ] **Step 3: Commit.**

```bash
git add src/facade/persistence.ts
git commit -m "chore(facade): bump save store to v4 (archive v3 without migration)"
```

---

## Phase 4: Author new keystone content

### Task 11: Audit Generation Ship and Ruined Homeworld deck filters

Read-only audit; result goes into the next three tasks as authoring guidance.

- [ ] **Step 1: Read each Setting's startingDeck filter and enumerate reachable patterns.**

```bash
$EDITOR src/core/settings/generationShip.ts
$EDITOR src/core/settings/ruinedHomeworld.ts
```

For each Setting, note in the plan executor's working notes:
- Which ideologies are in the deck
- Which land ranks are present
- Whether a 5-card land straight is possible (need 5 consecutive ranks present)
- Whether all 5 role types are present
- Whether all 5 roles can be mono-ideology (for royal flush)

Sample output format (write to `docs/superpowers/plans/notes/2026-05-13-deck-audit.md` if useful, or just hold in execution context):

```
Generation Ship:
- Ideologies: <list>
- Land ranks present: <list>
- Reachable land patterns: high-card, pair, three, four (if duplicates exist), straight (if ranks consecutive)
- Reachable role patterns: ...
- Column flush: yes (mono-ideology subset feasible)
- Royal flush: <yes/no>
- Straight flush: <yes/no>
```

- [ ] **Step 2: Commit the audit notes (optional).**

```bash
git add docs/superpowers/plans/notes/2026-05-13-deck-audit.md  # if created
git commit -m "docs: deck-composition audit for setting keystone authoring"
```

---

### Task 12: Author 5 new keystones for Homeworld

**Files:**
- Modify: `src/core/settings/homeworld.ts`

- [ ] **Step 1: Add five new entries to `PROJECTS`.**

Pattern (each entry):

```ts
{
  id: "homeworld-two-pair",
  pattern: "two-pair",
  name: "<flavorful name>",
  flavor: "<one-line lore>",
  value: 3,                     // or override DEFAULT_PROJECT_VALUE for tuning
  unlockEffect: /* optional */,
},
// ... and similar for: straight, full-house, straight-flush, royal-flush
```

Specifically author entries for `two-pair`, `straight`, `full-house`, `straight-flush`, `royal-flush`. Lean on existing Homeworld project names and lore for tone — open source code for inspiration is fine.

- [ ] **Step 2: Typecheck and run tests.**

```bash
bun run typecheck
bun test
```

The full Setting now has 10 projects (one per `PatternKind`); typecheck no longer flags Homeworld's `projects` array.

- [ ] **Step 3: Commit.**

```bash
git add src/core/settings/homeworld.ts
git commit -m "feat(content): Homeworld — two-pair, straight, full-house, straight-flush, royal-flush keystones"
```

---

### Task 13: Author 5 new keystones for Generation Ship

**Files:**
- Modify: `src/core/settings/generationShip.ts`

- [ ] **Step 1: Add five entries — `two-pair`, `straight`, `full-house`, `straight-flush`, `royal-flush`.**

Even if a pattern is unreachable in the deck (per the audit), still author the keystone — the data must be complete for typecheck and Crisis resolution. Players just never trigger unreachable ones.

- [ ] **Step 2: Typecheck + tests.**

```bash
bun run typecheck
bun test
```

- [ ] **Step 3: Commit.**

```bash
git add src/core/settings/generationShip.ts
git commit -m "feat(content): Generation Ship — five new keystones"
```

---

### Task 14: Author 5 new keystones for Ruined Homeworld

**Files:**
- Modify: `src/core/settings/ruinedHomeworld.ts`

- [ ] **Step 1: Author the five entries** (same pattern as Tasks 12 + 13).

- [ ] **Step 2: Typecheck + tests.**

```bash
bun run typecheck
bun test
```

- [ ] **Step 3: Commit.**

```bash
git add src/core/settings/ruinedHomeworld.ts
git commit -m "feat(content): Ruined Homeworld — five new keystones"
```

---

## Phase 5: UI

UI work has no unit-test coverage in the existing codebase. Each task is: implement → `bun run typecheck` → start `bun run dev`, click through the affordances in the browser, confirm specific behaviors. Plan tasks list the exact behaviors to confirm.

### Task 15: HandPanel multi-select + commit buffer (D-1 interaction)

**Files:**
- Modify: `src/renderer/components/game/HandPanel.vue`
- Modify: `src/renderer/GameService.ts` (expose buffer state + commit handler)

- [ ] **Step 1: Add reactive buffer state to GameService.**

```ts
// In GameService.ts
const commitBuffer = ref<string[]>([]); // card ids selected from hand
function toggleBufferCard(id: string) {
  const i = commitBuffer.value.indexOf(id);
  if (i >= 0) commitBuffer.value.splice(i, 1);
  else commitBuffer.value.push(id);
}
function clearBuffer() { commitBuffer.value.length = 0; }
```

- [ ] **Step 2: Update HandPanel.vue.**

- Render each hand card with a click toggle that calls `toggleBufferCard(card.id)` and applies a selected style when present in the buffer.
- Below the hand grid, when `commitBuffer.length >= 2`, render a "Lay down hand" affordance per row (`land`, `influence`):
  - Resolve the currently-buffered cards (`Card[]`) and call a `previewRowHand(buffered, targetRow)` helper to display the row-hand classification or "not a valid hand".
  - Disable the per-row commit button when the buffer + target row would not form a valid hand.
  - Sum and display the influence cost.
- On commit, call `gameService.commitHand(columnIndex, row, bufferedCardIds)`. The column is selected by the user clicking a column header / drop zone; until selected, the commit affordance is "select a target column".

- [ ] **Step 3: Manual browser verification.**

```bash
bun run dev
```

Open http://localhost:5173 and:
- Click 2 same-rank lands in hand. Confirm the buffer panel shows "pair", cost 0 (lands no cost), enabled "lay down" button.
- Click a different-rank land — buffer panel shows "not a valid hand", button disabled.
- Click 5 consecutive-rank lands — panel shows "straight", button enabled.
- With a valid buffer, click a column. Confirm the row is filled with the buffered cards in order.
- Confirm Dissent count did NOT change after commit.
- Confirm individual single-card placement still works (click one card, click a row — same as before this PR).

- [ ] **Step 4: Commit.**

```bash
git add src/renderer/components/game/HandPanel.vue src/renderer/GameService.ts
git commit -m "feat(ui): HandPanel multi-select + lay-down-hand commit"
```

---

### Task 16: InfluenceCell renders as a stack

**Files:**
- Modify: `src/renderer/components/game/InfluenceCell.vue`

Visually port the rendering idiom from `LandCell.vue` — overlapping card images with a depth indicator.

- [ ] **Step 1: Replace the single-card render with a stack render.**

Adapt from `LandCell.vue`'s template; bind to `col.influence.cards`.

- [ ] **Step 2: Manual verification.**

- With a column that has 2 roles of the same role-type, confirm both render stacked.
- Confirm a single role still renders cleanly.

- [ ] **Step 3: Commit.**

```bash
git add src/renderer/components/game/InfluenceCell.vue
git commit -m "feat(ui): InfluenceCell renders the role stack"
```

---

### Task 17: TableauColumn layout adjustment for taller influence rows

**Files:**
- Modify: `src/renderer/components/game/TableauColumn.vue`
- Modify: `src/renderer/styles.css` (if needed)

- [ ] **Step 1: Adjust the column row height for the influence band** so a 4-stack still fits within the column visual envelope.

- [ ] **Step 2: Manual verification.**

- Build a column with 4 roles of one role-type. Confirm the layout doesn't break adjacent columns or footer.

- [ ] **Step 3: Commit.**

```bash
git add src/renderer/components/game/TableauColumn.vue src/renderer/styles.css
git commit -m "feat(ui): TableauColumn accommodates stacked influence rows"
```

---

### Task 18: ColumnFooter shows the new pattern names

**Files:**
- Modify: `src/renderer/components/game/ColumnFooter.vue`

- [ ] **Step 1: Extend the pattern → display-name map.**

```ts
const PATTERN_LABEL: Record<PatternKind, string> = {
  "high-card": "High Card",
  pair: "Pair",
  "two-pair": "Two Pair",
  "three-of-a-kind": "Three of a Kind",
  straight: "Straight",
  flush: "Flush",
  "full-house": "Full House",
  "four-of-a-kind": "Four of a Kind",
  "straight-flush": "Straight Flush",
  "royal-flush": "Royal Flush",
};
```

- [ ] **Step 2: Manual verification.**

- Build columns matching new patterns; confirm the footer surfaces the correct name.

- [ ] **Step 3: Commit.**

```bash
git add src/renderer/components/game/ColumnFooter.vue
git commit -m "feat(ui): ColumnFooter labels the five new patterns"
```

---

### Task 19: UnlockedProjectsPanel rows for new patterns

**Files:**
- Modify: `src/renderer/components/game/UnlockedProjectsPanel.vue`

- [ ] **Step 1: Extend the panel's pattern list** so all 10 patterns render rows with locked/unlocked state.

- [ ] **Step 2: Manual verification.**

- New patterns appear in order: high-card → ... → royal-flush.
- Unlocking a new pattern (e.g. building a two-pair) lights up the corresponding row.

- [ ] **Step 3: Commit.**

```bash
git add src/renderer/components/game/UnlockedProjectsPanel.vue
git commit -m "feat(ui): UnlockedProjectsPanel surfaces all 10 patterns"
```

---

## Phase 6: Balance

### Task 20: Crisis difficulty re-tune

**Files:**
- Modify: `src/core/settings/homeworld.ts`
- Modify: `src/core/settings/generationShip.ts`
- Modify: `src/core/settings/ruinedHomeworld.ts`

- [ ] **Step 1: Capture the pre-change baseline win rate** for each Setting using the existing simulator (data lives in git history at the parent branch tip).

```bash
git stash               # if any uncommitted UI changes are still in flight
git switch <baseline-branch>
bun run scripts/analyze-crisis.ts 300 homeworld
bun run scripts/analyze-crisis.ts 300 generation-ship
bun run scripts/analyze-crisis.ts 300 ruined-homeworld
git switch -            # back to feat/row-hand-stacking
git stash pop           # if needed
```

Record the baseline win-rate per Setting.

- [ ] **Step 2: Run the simulator on the new build per Setting.**

```bash
bun run scripts/analyze-crisis.ts 300 homeworld
bun run scripts/analyze-crisis.ts 300 generation-ship
bun run scripts/analyze-crisis.ts 300 ruined-homeworld
```

- [ ] **Step 3: Adjust `CRISIS.difficulty` in each Setting** until simulator win-rate is within ±5 percentage points of the baseline.

Iterate: tweak difficulty, re-run simulator, repeat per Setting.

- [ ] **Step 4: Run full test suite once more.**

```bash
bun test
bun run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/core/settings/*.ts
git commit -m "balance(content): retune Crisis difficulty per Setting after 10-pattern set"
```

---

## Phase 7: PR

### Task 21: Open PR targeting `feat/ui-colocate-projects-ideology-panels`

- [ ] **Step 1: Push the branch.**

```bash
git push -u origin feat/row-hand-stacking
```

- [ ] **Step 2: Create the PR with target branch = `feat/ui-colocate-projects-ideology-panels`.**

```bash
gh pr create \
  --base feat/ui-colocate-projects-ideology-panels \
  --head feat/row-hand-stacking \
  --title "feat: row-hand stacking across Land/Influence rows" \
  --body "$(cat <<'EOF'
## Summary
- Influence rows stack like Land rows; each row must form a configured poker hand after every placement.
- New patterns: two-pair, straight, full-house, straight-flush, royal-flush.
- New multi-card commit action (`commitHand`) for laying down patterns that can't grow incrementally (straight, two-pair, full-house).
- Save store bumped to v4; v3 saves archived without migration.

## Test plan
- [ ] `bun test` green
- [ ] `bun run typecheck` clean
- [ ] Manual: place 1 land, then a second same-rank land → pair forms
- [ ] Manual: select 5 consecutive-rank lands in hand → "lay down hand" enables → commit → straight forms
- [ ] Manual: complete a mono-ideology role straight → royal-flush keystone unlocks
- [ ] Manual: recall influence wipes the full stack and adds Dissent per card
- [ ] Crisis simulator win-rate ±5pp of baseline per Setting

Spec: `docs/superpowers/specs/2026-05-13-row-hand-stacking-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Self-review notes

- **Spec coverage check:** each spec section maps to a task — pattern set (Task 1), row mechanics (Tasks 2–6), commit event/command (Tasks 7–9), persistence (Task 10), content (Tasks 11–14), UI (Tasks 15–19), Crisis re-tune (Task 20), PR (Task 21).
- **Save migration:** spec says archive-no-migration; Task 10 implements exactly that.
- **Worktree + PR target:** Phase 0 + Task 21 enforce the worktree workflow and the non-`main` PR target.
- **Generation Ship deck constraint:** spec notes unreachable high-tier patterns are fine; Task 11 audits, Task 13 still authors complete keystones so typecheck stays clean and the Setting can later be expanded without code changes.
- **No-Dissent-on-commit:** explicit assertion in Task 7's tests; reinforced in Task 15's browser verification.
