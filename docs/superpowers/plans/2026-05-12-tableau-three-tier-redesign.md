# Tableau Three-Tier Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the tableau into a three-row column (Land / Influence / Charter), move Mega-Structure completion onto the column via poker-pattern detection, add per-Setting turn budgets and Crisis resolution, and centralize state mutation through a typed event dispatcher.

**Architecture:** New pure modules (`column.ts`, `columnPatterns.ts`, `events.ts`, `dispatch.ts`, `projects.ts`) replace `tableau.ts` and `patterns.ts`. `Setting` and `Epoch` shape change. GameAPI command surface is rewritten. Renderer gets a CSS-grid 3-row tableau (`TableauColumn` + `LandCell`/`InfluenceCell`/`CharterCell` + `ColumnFooter`) and a Crisis screen.

**Tech Stack:** Vue 3 + TypeScript + Vite + Bun. Bun test runner.

**Reference spec:** `docs/superpowers/specs/2026-05-12-tableau-three-tier-redesign-design.md`

**Compile state during execution:** Tasks 1–7 are additive and keep the project compiling. From Task 8 (Setting interface change) through Task 22 (renderer fully migrated), `bun run typecheck` and `bun test` may fail in intermediate states. Each task lands a coherent diff; the project returns to green at Task 22 and stays green after.

---

## File map

**Create:**
- `src/core/column.ts` — Column data + placement helpers (replaces `tableau.ts`)
- `src/core/columnPatterns.ts` — `evaluateColumn` poker engine (replaces `patterns.ts`)
- `src/core/events.ts` — `GameEvent` discriminated union
- `src/core/dispatch.ts` — single state-mutation entry point
- `src/core/projects.ts` — `KeystoneProject` defaults + lookup helpers
- `src/renderer/components/TableauColumn.vue` — one column wrapper
- `src/renderer/components/LandCell.vue`, `InfluenceCell.vue`, `CharterCell.vue` — row cells
- `src/renderer/components/ColumnFooter.vue` — per-column actions
- `src/renderer/components/UnlockedProjectsPanel.vue` — sidebar list
- `src/renderer/components/CrisisScreen.vue` — end-of-Epoch reveal
- `tests/column.test.ts`, `tests/columnPatterns.test.ts`, `tests/dispatch.test.ts`, `tests/projects.test.ts`, `tests/crisisflow.test.ts` — new test files

**Modify:**
- `src/core/types.ts` — types reshape
- `src/core/cards.ts` — `kind: "keystone"` → `kind: "charter"`; drop project-specific keystone metadata
- `src/core/epoch.ts` — command rewrite
- `src/core/effects.ts` — drop discard-for-Material helper (or keep but unused)
- `src/core/legacy.ts` — consume `CrisisOutcome`
- `src/core/campaign.ts` — `prepareEndOfEpoch` wires `CrisisOutcome`
- `src/core/ideology.ts` — `deriveVector` reads columns
- `src/core/homeworld.ts`, `generationShip.ts`, `ruinedHomeworld.ts` — new fields (`maxTurns`, `crisis`, `projects`, `startingColumns`)
- `src/facade/GameAPI.ts` — new command surface, new `Snapshot` shape
- `src/facade/persistence.ts` — bump v2 → v3, archive v2
- `src/renderer/GameService.ts` — new method bindings
- `src/renderer/App.vue` — wire new panels
- `src/renderer/components/TableauPanel.vue` — grid container
- `src/renderer/components/HandPanel.vue` — drop play-to-project path
- `src/renderer/components/TurnBar.vue` — turn budget display
- `tests/ideology.test.ts`, `tests/smoke.test.ts` — adapt to new command surface

**Delete:**
- `src/core/tableau.ts`
- `src/core/patterns.ts`
- `src/renderer/components/TableauSlot.vue`
- `src/renderer/components/ProjectZonesPanel.vue`
- `src/renderer/components/ProjectZone.vue`
- `src/renderer/components/EndOfEpochScreen.vue` (folded into `CrisisScreen.vue`)
- `tests/patterns.test.ts`, `tests/winflow.test.ts` (replaced by `columnPatterns.test.ts`, `crisisflow.test.ts`)

**Rename:**
- `scripts/analyze-paths.ts` → `scripts/analyze-crisis.ts` (rewrite heuristic)

---


## Phase A — Foundation (additive; build stays green)

### Task 1: Rename `keystone` card kind to `charter`

**Files:**
- Modify: `src/core/types.ts:20-22`
- Modify: `src/core/cards.ts` (5 keystone card definitions + filters + builder names)
- Modify: `src/core/tableau.ts` (canPlaceTopper check)
- Modify: `src/core/epoch.ts:197` (`card.kind === "role" || card.kind === "keystone"`)
- Modify: `src/core/generationShip.ts:11` (filter)
- Modify: `src/core/legacy.ts` (any references)
- Modify: `tests/patterns.test.ts` (will be deleted in Task 4; rename keystone refs anyway so the rest of the rename can be tested)

- [ ] **Step 1: Update CardKind and CardTag in types.ts**

```ts
// src/core/types.ts, line 20-22
export type CardKind = "land" | "role" | "charter" | "dissent" | "legacy";

export type CardTag = "dissent" | "charter" | "legacy" | "exclusive" | "purge" | "starter";
```

- [ ] **Step 2: Rename keystone usage across src/core/**

Run a find-and-replace across the core directory:

```bash
# Inside src/core/, replace "keystone" with "charter" in three forms:
#   "keystone" (literal kind/tag)   → "charter"
#   buildBaseKeystones / buildHomeworldProjectKeystones (function names) → ...BaseCharters / ...HomeworldProjectCharters
# Card *ids* keep their existing form ("keystone-founding-charter" etc.) — the id is opaque, do not rename it.
```

Manual edits required:
- `src/core/cards.ts`:
  - Function `buildBaseKeystones` → `buildBaseCharters`; `buildHomeworldProjectKeystones` → `buildHomeworldProjectCharters`.
  - Inside each of the 5 charter card literals: `kind: "keystone"` → `kind: "charter"`.
  - The `starterTags`/`tags` arrays use `"keystone"` as a CardTag — change to `"charter"`.
  - Update the `ALL_CARDS` spread to call the renamed builders.
- `src/core/tableau.ts:37` (`canPlaceTopper`): `topper.kind !== "role" && topper.kind !== "keystone"` → `topper.kind !== "role" && topper.kind !== "charter"`.
- `src/core/epoch.ts:197`: `card.kind === "role" || card.kind === "keystone"` → `card.kind === "role" || card.kind === "charter"`.
- `src/core/generationShip.ts:11`: `if (c.id === "keystone-founding-charter") return false;` — leave the id literal; this is a card-id filter, not a kind check.
- `src/core/legacy.ts:18`: no `keystone` references in the code I saw — verify with `grep`.
- `tests/patterns.test.ts`: card *ids* (e.g. `"keystone-founding-charter"`) keep their literal form; no edits needed.

- [ ] **Step 3: Verify with grep**

```bash
grep -rn "kind: \"keystone\"" src/ tests/
# Expected: no matches.
grep -rn "\"keystone\"" src/ tests/
# Expected: only matches inside card-id strings like "keystone-founding-charter".
```

- [ ] **Step 4: Typecheck + tests pass**

```bash
bun run typecheck && bun test
# Expected: 0 errors, all tests pass.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename card kind 'keystone' to 'charter'

Pure rename. Card ids retain their existing literals (which still
contain the word 'keystone'); only the kind / tag taxonomy is updated."
```

---

### Task 2: Add new types to `types.ts` (additive)

**Files:**
- Modify: `src/core/types.ts` — append new declarations; leave old (`TableauSlot`, `MegaProject`, `HandRequirement`, `CompletionTier`, etc.) in place

- [ ] **Step 1: Append new column-shape types**

Append to `src/core/types.ts` (do not remove anything yet):

```ts
// --------------------------------------------------------------------------
// New: three-tier column (replaces TableauSlot in a later task).
// --------------------------------------------------------------------------

export interface LandRow {
  cards: Card[]; // all same rank when non-empty; max 4
}

export interface InfluenceRow {
  card: Card | null; // a card with kind === "role"
}

export interface CharterRow {
  card: Card | null; // a card with kind === "charter"
}

export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  charter: CharterRow;
}

export interface ColumnConfig {
  lands: string[]; // card ids; must share rank
  influence?: string;
  charter?: string;
}
```

- [ ] **Step 2: Append pattern + project + crisis types**

```ts
export type PatternKind =
  | "high-card"
  | "pair"
  | "three-of-a-kind"
  | "flush"
  | "four-of-a-kind";

export interface KeystoneProject {
  id: string;
  pattern: PatternKind;
  name: string;
  flavor: string;
  value: number;            // contribution to Crisis score
  unlockEffect?: EffectSpec; // semantics deferred
}

export interface ProjectUnlock {
  projectId: string;
  pattern: PatternKind;
  turn: number;
  cards: Card[]; // snapshot of the built column at Build time
}

export interface Crisis {
  id: string;
  name: string;
  flavor: string;
  difficulty: number;
}

export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  contributingUnlocks: ProjectUnlock[]; // ordered: four → flush → three → pair → high-card, then turn order
}
```

- [ ] **Step 3: Append event + phase types**

```ts
export type DiscardSource = "tableau-land" | "tableau-charter" | "column" | "hand";

export type GameEvent =
  | { type: "card-played-to-land"; card: Card; columnIndex: number }
  | { type: "card-played-to-influence"; card: Card; columnIndex: number }
  | { type: "card-played-to-charter"; card: Card; columnIndex: number }
  | { type: "card-discarded"; card: Card; source: DiscardSource }
  | { type: "card-recalled-to-hand"; card: Card; columnIndex: number }
  | { type: "column-built"; columnIndex: number; unlock: ProjectUnlock }
  | { type: "dissent-added"; variant: DissentVariant }
  | { type: "turn-ended"; turn: number }
  | { type: "crisis-resolved"; outcome: CrisisOutcome };

// New phase enum (will replace the existing EpochPhase later).
export type EpochPhaseV2 = "play" | "crisis" | "end-of-epoch";
```

- [ ] **Step 4: Typecheck**

```bash
bun run typecheck
# Expected: 0 errors. Only additions; nothing removed yet.
```

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(types): add Column, KeystoneProject, Crisis, GameEvent types (additive)"
```

---

### Task 3: Create `src/core/column.ts` with placement helpers (TDD)

**Files:**
- Create: `src/core/column.ts`
- Test: `tests/column.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/column.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import {
  createEmptyColumn,
  canPlaceLand,
  canPlaceInfluence,
  canPlaceCharter,
  placeLand,
  placeInfluence,
  placeCharter,
  clearColumn,
  columnCards,
  columnLandRank,
  MAX_LAND_DEPTH,
} from "../src/core/column.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";

const land = (rank: number, ideology: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideology));
const role = (r: "agitator" | "scholar" | "preacher" | "engineer" | "architect", i: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(roleId(r, i));
const charter = () => getCard("keystone-founding-charter");

describe("column placement", () => {
  test("empty column accepts any land", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(true);
  });

  test("non-empty column rejects mismatched-rank land", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceLand(col, land(5, "heritage"))).toBe(false);
    expect(canPlaceLand(col, land(7, "heritage"))).toBe(true);
  });

  test("land row caps at MAX_LAND_DEPTH", () => {
    const col = createEmptyColumn();
    for (let i = 0; i < MAX_LAND_DEPTH; i++) placeLand(col, land(7, "solidarity"));
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(false);
  });

  test("influence row rejected when no lands placed", () => {
    const col = createEmptyColumn();
    expect(canPlaceInfluence(col, role("scholar", "solidarity"))).toBe(false);
  });

  test("influence row accepts a role once any land is placed", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, role("scholar", "solidarity"))).toBe(true);
  });

  test("influence row rejects when already filled", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    expect(canPlaceInfluence(col, role("engineer", "solidarity"))).toBe(false);
  });

  test("charter row rejected without influence", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceCharter(col, charter())).toBe(false);
  });

  test("charter row accepted once influence filled", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    expect(canPlaceCharter(col, charter())).toBe(true);
  });

  test("clearColumn empties all rows", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter());
    clearColumn(col);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.card).toBeNull();
    expect(col.charter.card).toBeNull();
  });

  test("columnCards returns all cards in lands+influence+charter order", () => {
    const col = createEmptyColumn();
    const l1 = land(7, "solidarity");
    const l2 = land(7, "heritage");
    const r = role("scholar", "solidarity");
    const ch = charter();
    placeLand(col, l1); placeLand(col, l2);
    placeInfluence(col, r); placeCharter(col, ch);
    expect(columnCards(col)).toEqual([l1, l2, r, ch]);
  });

  test("columnLandRank returns the rank of the first land, or null if empty", () => {
    const col = createEmptyColumn();
    expect(columnLandRank(col)).toBeNull();
    placeLand(col, land(7, "solidarity"));
    expect(columnLandRank(col)).toBe(7);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
bun test tests/column.test.ts
# Expected: import error / module not found.
```

- [ ] **Step 3: Implement `src/core/column.ts`**

```ts
// Column data + placement helpers. Replaces tableau.ts in a later task.

import type { Card, Column, ColumnConfig } from "./types.ts";

export const MAX_LAND_DEPTH = 4;

export function createEmptyColumn(): Column {
  return {
    lands: { cards: [] },
    influence: { card: null },
    charter: { card: null },
  };
}

export function canPlaceLand(col: Column, card: Card): boolean {
  if (card.kind !== "land") return false;
  if (col.lands.cards.length >= MAX_LAND_DEPTH) return false;
  if (col.lands.cards.length === 0) return true;
  return col.lands.cards[0]!.rank === card.rank;
}

export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (card.kind !== "role") return false;
  if (col.influence.card !== null) return false;
  return col.lands.cards.length >= 1;
}

export function canPlaceCharter(col: Column, card: Card): boolean {
  if (card.kind !== "charter") return false;
  if (col.charter.card !== null) return false;
  return col.influence.card !== null;
}

export function placeLand(col: Column, card: Card): void {
  col.lands.cards.push(card);
}

export function placeInfluence(col: Column, card: Card): void {
  col.influence.card = card;
}

export function placeCharter(col: Column, card: Card): void {
  col.charter.card = card;
}

export function clearColumn(col: Column): void {
  col.lands.cards.length = 0;
  col.influence.card = null;
  col.charter.card = null;
}

export function columnCards(col: Column): Card[] {
  const out: Card[] = [...col.lands.cards];
  if (col.influence.card) out.push(col.influence.card);
  if (col.charter.card) out.push(col.charter.card);
  return out;
}

export function columnLandRank(col: Column): number | null {
  return col.lands.cards[0]?.rank ?? null;
}

export function isBuildable(col: Column): boolean {
  return (
    col.lands.cards.length >= 1 &&
    col.influence.card !== null &&
    col.charter.card !== null
  );
}

export function columnFromConfig(
  cfg: ColumnConfig,
  resolve: (id: string) => Card | undefined,
): Column {
  const col = createEmptyColumn();
  for (const id of cfg.lands) {
    const c = resolve(id);
    if (c) col.lands.cards.push(c);
  }
  if (cfg.influence) {
    const c = resolve(cfg.influence);
    if (c) col.influence.card = c;
  }
  if (cfg.charter) {
    const c = resolve(cfg.charter);
    if (c) col.charter.card = c;
  }
  return col;
}
```

- [ ] **Step 4: Tests pass**

```bash
bun test tests/column.test.ts
# Expected: all green.
```

- [ ] **Step 5: Commit**

```bash
git add src/core/column.ts tests/column.test.ts
git commit -m "feat(core): add Column module with placement helpers"
```

---

### Task 4: Create `src/core/columnPatterns.ts` with `evaluateColumn` (TDD)

**Files:**
- Create: `src/core/columnPatterns.ts`
- Test: `tests/columnPatterns.test.ts`
- Delete: `tests/patterns.test.ts` (replaced)

- [ ] **Step 1: Write failing tests**

Create `tests/columnPatterns.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { evaluateColumn } from "../src/core/columnPatterns.ts";
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
  placeCharter,
} from "../src/core/column.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";
import type { KeystoneProject } from "../src/core/types.ts";

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));
const role = (r: "agitator" | "scholar" | "preacher" | "engineer" | "architect", i: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(roleId(r, i));
const charter = () => getCard("keystone-founding-charter");

const projects: KeystoneProject[] = [
  { id: "p-high",  pattern: "high-card",       name: "High",  flavor: "", value: 1 },
  { id: "p-pair",  pattern: "pair",            name: "Pair",  flavor: "", value: 2 },
  { id: "p-three", pattern: "three-of-a-kind", name: "Three", flavor: "", value: 4 },
  { id: "p-flush", pattern: "flush",           name: "Flush", flavor: "", value: 5 },
  { id: "p-four",  pattern: "four-of-a-kind",  name: "Four",  flavor: "", value: 8 },
];

function complete(rank: number, landIdeo: ("solidarity" | "sovereignty" | "transformation" | "heritage")[], roleIdeo: "solidarity" | "sovereignty" | "transformation" | "heritage" = "heritage") {
  const col = createEmptyColumn();
  for (const i of landIdeo) placeLand(col, land(rank, i));
  placeInfluence(col, role("scholar", roleIdeo));
  placeCharter(col, charter());
  return col;
}

describe("evaluateColumn", () => {
  test("returns null for incomplete column (no charter)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "heritage"));
    expect(evaluateColumn(col, projects)).toBeNull();
  });

  test("high-card: 1 land + role + charter, mixed ideology", () => {
    const m = evaluateColumn(complete(7, ["solidarity"]), projects);
    expect(m?.kind).toBe("high-card");
    expect(m?.projectId).toBe("p-high");
  });

  test("pair: 2 same-rank lands, mixed ideology", () => {
    const m = evaluateColumn(complete(7, ["solidarity", "heritage"], "sovereignty"), projects);
    expect(m?.kind).toBe("pair");
  });

  test("three-of-a-kind: 3 same-rank lands, mixed ideology", () => {
    const m = evaluateColumn(complete(7, ["solidarity", "heritage", "sovereignty"], "transformation"), projects);
    expect(m?.kind).toBe("three-of-a-kind");
  });

  test("four-of-a-kind: 4 same-rank lands, beats flush even if mono-ideology", () => {
    // Four-of-a-Kind needs four lands; lands of one suit + matching role/charter ideology → also a flush.
    // Charter is "keystone-founding-charter" with ideology "solidarity".
    const col = createEmptyColumn();
    for (let i = 0; i < 4; i++) placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity charter
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("four-of-a-kind");
  });

  test("flush wins over three-of-a-kind (poker order)", () => {
    // 3 mono-ideology lands + matching-ideology role + matching-ideology charter = all 5 same ideology.
    // Per poker order, Flush beats Three of a Kind, so result is flush.
    const col = createEmptyColumn();
    for (let i = 0; i < 3; i++) placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // ideology "solidarity"
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("flush also fires for 1-land or 2-land mono-ideology columns", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("a 'wild' charter or role is not treated as matching for flush", () => {
    // base keystone-pioneer has ideology "wild" — should not match an ideology-based flush.
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, getCard("keystone-pioneer")); // wild
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("pair");
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
bun test tests/columnPatterns.test.ts
# Expected: module not found.
```

- [ ] **Step 3: Implement `src/core/columnPatterns.ts`**

```ts
// Pure poker-pattern evaluator over a single Column.

import type { Card, Column, KeystoneProject, PatternKind } from "./types.ts";
import { columnCards, isBuildable } from "./column.ts";

export interface PatternMatch {
  kind: PatternKind;
  projectId: string;
  cards: Card[];
}

export function evaluateColumn(
  col: Column,
  projects: KeystoneProject[],
): PatternMatch | null {
  if (!isBuildable(col)) return null;

  const cards = columnCards(col);
  const landCount = col.lands.cards.length;
  const isFlush = sharesOneIdeology(cards);

  // Highest poker rank first.
  let kind: PatternKind;
  if (landCount === 4) {
    kind = "four-of-a-kind";
  } else if (isFlush) {
    kind = "flush";
  } else if (landCount === 3) {
    kind = "three-of-a-kind";
  } else if (landCount === 2) {
    kind = "pair";
  } else {
    kind = "high-card";
  }

  const project = projects.find((p) => p.pattern === kind);
  if (!project) return null;
  return { kind, projectId: project.id, cards };
}

function sharesOneIdeology(cards: Card[]): boolean {
  // "wild" cards never satisfy a flush.
  if (cards.some((c) => c.ideology === "wild")) return false;
  if (cards.length === 0) return false;
  const ideology = cards[0]!.ideology;
  return cards.every((c) => c.ideology === ideology);
}
```

- [ ] **Step 4: Tests pass**

```bash
bun test tests/columnPatterns.test.ts
# Expected: all green.
```

- [ ] **Step 5: Delete `tests/patterns.test.ts` and commit**

```bash
git rm tests/patterns.test.ts
git add src/core/columnPatterns.ts tests/columnPatterns.test.ts
git commit -m "feat(core): add columnPatterns evaluator; replace patterns.test"
```

---

### Task 5: Create `src/core/events.ts` (type re-export hub)

**Files:**
- Create: `src/core/events.ts`

This file is a thin re-export hub so consumers import the event union from a stable path independent of `types.ts`. The type itself was already declared in Task 2.

- [ ] **Step 1: Create `src/core/events.ts`**

```ts
// Re-export the GameEvent union and related types from a stable location.
// Consumers import { GameEvent, DiscardSource } from "./events.ts".
export type { GameEvent, DiscardSource } from "./types.ts";
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
# Expected: 0 errors.
```

- [ ] **Step 3: Commit**

```bash
git add src/core/events.ts
git commit -m "feat(core): add events.ts re-export hub for GameEvent"
```

---

### Task 6: Create `src/core/dispatch.ts` (TDD)

**Files:**
- Create: `src/core/dispatch.ts`
- Test: `tests/dispatch.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/dispatch.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { dispatch } from "../src/core/dispatch.ts";
import { createEmptyColumn, placeLand, placeInfluence, placeCharter } from "../src/core/column.ts";
import { getCard, landId, roleId, makeDissent } from "../src/core/cards.ts";
import type { Card, Column, Epoch, ProjectUnlock } from "../src/core/types.ts";

function freshEpoch(columns: Column[] = []): Epoch {
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
    influence: 0,
    materials: 0,
    taskProgress: {},
    tasksRevealed: [],
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  } as unknown as Epoch;
}

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("dispatch", () => {
  test("card-discarded pushes to discard pile AND adds a quiet dissent to deck", () => {
    const ep = freshEpoch();
    const card = land(7, "solidarity");
    dispatch(ep, { type: "card-discarded", card, source: "hand" });
    expect(ep.discard).toContain(card);
    const top = ep.draw[0];
    expect(top?.tags.includes("dissent")).toBe(true);
    expect(top?.name).toBe("Quiet Dissent");
  });

  test("dissent-added places a dissent card on top of the deck", () => {
    const ep = freshEpoch();
    dispatch(ep, { type: "dissent-added", variant: "quiet" });
    expect(ep.draw[0]?.tags.includes("dissent")).toBe(true);
  });

  test("card-recalled-to-hand moves card back to hand with no dissent", () => {
    const col = createEmptyColumn();
    const r = getCard(roleId("scholar", "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, r);
    const ep = freshEpoch([col]);
    dispatch(ep, { type: "card-recalled-to-hand", card: r, columnIndex: 0 });
    expect(ep.hand).toContain(r);
    expect(ep.draw.length).toBe(0); // no dissent
    expect(col.influence.card).toBeNull();
  });

  test("column-built cascades discards through the discard handler (one dissent per card) and clears the column", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    placeCharter(col, getCard("keystone-founding-charter"));
    const ep = freshEpoch([col]);
    const unlock: ProjectUnlock = {
      projectId: "p-pair",
      pattern: "pair",
      turn: ep.turn,
      cards: [...col.lands.cards, col.influence.card!, col.charter.card!],
    };
    dispatch(ep, { type: "column-built", columnIndex: 0, unlock });
    expect(ep.unlockedProjects).toContain(unlock);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.card).toBeNull();
    expect(col.charter.card).toBeNull();
    // 4 cards discarded → 4 dissent added.
    expect(ep.draw.filter((c) => c.tags.includes("dissent")).length).toBe(4);
    expect(ep.discard.length).toBe(4);
  });

  test("event is appended to eventLog", () => {
    const ep = freshEpoch();
    dispatch(ep, { type: "dissent-added", variant: "quiet" });
    expect(ep.eventLog.length).toBe(1);
    expect(ep.eventLog[0]!.type).toBe("dissent-added");
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
bun test tests/dispatch.test.ts
# Expected: module not found.
```

- [ ] **Step 3: Implement `src/core/dispatch.ts`**

```ts
// Single state-mutation entry point. Every state change in core flows
// through dispatch(epoch, event). Side-effect rules (e.g. "discard adds
// Dissent") live in one place: this file.

import type { Card, Epoch, GameEvent } from "./types.ts";
import { makeDissent } from "./cards.ts";
import { clearColumn } from "./column.ts";

export function dispatch(epoch: Epoch, ev: GameEvent): void {
  switch (ev.type) {
    case "card-played-to-land": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.lands.cards.push(ev.card);
      break;
    }
    case "card-played-to-influence": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.influence.card = ev.card;
      break;
    }
    case "card-played-to-charter": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.charter.card = ev.card;
      break;
    }
    case "card-discarded": {
      epoch.discard.push(ev.card);
      epoch.eventLog.push(ev);
      // Centralized rule: every discard adds one Quiet Dissent. Recurse
      // through dispatch so any future hooks on `dissent-added` apply.
      dispatch(epoch, { type: "dissent-added", variant: "quiet" });
      return; // eventLog already appended above
    }
    case "card-recalled-to-hand": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.influence.card = null;
      epoch.hand.push(ev.card);
      break;
    }
    case "column-built": {
      epoch.unlockedProjects.push(ev.unlock);
      const col = epoch.columns[ev.columnIndex];
      if (col) {
        const cards = [...ev.unlock.cards];
        clearColumn(col);
        // Append the column-built event before the cascading discards so the
        // log records the build atomically before its consequences.
        epoch.eventLog.push(ev);
        for (const c of cards) {
          dispatch(epoch, { type: "card-discarded", card: c, source: "column" });
        }
      }
      return;
    }
    case "dissent-added": {
      const card = makeDissent(ev.variant);
      epoch.draw.unshift(card);
      break;
    }
    case "turn-ended":
    case "crisis-resolved":
      break;
  }
  epoch.eventLog.push(ev);
}
```

- [ ] **Step 4: Tests pass**

```bash
bun test tests/dispatch.test.ts
# Expected: all green.
```

- [ ] **Step 5: Commit**

```bash
git add src/core/dispatch.ts tests/dispatch.test.ts
git commit -m "feat(core): add central dispatch for game events"
```

---

### Task 7: Create `src/core/projects.ts` registry (TDD)

**Files:**
- Create: `src/core/projects.ts`
- Test: `tests/projects.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/projects.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import {
  DEFAULT_PROJECT_VALUE,
  PATTERNS_IN_ORDER,
  getProjectForPattern,
  reversePatternOrder,
  unlockedIdeologyBreakdown,
} from "../src/core/projects.ts";
import type { KeystoneProject, ProjectUnlock } from "../src/core/types.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";

const sample: KeystoneProject[] = [
  { id: "p-high",  pattern: "high-card",       name: "h", flavor: "", value: 1 },
  { id: "p-pair",  pattern: "pair",            name: "p", flavor: "", value: 2 },
  { id: "p-three", pattern: "three-of-a-kind", name: "t", flavor: "", value: 4 },
  { id: "p-flush", pattern: "flush",           name: "f", flavor: "", value: 5 },
  { id: "p-four",  pattern: "four-of-a-kind",  name: "4", flavor: "", value: 8 },
];

describe("projects helpers", () => {
  test("DEFAULT_PROJECT_VALUE returns the spec-default scale", () => {
    expect(DEFAULT_PROJECT_VALUE["high-card"]).toBe(1);
    expect(DEFAULT_PROJECT_VALUE["pair"]).toBe(2);
    expect(DEFAULT_PROJECT_VALUE["three-of-a-kind"]).toBe(4);
    expect(DEFAULT_PROJECT_VALUE["flush"]).toBe(5);
    expect(DEFAULT_PROJECT_VALUE["four-of-a-kind"]).toBe(8);
  });

  test("PATTERNS_IN_ORDER is low → high", () => {
    expect(PATTERNS_IN_ORDER).toEqual([
      "high-card",
      "pair",
      "three-of-a-kind",
      "flush",
      "four-of-a-kind",
    ]);
  });

  test("reversePatternOrder is four → high", () => {
    expect(reversePatternOrder()).toEqual([
      "four-of-a-kind",
      "flush",
      "three-of-a-kind",
      "pair",
      "high-card",
    ]);
  });

  test("getProjectForPattern returns matching project", () => {
    expect(getProjectForPattern(sample, "flush")?.id).toBe("p-flush");
  });

  test("getProjectForPattern returns null when missing", () => {
    expect(getProjectForPattern([], "pair")).toBeNull();
  });

  test("unlockedIdeologyBreakdown sums non-wild ideology counts", () => {
    const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
      getCard(landId(rank, ideo));
    const role = (r: "agitator" | "scholar" | "preacher" | "engineer" | "architect", i: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
      getCard(roleId(r, i));
    const unlocks: ProjectUnlock[] = [
      {
        projectId: "x",
        pattern: "pair",
        turn: 1,
        cards: [
          land(7, "solidarity"),
          land(7, "heritage"),
          role("scholar", "solidarity"),
          getCard("keystone-founding-charter"), // solidarity
        ],
      },
      {
        projectId: "y",
        pattern: "high-card",
        turn: 2,
        cards: [land(3, "sovereignty"), role("scholar", "sovereignty"), getCard("keystone-pioneer")], // wild keystone
      },
    ];
    const b = unlockedIdeologyBreakdown(unlocks);
    expect(b.solidarity).toBe(3); // land7s + role + charter
    expect(b.heritage).toBe(1);
    expect(b.sovereignty).toBe(2); // land3 + role
    expect(b.transformation).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
bun test tests/projects.test.ts
# Expected: module not found.
```

- [ ] **Step 3: Implement `src/core/projects.ts`**

```ts
// Helpers for KeystoneProject lookup, ordering, and ideology aggregation.

import type {
  Ideology,
  KeystoneProject,
  PatternKind,
  ProjectUnlock,
} from "./types.ts";

export const PATTERNS_IN_ORDER: PatternKind[] = [
  "high-card",
  "pair",
  "three-of-a-kind",
  "flush",
  "four-of-a-kind",
];

export const DEFAULT_PROJECT_VALUE: Record<PatternKind, number> = {
  "high-card": 1,
  pair: 2,
  "three-of-a-kind": 4,
  flush: 5,
  "four-of-a-kind": 8,
};

export function reversePatternOrder(): PatternKind[] {
  return [...PATTERNS_IN_ORDER].reverse();
}

export function getProjectForPattern(
  projects: KeystoneProject[],
  pattern: PatternKind,
): KeystoneProject | null {
  return projects.find((p) => p.pattern === pattern) ?? null;
}

export function unlockedIdeologyBreakdown(
  unlocks: ProjectUnlock[],
): Record<Ideology, number> {
  const out: Record<Ideology, number> = {
    solidarity: 0,
    sovereignty: 0,
    transformation: 0,
    heritage: 0,
  };
  for (const u of unlocks) {
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      out[c.ideology] += 1;
    }
  }
  return out;
}
```

- [ ] **Step 4: Tests pass**

```bash
bun test tests/projects.test.ts
# Expected: all green.
```

- [ ] **Step 5: Commit**

```bash
git add src/core/projects.ts tests/projects.test.ts
git commit -m "feat(core): add KeystoneProject helpers and ideology aggregator"
```

---

## Phase B — Setting & Epoch shape (build temporarily breaks; restored at Task 22)

### Task 8: Update `Setting`, `SettingRules`, and `Epoch` interfaces

**Files:**
- Modify: `src/core/types.ts`

This task changes the shapes that the rest of the codebase consumes. Tasks 9–21 then update each consumer to match. Expect `bun run typecheck` and `bun test` to fail between Tasks 8 and 22.

- [ ] **Step 1: Replace `SettingRules`**

In `src/core/types.ts`, replace the existing `SettingRules` interface with:

```ts
export interface SettingRules {
  handSize: number;
  columnCount: number;          // replaces tableauSlots
  influenceBaseline: number;
  materialsPerLandBase: number;
  deckStartMinSize: number;
  maxTurns: number;             // turn budget; Crisis fires when exceeded
  dissentLossThreshold: number;
}
```

(Removed: `tableauSlots`, `softTurnLimit`, `retrieveInfluenceCost`, `retrieveLandMaterialCost`, `discardMaterialGain`. All retrieve/discard costs are gone per spec; Mat-from-discard is gone too.)

- [ ] **Step 2: Replace `Setting`**

```ts
export interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  rules: SettingRules;
  startingDeck: string[];
  startingColumns: ColumnConfig[];   // replaces startingTableau
  projects: KeystoneProject[];       // exactly 5, one per pattern
  crisis: Crisis;
  shortTermTasks: TaskDef[];
  transitions: {
    onWin: string | "campaign-end";  // single next-setting; no per-project routing
    onLoss: string | "campaign-end";
  };
}
```

(Removed: `megaProjects`, `tableauSlotsConfig`. `transitions.onWin` becomes a single string since the project-keyed routing no longer fits the new model — see spec note about Setting roster.)

- [ ] **Step 3: Replace `Epoch`**

Replace the existing `Epoch` interface and related types:

```ts
export interface Epoch {
  epochNumber: number;
  settingId: string;
  turn: number;
  phase: EpochPhase;
  hand: Card[];
  draw: Card[];
  discard: Card[];
  columns: Column[];              // replaces tableau
  unlockedProjects: ProjectUnlock[];
  eventLog: GameEvent[];          // typed event log (was EventEntry[])
  influence: number;
  materials: number;
  taskProgress: Record<string, TaskProgressState>;
  tasksRevealed: string[];
  endOfTurnQueue: EffectSpec[];
  status: EpochStatus;
  crisis: {
    status: "pending" | "resolved";
    outcome?: CrisisOutcome;
  };
}

export type EpochPhase = "play" | "crisis" | "end-of-epoch";

export type EpochStatus =
  | { kind: "in-progress" }
  | { kind: "won"; outcome: CrisisOutcome }
  | { kind: "lost"; outcome: CrisisOutcome };
```

Also remove now-dead types: `MegaProject`, `HandRequirement`, `TableauSlot`, `TableauSlotConfig`, `CompletionTier`, `LossMode`, `EventEntry`, `EpochPhaseV2` (fold into `EpochPhase`). Adjust `EpochResult` accordingly:

```ts
export interface EpochResult {
  epochNumber: number;
  settingId: string;
  outcome: "win" | "loss";
  totalValue: number;
  unlockCount: number;
  mintedLegacyIds: string[];
  finalIdeology: IdeologyVector;
}
```

Also remove `Monument.tier` (no completion tiers anymore). Update `Monument`:

```ts
export interface Monument {
  id: string;
  projectId: string;     // matches the strongest unlock that triggered it
  projectName: string;
  mintedOnEpoch: number;
  terrainDelta: Partial<IdeologyTerrain>;
  active: boolean;
}
```

And `LegacyCard.mintedFrom` becomes `"unlock" | "consolation"` (no "mega-project" / "played").

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(types): reshape Setting/Epoch/EpochResult/Monument for column redesign

Build is intentionally broken here. Tasks 9-21 update consumers to match.
Re-greens at Task 22."
```

---

### Task 9: Rewrite `src/core/homeworld.ts` Setting

**Files:**
- Modify: `src/core/homeworld.ts`

- [ ] **Step 1: Overwrite the file with the new shape**

```ts
// Homeworld Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, ColumnConfig } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";
import { DEFAULT_PROJECT_VALUE } from "./projects.ts";

const ALL_CARD_IDS = ALL_CARDS.map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  { id: "homeworld-public-broadcast", pattern: "high-card",
    name: "Public Broadcast", flavor: "A first sermon at dawn.",
    value: DEFAULT_PROJECT_VALUE["high-card"] },
  { id: "homeworld-commons", pattern: "pair",
    name: "The Commons", flavor: "Two stones, one hearth.",
    value: DEFAULT_PROJECT_VALUE["pair"] },
  { id: "homeworld-public-library", pattern: "three-of-a-kind",
    name: "Public Library", flavor: "Three columns stand for memory.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"] },
  { id: "homeworld-founding-stone", pattern: "flush",
    name: "Founding Stone", flavor: "All of one belief, set in mortar.",
    value: DEFAULT_PROJECT_VALUE["flush"] },
  { id: "homeworld-reactor-core", pattern: "four-of-a-kind",
    name: "Reactor Core", flavor: "Power harnessed, fourfold.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"] },
];

const CRISIS: Crisis = {
  id: "homeworld-arrival-storm",
  name: "Arrival Storm",
  flavor: "The first generation faces a dust-storm that will not pass.",
  difficulty: 10,
};

const STARTING_COLUMNS: ColumnConfig[] = [];

export const HOMEWORLD: Setting = {
  id: "homeworld",
  name: "Homeworld",
  description: "The first world. Fresh ground, unsettled ideology.",
  flavorText:
    "Mars under a dome. The first generation debates what comes next: to dig in, to lift off, or to build something neither.",
  rules: {
    handSize: 7,
    columnCount: 7,
    influenceBaseline: 3,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 12,
    dissentLossThreshold: 0.5,
  },
  startingDeck: ALL_CARD_IDS,
  startingColumns: STARTING_COLUMNS,
  projects: PROJECTS,
  crisis: CRISIS,
  shortTermTasks: [],
  transitions: {
    onWin: "generation-ship",
    onLoss: "ruined-homeworld",
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/core/homeworld.ts
git commit -m "feat(setting): rewrite Homeworld for column redesign"
```

---

### Task 10: Rewrite Generation Ship and Ruined Homeworld Settings

**Files:**
- Modify: `src/core/generationShip.ts`
- Modify: `src/core/ruinedHomeworld.ts`

- [ ] **Step 1: Rewrite `src/core/generationShip.ts`**

```ts
// Generation Ship Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, ColumnConfig } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";
import { DEFAULT_PROJECT_VALUE } from "./projects.ts";

// Generation Ship gates out the founding charter — see spec.
const EXCLUDED_IDS = new Set<string>(["keystone-founding-charter"]);
const STARTING_DECK = ALL_CARDS.filter((c) => !EXCLUDED_IDS.has(c.id)).map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  { id: "ship-bulkhead-patch", pattern: "high-card",
    name: "Bulkhead Patch", flavor: "Tape and prayer.",
    value: DEFAULT_PROJECT_VALUE["high-card"] },
  { id: "ship-twin-screws", pattern: "pair",
    name: "Twin Screws", flavor: "Redundancy is doctrine.",
    value: DEFAULT_PROJECT_VALUE["pair"] },
  { id: "ship-trinity-array", pattern: "three-of-a-kind",
    name: "Trinity Array", flavor: "Three antennae, one ear.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"] },
  { id: "ship-unison-engine", pattern: "flush",
    name: "Unison Engine", flavor: "All ideologies pull the same direction.",
    value: DEFAULT_PROJECT_VALUE["flush"] },
  { id: "ship-fourfold-drive", pattern: "four-of-a-kind",
    name: "Fourfold Drive", flavor: "Four engines, one heartbeat.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"] },
];

const CRISIS: Crisis = {
  id: "ship-deep-cold",
  name: "Deep Cold",
  flavor: "The ship enters a silent corridor between stars.",
  difficulty: 14,
};

export const GENERATION_SHIP: Setting = {
  id: "generation-ship",
  name: "Generation Ship",
  description: "The voyage. Resources tight; ideology drifts.",
  flavorText: "Years stretched thin. The bulkheads remember everyone who passed.",
  rules: {
    handSize: 6,
    columnCount: 6,
    influenceBaseline: 3,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 14,
    dissentLossThreshold: 0.5,
  },
  startingDeck: STARTING_DECK,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  shortTermTasks: [],
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
```

- [ ] **Step 2: Rewrite `src/core/ruinedHomeworld.ts`**

```ts
// Ruined Homeworld Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";
import { DEFAULT_PROJECT_VALUE } from "./projects.ts";

const ALL_CARD_IDS = ALL_CARDS.map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  { id: "ruin-candle", pattern: "high-card",
    name: "Candle in the Dust", flavor: "Something burns again.",
    value: DEFAULT_PROJECT_VALUE["high-card"] },
  { id: "ruin-two-stones", pattern: "pair",
    name: "Two Stones Reset", flavor: "The first wall returns.",
    value: DEFAULT_PROJECT_VALUE["pair"] },
  { id: "ruin-third-pillar", pattern: "three-of-a-kind",
    name: "Third Pillar", flavor: "Memory is laid in threes.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"] },
  { id: "ruin-monoculture", pattern: "flush",
    name: "Monoculture", flavor: "One belief survives, for now.",
    value: DEFAULT_PROJECT_VALUE["flush"] },
  { id: "ruin-cornerstones", pattern: "four-of-a-kind",
    name: "The Cornerstones", flavor: "Four corners hold what is left.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"] },
];

const CRISIS: Crisis = {
  id: "ruin-collapse",
  name: "The Long Collapse",
  flavor: "What was once a city must be coaxed back into shape.",
  difficulty: 8,
};

export const RUINED_HOMEWORLD: Setting = {
  id: "ruined-homeworld",
  name: "Ruined Homeworld",
  description: "Return to a scarred world. Salvage and re-found.",
  flavorText: "The dome cracked. The fields turned. Begin again.",
  rules: {
    handSize: 7,
    columnCount: 5,
    influenceBaseline: 2,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 16,
    dissentLossThreshold: 0.5,
  },
  startingDeck: ALL_CARD_IDS,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  shortTermTasks: [],
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/core/generationShip.ts src/core/ruinedHomeworld.ts
git commit -m "feat(setting): rewrite Generation Ship and Ruined Homeworld for column redesign"
```

---

### Task 11: Update `src/core/ideology.ts` to read columns

**Files:**
- Modify: `src/core/ideology.ts`

- [ ] **Step 1: Replace `deriveVector` to walk Columns**

Replace the file's first import block and the `deriveVector` function:

```ts
import type { Card, Column, Demonym, Ideology, IdeologyTerrain, IdeologyVector } from "./types.ts";
import { columnCards } from "./column.ts";

export function deriveVector(columns: Column[], terrain: IdeologyTerrain): IdeologyVector {
  let axis1 = terrain.axis1;
  let axis2 = terrain.axis2;

  for (const col of columns) {
    for (const card of columnCards(col)) {
      if (card.ideology === "wild") continue;
      const r = card.rank;
      switch (card.ideology) {
        case "solidarity":     axis1 -= r; break;
        case "sovereignty":    axis1 += r; break;
        case "transformation": axis2 += r; break;
        case "heritage":       axis2 -= r; break;
      }
    }
  }

  return { axis1, axis2 };
}
```

(Keep `checkAlignment`, `influenceCostAdjustment`, `demonym`, `demonymName`, `axisVerdict` unchanged — they don't depend on tableau shape.)

- [ ] **Step 2: Commit**

```bash
git add src/core/ideology.ts
git commit -m "feat(core): ideology.deriveVector reads columns instead of tableau"
```

---

## Phase C — Epoch commands (still red until Task 22)

### Task 12: Rewrite `createEpoch` to initialize columns

**Files:**
- Modify: `src/core/epoch.ts`

We're going to replace `src/core/epoch.ts` wholesale across Tasks 12–18. Each task introduces one section. After Task 18 the file is complete; in between, the imports and exports of this file may not compile.

- [ ] **Step 1: Replace the top of `src/core/epoch.ts`**

Open `src/core/epoch.ts` and replace the imports + the `createEpoch` function block (lines 1–108 of the current file) with:

```ts
// Epoch lifecycle + column-based commands.

import type {
  Campaign,
  Card,
  Column,
  CrisisOutcome,
  Epoch,
  GameEvent,
  IdeologyVector,
  KeystoneProject,
  ProjectUnlock,
  Setting,
} from "./types.ts";
import { CARD_BY_ID, landMaterialProduction, makeDissent } from "./cards.ts";
import {
  applyEffect,
  countDissentInDeck,
  drawToHandSize,
  getTransientShift,
  purgeDissent,
  resolveEndOfTurn,
} from "./effects.ts";
import type { EffectContext } from "./effects.ts";
import { checkAlignment, deriveVector, influenceCostAdjustment } from "./ideology.ts";
import {
  canPlaceCharter,
  canPlaceInfluence,
  canPlaceLand,
  columnCards,
  columnFromConfig,
  createEmptyColumn,
} from "./column.ts";
import { evaluateColumn } from "./columnPatterns.ts";
import { reversePatternOrder } from "./projects.ts";
import { dispatch } from "./dispatch.ts";
import type { RNG } from "./rng.ts";

export function createEpoch(
  setting: Setting,
  campaign: Campaign,
  rng: RNG,
  epochNumber: number,
): Epoch {
  const starterIds = [...setting.startingDeck];
  const starterCards: Card[] = starterIds.map((id) => CARD_BY_ID[id]!).filter(Boolean);
  const legacyCards: Card[] = campaign.legacyCards.map((l) => l.baseCard);
  const deck = rng.shuffle([...starterCards, ...legacyCards]);

  const columns: Column[] = [];
  for (let i = 0; i < setting.rules.columnCount; i++) {
    const cfg = setting.startingColumns[i];
    columns.push(cfg ? columnFromConfig(cfg, (id) => CARD_BY_ID[id]) : createEmptyColumn());
  }

  const epoch: Epoch = {
    epochNumber,
    settingId: setting.id,
    turn: 1,
    phase: "play",
    hand: [],
    draw: deck,
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: setting.rules.influenceBaseline,
    materials: 0,
    taskProgress: {},
    tasksRevealed: [],
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };

  applyScarredTerrainDissent(epoch, campaign.terrain);
  drawToHandSize(epoch, setting.rules.handSize, rng);
  return epoch;
}

function applyScarredTerrainDissent(epoch: Epoch, terrain: { axis1: number; axis2: number }): void {
  const addIf = (mag: number, _ideology: "solidarity" | "sovereignty" | "transformation" | "heritage") => {
    if (mag < 2) return;
    const n = Math.min(3, Math.floor(mag / 2));
    for (let i = 0; i < n; i++) {
      epoch.draw.push(makeDissent("backlash"));
    }
  };
  if (terrain.axis1 > 0) addIf(terrain.axis1, "sovereignty");
  if (terrain.axis1 < 0) addIf(Math.abs(terrain.axis1), "solidarity");
  if (terrain.axis2 > 0) addIf(terrain.axis2, "transformation");
  if (terrain.axis2 < 0) addIf(Math.abs(terrain.axis2), "heritage");
}

export function currentVector(epoch: Epoch, campaign: Campaign): IdeologyVector {
  const shift = getTransientShift(epoch);
  const baseTerrain = {
    axis1: campaign.terrain.axis1 + shift.axis1,
    axis2: campaign.terrain.axis2 + shift.axis2,
  };
  const backlashBonus = { axis1: 0, axis2: 0 };
  for (const card of epoch.hand) {
    if (card.tags.includes("dissent") && card.ideology !== "wild") {
      switch (card.ideology) {
        case "solidarity":     backlashBonus.axis1 -= 1; break;
        case "sovereignty":    backlashBonus.axis1 += 1; break;
        case "transformation": backlashBonus.axis2 += 1; break;
        case "heritage":       backlashBonus.axis2 -= 1; break;
      }
    }
  }
  return deriveVector(epoch.columns, {
    axis1: baseTerrain.axis1 + backlashBonus.axis1,
    axis2: baseTerrain.axis2 + backlashBonus.axis2,
  });
}

export function effectiveInfluenceCost(card: Card, vector: IdeologyVector): number {
  const alignment = checkAlignment(card, vector);
  const adj = influenceCostAdjustment(alignment);
  return Math.max(0, card.influenceCost + adj);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/epoch.ts
git commit -m "feat(core): rewrite createEpoch/currentVector for columns

epoch.ts is intentionally incomplete after this commit (legacy command
exports still missing). Tasks 13-18 add them back."
```

---

### Task 13: Add `placeCard` command (column-aware)

**Files:**
- Modify: `src/core/epoch.ts`

- [ ] **Step 1: Append `placeCard`**

Add to the bottom of `src/core/epoch.ts` (after the helpers from Task 12):

```ts
export type Alignment = "aligned" | "opposed" | "neutral";

export type PlaceResult =
  | { ok: true; card: Card; alignment: Alignment }
  | { ok: false; error: string };

export function placeCard(
  epoch: Epoch,
  campaign: Campaign,
  setting: Setting,
  cardId: string,
  columnIndex: number,
  rng: RNG,
): PlaceResult {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };

  const handIdx = epoch.hand.findIndex((c) => c.id === cardId);
  if (handIdx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[handIdx]!;
  if (card.tags.includes("dissent")) return { ok: false, error: "Dissent cannot be played." };

  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const vector = currentVector(epoch, campaign);
  const alignment = checkAlignment(card, vector);

  if (card.kind === "land") {
    if (!canPlaceLand(col, card)) {
      return { ok: false, error: "Land cannot be placed there (rank mismatch or stack full)." };
    }
    epoch.hand.splice(handIdx, 1);
    dispatch(epoch, { type: "card-played-to-land", card, columnIndex });
    return { ok: true, card, alignment: "neutral" };
  }

  if (card.kind === "role") {
    if (!canPlaceInfluence(col, card)) {
      return { ok: false, error: "Influence row needs at least one Land below." };
    }
    return playToporRow(epoch, setting, vector, alignment, card, columnIndex, handIdx, "card-played-to-influence", rng);
  }

  if (card.kind === "charter") {
    if (!canPlaceCharter(col, card)) {
      return { ok: false, error: "Charter row needs the Influence row filled." };
    }
    return playToporRow(epoch, setting, vector, alignment, card, columnIndex, handIdx, "card-played-to-charter", rng);
  }

  return { ok: false, error: "Card kind cannot be played." };
}

function playToporRow(
  epoch: Epoch,
  _setting: Setting,
  vector: IdeologyVector,
  alignment: Alignment,
  card: Card,
  columnIndex: number,
  handIdx: number,
  eventType: GameEvent["type"] & ("card-played-to-influence" | "card-played-to-charter"),
  rng: RNG,
): PlaceResult {
  const cost = effectiveInfluenceCost(card, vector);
  if (epoch.influence < cost) {
    return { ok: false, error: `Need ${cost} Influence (have ${epoch.influence}).` };
  }
  epoch.influence -= cost;
  epoch.hand.splice(handIdx, 1);
  dispatch(epoch, { type: eventType, card, columnIndex } as GameEvent);

  const ctx: EffectContext = {
    epoch,
    rng,
    log: (e) => epoch.eventLog.push({ type: "turn-ended", turn: epoch.turn, ...(e as any) } as any),
  };
  applyEffect(card.effect, ctx);

  if (alignment === "opposed" && card.ideology !== "wild") {
    epoch.endOfTurnQueue.push({
      kind: "addDissent",
      variant: "backlash",
      ideology: opposingIdeology(card.ideology),
      amount: 1,
      timing: "end-of-turn",
    });
  }

  return { ok: true, card, alignment };
}

function opposingIdeology(ideology: "solidarity" | "sovereignty" | "transformation" | "heritage") {
  switch (ideology) {
    case "solidarity":     return "sovereignty" as const;
    case "sovereignty":    return "solidarity" as const;
    case "transformation": return "heritage" as const;
    case "heritage":       return "transformation" as const;
  }
}
```

Note: the legacy `EventEntry`-based `eventLog.push` calls were removed; effects that previously logged through `EffectContext.log` now no-op or are folded into dispatch events. If `EffectContext.log` is widely used downstream, replace its body with a no-op (`log: () => {}`) until the renderer no longer reads structured prose entries from the log.

- [ ] **Step 2: Commit**

```bash
git add src/core/epoch.ts
git commit -m "feat(core): placeCard command dispatches column events"
```

---

### Task 14: Discard / recall commands

**Files:**
- Modify: `src/core/epoch.ts`

- [ ] **Step 1: Append discard/recall**

Append to `src/core/epoch.ts`:

```ts
export type CmdResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function discardLand(epoch: Epoch, columnIndex: number): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.lands.cards.pop();
  if (!card) return { ok: false, error: "No Land to discard." };
  dispatch(epoch, { type: "card-discarded", card, source: "tableau-land" });
  return { ok: true, value: card };
}

export function discardCharter(epoch: Epoch, columnIndex: number): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.charter.card;
  if (!card) return { ok: false, error: "No Charter to discard." };
  col.charter.card = null;
  dispatch(epoch, { type: "card-discarded", card, source: "tableau-charter" });
  return { ok: true, value: card };
}

export function recallInfluence(epoch: Epoch, columnIndex: number): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const card = col.influence.card;
  if (!card) return { ok: false, error: "No Influence to recall." };
  if (col.charter.card !== null) {
    return { ok: false, error: "Discard the Charter first." };
  }
  dispatch(epoch, { type: "card-recalled-to-hand", card, columnIndex });
  return { ok: true, value: card };
}

export function discardColumn(epoch: Epoch, columnIndex: number): CmdResult<void> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const cards = columnCards(col);
  if (cards.length === 0) return { ok: false, error: "Column is empty." };
  // Clear first so the cascade does not double-touch.
  col.lands.cards.length = 0;
  col.influence.card = null;
  col.charter.card = null;
  for (const c of cards) {
    dispatch(epoch, { type: "card-discarded", card: c, source: "column" });
  }
  return { ok: true, value: undefined };
}

export function discardFromHand(epoch: Epoch, cardId: string): CmdResult<Card> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const idx = epoch.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { ok: false, error: "Card not in hand." };
  const card = epoch.hand[idx]!;
  epoch.hand.splice(idx, 1);
  dispatch(epoch, { type: "card-discarded", card, source: "hand" });
  return { ok: true, value: card };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/epoch.ts
git commit -m "feat(core): discard land/charter, recall influence, discard column/hand"
```

---

### Task 15: `buildColumn` command

**Files:**
- Modify: `src/core/epoch.ts`

- [ ] **Step 1: Append `buildColumn`**

Append to `src/core/epoch.ts`:

```ts
export function buildColumn(
  epoch: Epoch,
  setting: Setting,
  columnIndex: number,
): CmdResult<ProjectUnlock> {
  if (epoch.status.kind !== "in-progress") return { ok: false, error: "Epoch ended." };
  if (epoch.phase !== "play") return { ok: false, error: "Not in play phase." };
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const match = evaluateColumn(col, setting.projects);
  if (!match) return { ok: false, error: "Column is not buildable." };

  const unlock: ProjectUnlock = {
    projectId: match.projectId,
    pattern: match.kind,
    turn: epoch.turn,
    cards: [...match.cards],
  };
  dispatch(epoch, { type: "column-built", columnIndex, unlock });
  return { ok: true, value: unlock };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/epoch.ts
git commit -m "feat(core): buildColumn command emits column-built event"
```

---

### Task 16: `endTurn` with Crisis transition

**Files:**
- Modify: `src/core/epoch.ts`

- [ ] **Step 1: Append `endTurn`**

Append to `src/core/epoch.ts`:

```ts
export function endTurn(epoch: Epoch, _campaign: Campaign, setting: Setting, rng: RNG): void {
  if (epoch.status.kind !== "in-progress") return;
  if (epoch.phase !== "play") return;

  // Production: each Land produces materials per its rank.
  let produced = 0;
  for (const col of epoch.columns) {
    for (const l of col.lands.cards) produced += landMaterialProduction(l.rank);
  }
  epoch.materials += produced;

  // Resolve end-of-turn effects (Backlash / queued addDissent etc.).
  const ctx: EffectContext = {
    epoch,
    rng,
    log: () => {},
  };
  resolveEndOfTurn(ctx);

  // Loss-by-dissent check carries over.
  const { dissent, total } = countDissentInDeck(epoch);
  if (total > 0 && dissent / total > setting.rules.dissentLossThreshold) {
    // Force Crisis with zero contribution → guaranteed loss path.
    epoch.crisis.status = "pending";
    epoch.phase = "crisis";
    dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
    return;
  }

  // Transient ideology shift resets each turn.
  (epoch as Epoch & { __shift?: { axis1: number; axis2: number } }).__shift = { axis1: 0, axis2: 0 };

  dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
  epoch.turn += 1;

  if (epoch.turn > setting.rules.maxTurns) {
    epoch.phase = "crisis";
    return;
  }

  drawToHandSize(epoch, setting.rules.handSize, rng);
  epoch.influence = setting.rules.influenceBaseline;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/epoch.ts
git commit -m "feat(core): endTurn handles production, dissent loss, Crisis trigger"
```

---

### Task 17: `resolveCrisis` command

**Files:**
- Modify: `src/core/epoch.ts`

- [ ] **Step 1: Append `resolveCrisis`**

Append to `src/core/epoch.ts`:

```ts
export function resolveCrisis(epoch: Epoch, setting: Setting): CrisisOutcome {
  if (epoch.crisis.status === "resolved" && epoch.crisis.outcome) {
    return epoch.crisis.outcome;
  }
  const order = reversePatternOrder();
  const byPattern = new Map<string, ProjectUnlock[]>();
  for (const u of epoch.unlockedProjects) {
    const arr = byPattern.get(u.pattern) ?? [];
    arr.push(u);
    byPattern.set(u.pattern, arr);
  }
  const contributing: ProjectUnlock[] = [];
  let total = 0;
  for (const pattern of order) {
    const unlocks = (byPattern.get(pattern) ?? []).slice().sort((a, b) => a.turn - b.turn);
    for (const u of unlocks) {
      const project = setting.projects.find((p) => p.id === u.projectId);
      if (!project) continue;
      total += project.value;
      contributing.push(u);
    }
  }
  const cleared = total >= setting.crisis.difficulty;
  const outcome: CrisisOutcome = {
    totalValue: total,
    cleared,
    contributingUnlocks: contributing,
  };
  epoch.crisis = { status: "resolved", outcome };
  epoch.status = cleared ? { kind: "won", outcome } : { kind: "lost", outcome };
  epoch.phase = "end-of-epoch";
  dispatch(epoch, { type: "crisis-resolved", outcome });
  return outcome;
}

export { purgeDissent };
```

- [ ] **Step 2: Commit**

```bash
git add src/core/epoch.ts
git commit -m "feat(core): resolveCrisis sums unlocks, sets win/loss status"
```

---

### Task 18: Delete dead helpers from `effects.ts`

**Files:**
- Modify: `src/core/effects.ts`

`effects.ts` still references `EventEntry` and contains a `log` field on `EffectContext`. Make the log a no-op-typed function so the file compiles against the new `Epoch` shape. Other helpers (`drawToHandSize`, `purgeDissent`, `countDissentInDeck`, `getTransientShift`, `resolveEndOfTurn`, `applyEffect`) are kept.

- [ ] **Step 1: Update `EffectContext`**

In `src/core/effects.ts`, replace:

```ts
export interface EffectContext {
  epoch: Epoch;
  rng: RNG;
  log: (entry: EventEntry) => void;
}
```

with:

```ts
export interface EffectContext {
  epoch: Epoch;
  rng: RNG;
  log: (text: string) => void;
}
```

Find every `ctx.log({ turn: ..., text: ... })` call and replace with `ctx.log("...")`. (One call site at line 40: `ctx.log({ turn: ctx.epoch.turn, text: ... })` → `ctx.log("Peek: top " + effect.count + " of market.")`.) Remove the `import type { ... EventEntry ... }` if it's now unused.

- [ ] **Step 2: Remove dissent log emission from resolveEndOfTurn**

In `resolveEndOfTurn`, the existing block:

```ts
ctx.log({
  turn: ctx.epoch.turn,
  text: `+${effect.amount} ${effect.variant}...`,
  kind: "warn",
});
```

becomes:

```ts
ctx.log(`+${effect.amount} ${effect.variant} added to deck.`);
```

The dissent cards themselves are now added via `dispatch(epoch, { type: "dissent-added", variant })` for consistency with the rest of the codebase. Replace the inner `for` loop:

```ts
for (let i = 0; i < effect.amount; i++) {
  const card = makeDissent(effect.variant, effect.variant === "backlash" ? effect.ideology : undefined);
  ctx.epoch.discard.push(card);
}
```

with:

```ts
for (let i = 0; i < effect.amount; i++) {
  dispatch(ctx.epoch, { type: "dissent-added", variant: effect.variant });
}
```

Add `import { dispatch } from "./dispatch.ts";` at the top.

- [ ] **Step 3: Commit**

```bash
git add src/core/effects.ts
git commit -m "refactor(effects): EffectContext.log takes string; route dissent through dispatch"
```

---

## Phase D — Legacy, Campaign, Facade, Persistence

### Task 19: Rewrite `legacy.ts` for `CrisisOutcome`

**Files:**
- Modify: `src/core/legacy.ts`

- [ ] **Step 1: Overwrite `src/core/legacy.ts`**

```ts
// Legacy minting + upgrade-path application — adapted for CrisisOutcome.

import type {
  Campaign,
  Card,
  CrisisOutcome,
  Epoch,
  IdeologyTerrain,
  LegacyCandidate,
  LegacyCard,
  Monument,
  ProjectUnlock,
  Setting,
} from "./types.ts";
import { reversePatternOrder } from "./projects.ts";

export interface MintingResult {
  candidates: LegacyCandidate[];
  monument?: Monument;
}

export function mintCandidatesOnWin(
  epoch: Epoch,
  setting: Setting,
  _campaign: Campaign,
  outcome: CrisisOutcome,
): MintingResult {
  const candidates: LegacyCandidate[] = [];

  // One candidate per pattern that contributed, drawn from its highest-rank unlock.
  const order = reversePatternOrder();
  for (const pattern of order) {
    const u = outcome.contributingUnlocks.find((x) => x.pattern === pattern);
    if (!u) continue;
    const project = setting.projects.find((p) => p.id === u.projectId);
    if (!project) continue;
    candidates.push({
      id: `legacy-${project.id}-${epoch.epochNumber}`,
      baseCard: templateProjectLegacy(project.name, project.id),
      source: "unlock",
      suggestedUpgrades: ["potency", "pliability", "persistence"],
    });
  }

  const monument = buildMonument(epoch, outcome, setting);
  return { candidates, monument };
}

export function mintCandidatesOnLoss(epoch: Epoch, _setting: Setting, _outcome: CrisisOutcome): MintingResult {
  const candidates: LegacyCandidate[] = [];
  const consolation = buildConsolationLegacy();
  candidates.push({
    id: `legacy-consolation-${epoch.epochNumber}`,
    baseCard: consolation,
    source: "consolation",
    suggestedUpgrades: ["potency", "pliability", "persistence"],
  });
  return { candidates };
}

function buildMonument(epoch: Epoch, outcome: CrisisOutcome, setting: Setting): Monument | undefined {
  if (outcome.contributingUnlocks.length === 0) return undefined;
  const strongest = outcome.contributingUnlocks[0]!; // first is highest-pattern, earliest turn
  const project = setting.projects.find((p) => p.id === strongest.projectId);
  if (!project) return undefined;
  // Terrain effect: positive sovereignty/transformation for high patterns, otherwise no shift.
  const mag = Math.max(1, Math.floor(outcome.totalValue / 5));
  const delta: Partial<IdeologyTerrain> = {};
  // Use net ideology of contributing unlocks: solidarity vs sovereignty drives axis1.
  let axis1 = 0, axis2 = 0;
  for (const u of outcome.contributingUnlocks) {
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      if (c.ideology === "solidarity") axis1 -= 1;
      if (c.ideology === "sovereignty") axis1 += 1;
      if (c.ideology === "transformation") axis2 += 1;
      if (c.ideology === "heritage") axis2 -= 1;
    }
  }
  if (axis1 !== 0) delta.axis1 = Math.sign(axis1) * mag;
  if (axis2 !== 0) delta.axis2 = Math.sign(axis2) * mag;
  return {
    id: `monument-${project.id}-e${epoch.epochNumber}`,
    projectId: project.id,
    projectName: project.name,
    mintedOnEpoch: epoch.epochNumber,
    terrainDelta: delta,
    active: true,
  };
}

function templateProjectLegacy(name: string, projectId: string): Card {
  return {
    id: `legacy-card-${projectId}`,
    name: `Logbook of ${name}`,
    kind: "legacy",
    rank: 11,
    ideology: "heritage",
    influenceCost: 1,
    marketCost: 0,
    effect: { kind: "draw", count: 1, timing: "immediate" },
    tags: ["legacy"],
    flavor: `Minted from ${name}.`,
  };
}

function buildConsolationLegacy(): Card {
  return {
    id: "legacy-ration",
    name: "The Ration Ledger",
    kind: "legacy",
    rank: 10,
    ideology: "heritage",
    influenceCost: 0,
    marketCost: 0,
    effect: { kind: "gainMaterials", amount: 2, timing: "immediate" },
    tags: ["legacy"],
    flavor: "What survived is counted, twice.",
  };
}

export function applyUpgrade(
  candidate: LegacyCandidate,
  upgrade: "potency" | "pliability" | "persistence",
  epochNumber: number,
): LegacyCard {
  const base = candidate.baseCard;
  const upgraded: Card = { ...base };
  switch (upgrade) {
    case "potency":
      upgraded.effect = amplifyEffect(base.effect);
      upgraded.name = base.name + " ◆";
      break;
    case "pliability":
      upgraded.influenceCost = Math.max(0, base.influenceCost - 1);
      upgraded.name = base.name + " ◇";
      break;
    case "persistence":
      upgraded.slotPassive = { kind: "gainMaterials", amount: 1, timing: "immediate" };
      upgraded.name = base.name + " ◉";
      break;
  }
  return {
    id: candidate.id,
    baseCard: upgraded,
    upgradePath: upgrade,
    mintedOnEpoch: epochNumber,
    mintedFrom: candidate.source,
  };
}

function amplifyEffect(effect: Card["effect"]): Card["effect"] {
  const amp = (e: Card["effect"]): Card["effect"] => {
    switch (e.kind) {
      case "gainInfluence":
      case "gainMaterials":   return { ...e, amount: e.amount + 1 };
      case "draw":            return { ...e, count: e.count + 1 };
      case "removeDissent":   return { ...e, amount: e.amount + 1 };
      case "shiftIdeology":   return { ...e, amount: e.amount + 1 };
      case "compound":        return { ...e, effects: e.effects.map(amp) };
      default: return e;
    }
  };
  return amp(effect);
}

export const MONUMENT_CAP = 3;

export function addMonumentToCampaign(campaign: Campaign, monument: Monument): void {
  campaign.monuments.push(monument);
  const active = campaign.monuments.filter((m) => m.active);
  while (active.length > MONUMENT_CAP) {
    const oldest = active.shift();
    if (oldest) oldest.active = false;
  }
  if (monument.terrainDelta.axis1 !== undefined) campaign.terrain.axis1 += monument.terrainDelta.axis1;
  if (monument.terrainDelta.axis2 !== undefined) campaign.terrain.axis2 += monument.terrainDelta.axis2;
}

export function applyLossTerrainScar(
  campaign: Campaign,
  outcome: CrisisOutcome,
  finalVector: { axis1: number; axis2: number },
): void {
  // Mild scar on loss: erode terrain toward neutral, plus a small bump opposite the ideology
  // breakdown of unlocks. Tuning placeholder.
  campaign.terrain.axis1 = Math.round(campaign.terrain.axis1 * 0.8);
  campaign.terrain.axis2 = Math.round(campaign.terrain.axis2 * 0.8);
  if (finalVector.axis1 >= 3) campaign.terrain.axis1 -= 1;
  if (finalVector.axis1 <= -3) campaign.terrain.axis1 += 1;
  if (finalVector.axis2 >= 3) campaign.terrain.axis2 -= 1;
  if (finalVector.axis2 <= -3) campaign.terrain.axis2 += 1;
  void outcome; // currently unused; signature kept for future tuning
}
```

Also update `LegacyCard`/`LegacyCandidate` source values in `types.ts` if they still reference the old enum:

```ts
// In types.ts: LegacyCard.mintedFrom and LegacyCandidate.source
mintedFrom: "unlock" | "consolation";
source: "unlock" | "consolation";
```

- [ ] **Step 2: Commit**

```bash
git add src/core/legacy.ts src/core/types.ts
git commit -m "feat(legacy): mint from CrisisOutcome; drop tier and project-keystone keys"
```

---

### Task 20: Rewrite `campaign.ts` to consume `CrisisOutcome`

**Files:**
- Modify: `src/core/campaign.ts`

- [ ] **Step 1: Replace `prepareEndOfEpoch` and `finalizeEpoch`**

Open `src/core/campaign.ts`. Replace the two functions:

```ts
export interface EndOfEpochState {
  candidates: LegacyCandidate[];
  monument?: MintingResult["monument"];
  nextSettingId: string | "campaign-end";
  outcome: "win" | "loss";
  crisis: CrisisOutcome;
  ideologyBreakdown: Record<Ideology, number>; // aggregate from unlockedProjects
}

export function prepareEndOfEpoch(
  epoch: Epoch,
  setting: Setting,
  campaign: Campaign,
): EndOfEpochState {
  const status = epoch.status;
  if (status.kind !== "won" && status.kind !== "lost") {
    return {
      candidates: [],
      nextSettingId: "campaign-end",
      outcome: "loss",
      crisis: { totalValue: 0, cleared: false, contributingUnlocks: [] },
      ideologyBreakdown: { solidarity: 0, sovereignty: 0, transformation: 0, heritage: 0 },
    };
  }
  const result =
    status.kind === "won"
      ? mintCandidatesOnWin(epoch, setting, campaign, status.outcome)
      : mintCandidatesOnLoss(epoch, setting, status.outcome);
  return {
    candidates: result.candidates,
    monument: result.monument,
    nextSettingId: status.kind === "won" ? setting.transitions.onWin : setting.transitions.onLoss,
    outcome: status.kind === "won" ? "win" : "loss",
    crisis: status.outcome,
    ideologyBreakdown: unlockedIdeologyBreakdown(epoch.unlockedProjects),
  };
}

export function finalizeEpoch(
  epoch: Epoch,
  setting: Setting,
  campaign: Campaign,
  state: EndOfEpochState,
  upgradeChoices: Record<string, "potency" | "pliability" | "persistence">,
): { kind: "next"; epoch: Epoch; setting: Setting } | { kind: "campaign-end" } {
  const legacyCards: LegacyCard[] = state.candidates.map((cand) =>
    applyUpgrade(cand, upgradeChoices[cand.id] ?? cand.suggestedUpgrades[0] ?? "potency", epoch.epochNumber),
  );
  campaign.legacyCards.push(...legacyCards);
  if (state.monument) addMonumentToCampaign(campaign, state.monument);
  if (state.outcome === "loss") {
    applyLossTerrainScar(campaign, state.crisis, currentVector(epoch, campaign));
  }

  const result: EpochResult = {
    epochNumber: epoch.epochNumber,
    settingId: setting.id,
    outcome: state.outcome,
    totalValue: state.crisis.totalValue,
    unlockCount: epoch.unlockedProjects.length,
    mintedLegacyIds: legacyCards.map((l) => l.id),
    finalIdeology: currentVector(epoch, campaign),
  };
  campaign.epochHistory.push(result);
  campaign.epochCount = epoch.epochNumber;

  if (state.nextSettingId === "campaign-end") {
    campaign.currentSettingId = "campaign-end";
    return { kind: "campaign-end" };
  }
  const nextSetting = getSetting(state.nextSettingId);
  campaign.currentSettingId = nextSetting.id;
  const rng = nextEpochRng(campaign);
  const nextEpoch = createEpoch(nextSetting, campaign, rng, epoch.epochNumber + 1);
  return { kind: "next", epoch: nextEpoch, setting: nextSetting };
}
```

Add the imports at the top:

```ts
import type { CrisisOutcome, Ideology } from "./types.ts";
import { unlockedIdeologyBreakdown } from "./projects.ts";
```

- [ ] **Step 2: Commit**

```bash
git add src/core/campaign.ts
git commit -m "feat(campaign): wire CrisisOutcome + ideologyBreakdown into end-of-epoch state"
```

---

### Task 21: Rewrite `src/facade/GameAPI.ts`

**Files:**
- Modify: `src/facade/GameAPI.ts`

- [ ] **Step 1: Replace imports + Snapshot type**

Open `src/facade/GameAPI.ts`. Replace the top of the file through `Snapshot`:

```ts
import {
  createCampaign,
  prepareEndOfEpoch,
  finalizeEpoch,
  type EndOfEpochState,
} from "../core/campaign.ts";
import {
  buildColumn as buildColumnCore,
  createEpoch,
  currentVector,
  discardCharter as discardCharterCore,
  discardColumn as discardColumnCore,
  discardFromHand as discardFromHandCore,
  discardLand as discardLandCore,
  effectiveInfluenceCost,
  endTurn as endTurnCore,
  placeCard as placeCardCore,
  recallInfluence as recallInfluenceCore,
  resolveCrisis as resolveCrisisCore,
} from "../core/epoch.ts";
import { createRng, type RNG } from "../core/rng.ts";
import { getSetting } from "../core/settings.ts";
import {
  addNewSlot,
  deleteSlot as deleteSlotInStore,
  getActiveSlot,
  loadStore,
  switchSlot,
  upsertActiveSlot,
  writeStore,
  type SaveSlot,
  type SavedState,
} from "./persistence.ts";
import type { Campaign, Card, Column, Epoch, IdeologyVector, Setting } from "../core/types.ts";
import { checkAlignment, demonym, demonymName } from "../core/ideology.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand } from "../core/column.ts";
import { evaluateColumn } from "../core/columnPatterns.ts";
import { landMaterialProduction } from "../core/cards.ts";
import { unlockedIdeologyBreakdown } from "../core/projects.ts";

export interface Snapshot {
  campaign: Campaign;
  setting: Setting;
  epoch: Epoch;
  vector: IdeologyVector;
  demonymLabel: string;
  deckCounts: { hand: number; draw: number; discard: number; dissent: number };
  ideologyBreakdown: Record<"solidarity" | "sovereignty" | "transformation" | "heritage", number>;
  columnBuildable: boolean[]; // parallel to epoch.columns
}

export type CommandResult<T = void> = { ok: true; value: T } | { ok: false; error: string };
```

- [ ] **Step 2: Replace the class body**

Within the existing `GameAPI` class:

```ts
  snapshot(): Snapshot {
    const vector = currentVector(this.epoch, this.campaign);
    const dis = this.epoch.hand.concat(this.epoch.draw, this.epoch.discard)
      .filter((c) => c.tags.includes("dissent")).length;
    const columnsView: Column[] = this.epoch.columns.map((c) => ({
      lands: { cards: [...c.lands.cards] },
      influence: { card: c.influence.card },
      charter: { card: c.charter.card },
    }));
    const columnBuildable = columnsView.map((c) => evaluateColumn(c, this.setting.projects) !== null);
    const epochView: Epoch = {
      ...this.epoch,
      hand: [...this.epoch.hand],
      draw: this.epoch.draw,
      discard: [...this.epoch.discard],
      columns: columnsView,
      unlockedProjects: [...this.epoch.unlockedProjects],
      eventLog: [...this.epoch.eventLog],
      taskProgress: { ...this.epoch.taskProgress },
      tasksRevealed: [...this.epoch.tasksRevealed],
      endOfTurnQueue: [...this.epoch.endOfTurnQueue],
      crisis: {
        status: this.epoch.crisis.status,
        outcome: this.epoch.crisis.outcome,
      },
    };
    return {
      campaign: {
        ...this.campaign,
        monuments: [...this.campaign.monuments],
        legacyCards: [...this.campaign.legacyCards],
        terrain: { ...this.campaign.terrain },
        epochHistory: [...this.campaign.epochHistory],
      },
      setting: this.setting,
      epoch: epochView,
      vector,
      demonymLabel: demonymName(demonym(vector)),
      deckCounts: {
        hand: this.epoch.hand.length,
        draw: this.epoch.draw.length,
        discard: this.epoch.discard.length,
        dissent: dis,
      },
      ideologyBreakdown: unlockedIdeologyBreakdown(this.epoch.unlockedProjects),
      columnBuildable,
    };
  }

  getEffectiveCost(card: Card): number {
    return effectiveInfluenceCost(card, currentVector(this.epoch, this.campaign));
  }

  getAlignment(card: Card): "aligned" | "opposed" | "neutral" {
    return checkAlignment(card, currentVector(this.epoch, this.campaign));
  }

  /** Indices of columns where the given hand card could be placed. */
  validColumns(cardId: string): number[] {
    const card = this.epoch.hand.find((c) => c.id === cardId);
    if (!card) return [];
    const out: number[] = [];
    for (let i = 0; i < this.epoch.columns.length; i++) {
      const col = this.epoch.columns[i]!;
      if (card.kind === "land" && canPlaceLand(col, card)) out.push(i);
      else if (card.kind === "role" && canPlaceInfluence(col, card)) out.push(i);
      else if (card.kind === "charter" && canPlaceCharter(col, card)) out.push(i);
    }
    return out;
  }

  landProductionPerTurn(): number {
    let total = 0;
    for (const col of this.epoch.columns) {
      for (const l of col.lands.cards) total += landMaterialProduction(l.rank);
    }
    return total;
  }

  endOfEpochState(): EndOfEpochState | null {
    return this.endOfEpoch;
  }

  placeCard(cardId: string, columnIndex: number): CommandResult<Card> {
    const r = placeCardCore(this.epoch, this.campaign, this.setting, cardId, columnIndex, this.rng);
    return r.ok ? { ok: true, value: r.card } : r;
  }

  discardLand(columnIndex: number): CommandResult<Card> {
    return discardLandCore(this.epoch, columnIndex);
  }
  discardCharter(columnIndex: number): CommandResult<Card> {
    return discardCharterCore(this.epoch, columnIndex);
  }
  recallInfluence(columnIndex: number): CommandResult<Card> {
    return recallInfluenceCore(this.epoch, columnIndex);
  }
  discardColumn(columnIndex: number): CommandResult<void> {
    return discardColumnCore(this.epoch, columnIndex);
  }
  discardFromHand(cardId: string): CommandResult<Card> {
    return discardFromHandCore(this.epoch, cardId);
  }
  buildColumn(columnIndex: number): CommandResult<{ projectId: string; pattern: string }> {
    const r = buildColumnCore(this.epoch, this.setting, columnIndex);
    return r.ok ? { ok: true, value: { projectId: r.value.projectId, pattern: r.value.pattern } } : r;
  }

  endTurn(): CommandResult {
    endTurnCore(this.epoch, this.campaign, this.setting, this.rng);
    this.maybeEnterCrisis();
    return { ok: true, value: undefined };
  }

  resolveCrisis(): CommandResult {
    if (this.epoch.phase !== "crisis") return { ok: false, error: "Not in crisis." };
    resolveCrisisCore(this.epoch, this.setting);
    this.maybeEndEpoch();
    return { ok: true, value: undefined };
  }

  private maybeEnterCrisis(): void {
    // Phase changes are driven by core; this hook left in case the renderer
    // wants to react synchronously.
  }

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
      this.epoch, this.setting, this.campaign, this.endOfEpoch, upgradeChoices,
    );
    this.endOfEpoch = null;
    if (result.kind === "campaign-end") return { ok: true, value: "campaign-end" };
    this.epoch = result.epoch;
    this.setting = result.setting;
    return { ok: true, value: "next" };
  }
```

Delete the old `playCard`, `retrieveFromTableau`, `retrieveCost`, `canRetrieve`, `discardForMaterial`, `playMegaStructure`, `validSlots` methods and their re-exports at the bottom of the file. Remove the `describeRequirement`, `canPlaceTopper`, `isImproved` re-exports.

- [ ] **Step 3: Commit**

```bash
git add src/facade/GameAPI.ts
git commit -m "feat(facade): new column-based command surface; Snapshot includes buildable flags"
```

---

### Task 22: Bump persistence to v3 with v2 archive

**Files:**
- Modify: `src/facade/persistence.ts`

- [ ] **Step 1: Rewrite `persistence.ts`**

```ts
import type { Campaign, Epoch } from "../core/types.ts";
import type { EndOfEpochState } from "../core/campaign.ts";

const STORE_KEY = "deck-demo-saves-v3";
const PREV_KEY = "deck-demo-saves-v2";
const ARCHIVE_KEY = "deck-demo-saves-v2-archive";

export const MAX_SLOTS = 10;

export interface SavedState {
  version: 3;
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
  version: 3;
  activeSlotId: string | null;
  slots: SaveSlot[];
}

function emptyStore(): SaveStore {
  return { version: 3, activeSlotId: null, slots: [] };
}

export function loadStore(): SaveStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveStore;
      if (parsed.version === 3 && Array.isArray(parsed.slots)) return parsed;
    }
    // One-time v2 archival.
    const prev = localStorage.getItem(PREV_KEY);
    if (prev && !localStorage.getItem(ARCHIVE_KEY)) {
      localStorage.setItem(ARCHIVE_KEY, prev);
      localStorage.removeItem(PREV_KEY);
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

export function getActiveSlot(store: SaveStore): SaveSlot | null {
  if (!store.activeSlotId) return null;
  return store.slots.find((s) => s.id === store.activeSlotId) ?? null;
}

export function upsertActiveSlot(store: SaveStore, state: SavedState): SaveStore {
  if (!store.activeSlotId) return addNewSlot(store, state);
  const idx = store.slots.findIndex((s) => s.id === store.activeSlotId);
  if (idx === -1) return addNewSlot(store, state);
  const slot = store.slots[idx]!;
  store.slots[idx] = { ...slot, state, label: labelFromState(state), lastPlayedAt: Date.now() };
  return store;
}

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

export function v2ArchiveExists(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ARCHIVE_KEY) !== null;
}
```

Update `GameAPI.exportState`:

```ts
exportState(): SavedState {
  return {
    version: 3,
    campaign: this.campaign,
    settingId: this.setting.id,
    epoch: this.epoch,
    endOfEpoch: this.endOfEpoch,
    seed: this.campaign.seed,
  };
}
```

- [ ] **Step 2: Typecheck and run tests**

```bash
bun run typecheck && bun test
# Expected: 0 type errors. Tests that depend on the renderer or old API
# may still fail; the new core tests should pass.
```

- [ ] **Step 3: Commit**

```bash
git add src/facade/persistence.ts src/facade/GameAPI.ts
git commit -m "feat(persistence): v3 store; archive v2 to deck-demo-saves-v2-archive on first load"
```

---

## Phase E — Renderer

Renderer tasks are typecheck-and-eyeball: this project has no Vue component tests. Verify each task by running `bun run typecheck` and loading `http://localhost:5174/` in the browser to confirm the panel renders.

### Task 23: Create `LandCell.vue`

**Files:**
- Create: `src/renderer/components/LandCell.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div
    :class="[
      'cell land-cell',
      { occupied: cards.length > 0, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="cards.length === 0" class="cell-empty">place a Land</div>
    <div v-else class="land-stack">
      <Card
        v-for="(card, i) in cards"
        :key="card.id + '@' + i"
        :card="card"
        :selectable="false"
      />
      <button v-if="cards.length > 0" class="cell-action" @click.stop="$emit('discard')">
        Discard
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";

defineProps<{
  cards: CardT[];
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ discard: [] }>();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/LandCell.vue
git commit -m "feat(renderer): LandCell component"
```

---

### Task 24: Create `InfluenceCell.vue`

**Files:**
- Create: `src/renderer/components/InfluenceCell.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div
    :class="[
      'cell influence-cell',
      { occupied: !!card, locked: locked, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="locked" class="cell-locked">
      <span class="lock-glyph">🔒</span>
      <span class="lock-hint">place a Land first</span>
    </div>
    <div v-else-if="!card" class="cell-empty">place a Role</div>
    <div v-else class="cell-content">
      <Card :card="card" :selectable="false" />
      <button class="cell-action" @click.stop="$emit('recall')">Recall</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";

defineProps<{
  card: CardT | null;
  locked: boolean;
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ recall: [] }>();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/InfluenceCell.vue
git commit -m "feat(renderer): InfluenceCell component"
```

---

### Task 25: Create `CharterCell.vue`

**Files:**
- Create: `src/renderer/components/CharterCell.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div
    :class="[
      'cell charter-cell',
      { occupied: !!card, locked: locked, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="locked" class="cell-locked">
      <span class="lock-glyph">🔒</span>
      <span class="lock-hint">fill Influence first</span>
    </div>
    <div v-else-if="!card" class="cell-empty">place a Charter</div>
    <div v-else class="cell-content">
      <Card :card="card" :selectable="false" />
      <button class="cell-action" @click.stop="$emit('discard')">Discard</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";

defineProps<{
  card: CardT | null;
  locked: boolean;
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ discard: [] }>();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CharterCell.vue
git commit -m "feat(renderer): CharterCell component"
```

---

### Task 26: Create `ColumnFooter.vue`

**Files:**
- Create: `src/renderer/components/ColumnFooter.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div class="column-footer">
    <button :disabled="empty" :title="empty ? 'Column is empty' : 'Discards every card; adds 1 Dissent per card'" @click="$emit('discard-column')">
      Discard column
    </button>
    <button :disabled="!buildable" :title="buildable ? buildTooltip : 'Build needs Land + Influence + Charter'" @click="$emit('build')">
      Build
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  empty: boolean;
  buildable: boolean;
  buildTooltip: string;
}>();
defineEmits<{ "discard-column": []; "build": [] }>();
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/ColumnFooter.vue
git commit -m "feat(renderer): ColumnFooter (Discard column + Build buttons)"
```

---

### Task 27: Create `TableauColumn.vue`

**Files:**
- Create: `src/renderer/components/TableauColumn.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div :class="['tableau-column', { 'drop-target': anyDropTarget, 'drag-over': isAnyDragOver }]">
    <CharterCell
      :card="column.charter.card"
      :locked="column.influence.card === null"
      :is-drop-target="charterDropTarget"
      :is-drag-over="dragOver === 'charter'"
      @dragenter.prevent="dragOver = charterDropTarget ? 'charter' : null"
      @dragover.prevent="onDragOver($event, 'charter')"
      @dragleave="dragOver = null"
      @drop.prevent="onDrop($event)"
      @discard="$emit('discard-charter')"
    />
    <InfluenceCell
      :card="column.influence.card"
      :locked="column.lands.cards.length === 0"
      :is-drop-target="influenceDropTarget"
      :is-drag-over="dragOver === 'influence'"
      @dragenter.prevent="dragOver = influenceDropTarget ? 'influence' : null"
      @dragover.prevent="onDragOver($event, 'influence')"
      @dragleave="dragOver = null"
      @drop.prevent="onDrop($event)"
      @recall="$emit('recall-influence')"
    />
    <LandCell
      :cards="column.lands.cards"
      :is-drop-target="landDropTarget"
      :is-drag-over="dragOver === 'land'"
      @dragenter.prevent="dragOver = landDropTarget ? 'land' : null"
      @dragover.prevent="onDragOver($event, 'land')"
      @dragleave="dragOver = null"
      @drop.prevent="onDrop($event)"
      @discard="$emit('discard-land')"
    />
    <ColumnFooter
      :empty="empty"
      :buildable="buildable"
      :build-tooltip="buildTooltip"
      @discard-column="$emit('discard-column')"
      @build="$emit('build')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Column } from "../../core/types.ts";
import CharterCell from "./CharterCell.vue";
import InfluenceCell from "./InfluenceCell.vue";
import LandCell from "./LandCell.vue";
import ColumnFooter from "./ColumnFooter.vue";
import { dragging, endDrag, readDragPayload } from "../util/dragState.ts";

const props = defineProps<{
  column: Column;
  buildable: boolean;
  buildTooltip: string;
  validForDrag: { land: boolean; influence: boolean; charter: boolean };
}>();

const emit = defineEmits<{
  "place-card": [cardId: string];
  "discard-land": [];
  "discard-charter": [];
  "recall-influence": [];
  "discard-column": [];
  "build": [];
}>();

const dragOver = ref<"land" | "influence" | "charter" | null>(null);

const landDropTarget = computed(() => dragging.value !== null && props.validForDrag.land);
const influenceDropTarget = computed(() => dragging.value !== null && props.validForDrag.influence);
const charterDropTarget = computed(() => dragging.value !== null && props.validForDrag.charter);
const anyDropTarget = computed(
  () => landDropTarget.value || influenceDropTarget.value || charterDropTarget.value,
);
const isAnyDragOver = computed(() => dragOver.value !== null);
const empty = computed(
  () =>
    props.column.lands.cards.length === 0 &&
    props.column.influence.card === null &&
    props.column.charter.card === null,
);

function onDragOver(e: DragEvent, row: "land" | "influence" | "charter"): void {
  if (e.dataTransfer && rowAcceptsDrag(row)) e.dataTransfer.dropEffect = "move";
}
function rowAcceptsDrag(row: "land" | "influence" | "charter"): boolean {
  return row === "land" ? props.validForDrag.land
    : row === "influence" ? props.validForDrag.influence
    : props.validForDrag.charter;
}
function onDrop(e: DragEvent): void {
  dragOver.value = null;
  // Any drop in this column routes via card kind (core decides row).
  if (!anyDropTarget.value) return;
  const payload = readDragPayload(e);
  if (!payload) return;
  emit("place-card", payload.cardId);
  endDrag();
}
</script>

<style scoped>
.tableau-column {
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: 4px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/TableauColumn.vue
git commit -m "feat(renderer): TableauColumn wraps three row cells + footer + drag routing"
```

---

### Task 28: Rewrite `TableauPanel.vue`

**Files:**
- Modify: `src/renderer/components/TableauPanel.vue`

- [ ] **Step 1: Replace contents**

```vue
<template>
  <section class="section tableau-panel">
    <h2>Tableau · produces {{ production }} Mat / turn</h2>
    <div class="tableau-grid" :style="{ '--col-count': columns.length }">
      <div class="row-labels">
        <div class="row-label">Charter</div>
        <div class="row-label">Influence</div>
        <div class="row-label">Land</div>
        <div class="row-label"></div>
      </div>
      <TableauColumn
        v-for="(col, i) in columns"
        :key="i"
        :column="col"
        :buildable="columnBuildable[i] ?? false"
        :build-tooltip="buildTooltip(i)"
        :valid-for-drag="validForDrag(i)"
        @place-card="(cardId) => $emit('placeCard', cardId, i)"
        @discard-land="$emit('discardLand', i)"
        @discard-charter="$emit('discardCharter', i)"
        @recall-influence="$emit('recallInfluence', i)"
        @discard-column="$emit('discardColumn', i)"
        @build="$emit('build', i)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Card, Column } from "../../core/types.ts";
import TableauColumn from "./TableauColumn.vue";
import { dragging } from "../util/dragState.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand } from "../../core/column.ts";

const props = defineProps<{
  columns: Column[];
  production: number;
  columnBuildable: boolean[];
  buildableLabels: string[]; // one label per column (e.g., "Pair → The Commons (+2)")
  getCardFromHand: (cardId: string) => Card | null;
}>();

defineEmits<{
  placeCard: [cardId: string, columnIndex: number];
  discardLand: [columnIndex: number];
  discardCharter: [columnIndex: number];
  recallInfluence: [columnIndex: number];
  discardColumn: [columnIndex: number];
  build: [columnIndex: number];
}>();

function buildTooltip(i: number): string {
  const label = props.buildableLabels[i] ?? "";
  return label || "Build";
}

function validForDrag(i: number): { land: boolean; influence: boolean; charter: boolean } {
  const card = dragging.value ? props.getCardFromHand(dragging.value.cardId) : null;
  if (!card) return { land: false, influence: false, charter: false };
  const col = props.columns[i]!;
  return {
    land: card.kind === "land" && canPlaceLand(col, card),
    influence: card.kind === "role" && canPlaceInfluence(col, card),
    charter: card.kind === "charter" && canPlaceCharter(col, card),
  };
}
</script>

<style scoped>
.tableau-grid {
  display: grid;
  grid-template-columns: 80px repeat(var(--col-count), 1fr);
  gap: 6px;
}
.row-labels {
  display: grid;
  grid-template-rows: auto auto auto auto;
  font-size: 12px;
  color: var(--text-muted);
}
.row-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/TableauPanel.vue
git commit -m "feat(renderer): TableauPanel — 3-row CSS grid with column wrappers"
```

---

### Task 29: Create `UnlockedProjectsPanel.vue`

**Files:**
- Create: `src/renderer/components/UnlockedProjectsPanel.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <section class="section unlocked-projects">
    <h2>Keystone Projects ({{ unlocks.length }})</h2>
    <div class="ideology-aggregate">
      <span><b>S</b> {{ breakdown.solidarity }}</span>
      <span><b>V</b> {{ breakdown.sovereignty }}</span>
      <span><b>T</b> {{ breakdown.transformation }}</span>
      <span><b>H</b> {{ breakdown.heritage }}</span>
    </div>
    <div v-for="group in grouped" :key="group.pattern" class="pattern-group">
      <div class="pattern-header">
        {{ patternLabel(group.pattern) }} ·
        {{ group.unlocks.length }} unlocked ·
        value {{ group.totalValue }}
      </div>
      <div v-for="u in group.unlocks" :key="u.projectId + '@' + u.turn" class="unlock-entry">
        <span class="project-name">{{ projectName(u.projectId) }}</span>
        <span class="entry-ideology">{{ entryIdeology(u) }}</span>
        <span class="entry-turn">T{{ u.turn }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ideology, KeystoneProject, PatternKind, ProjectUnlock } from "../../core/types.ts";
import { PATTERNS_IN_ORDER } from "../../core/projects.ts";

const props = defineProps<{
  unlocks: ProjectUnlock[];
  projects: KeystoneProject[];
  breakdown: Record<Ideology, number>;
}>();

const grouped = computed(() => {
  return [...PATTERNS_IN_ORDER].reverse().map((pattern) => {
    const unlocks = props.unlocks.filter((u) => u.pattern === pattern);
    let totalValue = 0;
    for (const u of unlocks) {
      const p = props.projects.find((p) => p.id === u.projectId);
      if (p) totalValue += p.value;
    }
    return { pattern, unlocks, totalValue };
  }).filter((g) => g.unlocks.length > 0);
});

function patternLabel(p: PatternKind): string {
  switch (p) {
    case "four-of-a-kind": return "Four of a Kind";
    case "flush": return "Flush";
    case "three-of-a-kind": return "Three of a Kind";
    case "pair": return "Pair";
    case "high-card": return "High Card";
  }
}
function projectName(id: string): string {
  return props.projects.find((p) => p.id === id)?.name ?? id;
}
function entryIdeology(u: ProjectUnlock): string {
  const counts: Record<Ideology, number> = { solidarity: 0, sovereignty: 0, transformation: 0, heritage: 0 };
  for (const c of u.cards) {
    if (c.ideology === "wild") continue;
    counts[c.ideology] += 1;
  }
  const parts: string[] = [];
  if (counts.solidarity) parts.push(`S${counts.solidarity}`);
  if (counts.sovereignty) parts.push(`V${counts.sovereignty}`);
  if (counts.transformation) parts.push(`T${counts.transformation}`);
  if (counts.heritage) parts.push(`H${counts.heritage}`);
  return parts.join(" · ");
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/UnlockedProjectsPanel.vue
git commit -m "feat(renderer): UnlockedProjectsPanel (sidebar list grouped by pattern)"
```

---

### Task 30: Create `CrisisScreen.vue`

**Files:**
- Create: `src/renderer/components/CrisisScreen.vue`

- [ ] **Step 1: Create the file**

```vue
<template>
  <div class="modal-overlay">
    <div class="modal crisis-screen">
      <h1>{{ crisis.name }}</h1>
      <p class="flavor">{{ crisis.flavor }}</p>
      <p class="difficulty">Difficulty: <b>{{ crisis.difficulty }}</b></p>

      <ol class="unlock-walk">
        <li v-for="(u, i) in walk" :key="u.projectId + '@' + u.turn">
          <span class="step-pattern">{{ patternLabel(u.pattern) }}</span>
          <span class="step-name">{{ projectName(u.projectId) }}</span>
          <span class="step-value">+{{ projectValue(u.projectId) }}</span>
          <span class="step-running">= {{ runningTotals[i] }}</span>
        </li>
      </ol>

      <p class="verdict">
        Total {{ outcome.totalValue }} / {{ crisis.difficulty }} —
        <b>{{ outcome.cleared ? "Cleared" : "Failed" }}</b>
      </p>

      <p class="ideology">
        Ideology: S{{ breakdown.solidarity }} · V{{ breakdown.sovereignty }} ·
        T{{ breakdown.transformation }} · H{{ breakdown.heritage }}
      </p>

      <LegacyChoiceRow
        v-for="cand in candidates"
        :key="cand.id"
        :candidate="cand"
        :chosen="choices[cand.id]"
        @choose="(u) => onChoose(cand.id, u)"
      />

      <button class="primary" @click="$emit('advance', choices)">
        {{ nextLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  Crisis,
  CrisisOutcome,
  Ideology,
  KeystoneProject,
  LegacyCandidate,
  PatternKind,
  ProjectUnlock,
} from "../../core/types.ts";
import LegacyChoiceRow from "./LegacyChoiceRow.vue";

const props = defineProps<{
  crisis: Crisis;
  outcome: CrisisOutcome;
  projects: KeystoneProject[];
  candidates: LegacyCandidate[];
  breakdown: Record<Ideology, number>;
  nextSettingName: string;
}>();
defineEmits<{ advance: [choices: Record<string, "potency" | "pliability" | "persistence">] }>();

const choices = ref<Record<string, "potency" | "pliability" | "persistence">>({});

const walk = computed(() => props.outcome.contributingUnlocks);
const runningTotals = computed(() => {
  const out: number[] = [];
  let acc = 0;
  for (const u of walk.value) {
    acc += projectValue(u.projectId);
    out.push(acc);
  }
  return out;
});
const nextLabel = computed(() =>
  props.outcome.cleared ? `Continue to ${props.nextSettingName}` : "Continue",
);

function patternLabel(p: PatternKind): string {
  switch (p) {
    case "four-of-a-kind": return "Four";
    case "flush": return "Flush";
    case "three-of-a-kind": return "Three";
    case "pair": return "Pair";
    case "high-card": return "High";
  }
}
function projectName(id: string): string {
  return props.projects.find((p) => p.id === id)?.name ?? id;
}
function projectValue(id: string): number {
  return props.projects.find((p) => p.id === id)?.value ?? 0;
}
function onChoose(id: string, u: "potency" | "pliability" | "persistence"): void {
  choices.value = { ...choices.value, [id]: u };
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CrisisScreen.vue
git commit -m "feat(renderer): CrisisScreen unifies win/loss reveal + Legacy choice"
```

---

### Task 31: Update `TurnBar.vue` for turn budget

**Files:**
- Modify: `src/renderer/components/TurnBar.vue`

- [ ] **Step 1: Replace the file**

```vue
<template>
  <div class="turn-bar">
    <div class="meta">
      <b>Epoch {{ epochNumber }}</b> · {{ settingName }}
    </div>
    <div class="turn-progress" :class="{ near: turn / maxTurns >= 0.66, edge: turn / maxTurns >= 0.85 }">
      Turn {{ turn }} / {{ maxTurns }} · Crisis after T{{ maxTurns }}
    </div>
    <div class="resources">
      Inf {{ influence }} · Mat {{ materials }} · Dissent {{ dissentCount }}
    </div>
    <button :disabled="ended" @click="$emit('end-turn')">End turn</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  epochNumber: number;
  settingName: string;
  turn: number;
  maxTurns: number;
  influence: number;
  materials: number;
  dissentCount: number;
  dissentFraction: number;
  ended: boolean;
}>();
defineEmits<{ "end-turn": [] }>();
</script>

<style scoped>
.turn-progress.near { color: var(--warn, #c80); }
.turn-progress.edge { color: var(--danger, #c33); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/TurnBar.vue
git commit -m "feat(renderer): TurnBar shows turn budget + Crisis countdown"
```

---

### Task 32: Update `HandPanel.vue` (drop play-to-project; rename discard)

**Files:**
- Modify: `src/renderer/components/HandPanel.vue`

The current `HandPanel.vue` has a "play to slot" path (kept; routes to column) and a "discard for material" path (renamed; no Material). Remove any per-project play buttons.

- [ ] **Step 1: Read current file and edit**

Read `src/renderer/components/HandPanel.vue`, then:
- Rename emit `discard-selection` → `discard-from-hand` (the action is now a pure release with Dissent penalty).
- In the button labels, replace "Discard for +N Mat" with "Discard (+1 Dissent)".
- Replace the `discard-gain` prop and its consumers with nothing (delete the prop and the `+gain` math).
- Replace `play-to-slot` emit signature: stays `(ids: string[], columnIndex: number)`; the consumer changes from `playCard` to `placeCard` upstream — no change here.

(The shape of the changes is mechanical; the engineer should preserve the existing layout and only adjust labels/emits.)

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/HandPanel.vue
git commit -m "feat(renderer): HandPanel — discard releases card (+1 Dissent), no Material"
```

---

### Task 33: Update `GameService.ts` bindings

**Files:**
- Modify: `src/renderer/GameService.ts`

- [ ] **Step 1: Replace method bindings**

Replace the body of the `GameService` class methods so it surfaces the new commands:

```ts
  validColumns(cardId: string): number[] {
    return this.api.validColumns(cardId);
  }

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
```

Delete `validSlots`, `canRetrieve`, `retrieveCost`, `retrieve`, `discardForMaterial`, `playMegaStructure`, `playCard` from this class. Keep `endTurn`, `advanceEpoch`, `restart`, `switchSlot`, `newCampaignSlot`, `deleteSlot`, `landProduction`, `getEffectiveCost`, `getAlignment`.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/GameService.ts
git commit -m "feat(renderer): GameService surfaces column-based commands"
```

---

### Task 34: Update `App.vue` to wire the new panels

**Files:**
- Modify: `src/renderer/App.vue`

- [ ] **Step 1: Replace template and script**

Remove imports of `ProjectZonesPanel` and `EndOfEpochScreen`. Add imports of `UnlockedProjectsPanel` and `CrisisScreen`. Switch `TableauPanel` props and event handlers to the new shape. Show `CrisisScreen` when `epoch.phase === "crisis"` or `endOfEpoch` is set.

Key template fragments to replace:

```vue
<TableauPanel
  :columns="epoch.columns"
  :production="landProduction"
  :column-buildable="snapshot.columnBuildable"
  :buildable-labels="buildableLabels"
  :get-card-from-hand="getCardFromHand"
  @place-card="onPlaceCard"
  @discard-land="onDiscardLand"
  @discard-charter="onDiscardCharter"
  @recall-influence="onRecallInfluence"
  @discard-column="onDiscardColumn"
  @build="onBuild"
/>

<UnlockedProjectsPanel
  :unlocks="epoch.unlockedProjects"
  :projects="setting.projects"
  :breakdown="snapshot.ideologyBreakdown"
/>
```

And, in the modal area, replace `<EndOfEpochScreen v-if="eoe" .../>` with:

```vue
<CrisisScreen
  v-if="eoe"
  :crisis="setting.crisis"
  :outcome="eoe.crisis"
  :projects="setting.projects"
  :candidates="eoe.candidates"
  :breakdown="eoe.ideologyBreakdown"
  :next-setting-name="nextSettingName"
  @advance="onAdvance"
/>
<button v-if="!eoe && epoch.phase === 'crisis'" class="primary" @click="onResolveCrisis">
  Resolve Crisis
</button>
```

Script additions:

```ts
import UnlockedProjectsPanel from "./components/UnlockedProjectsPanel.vue";
import CrisisScreen from "./components/CrisisScreen.vue";
import { evaluateColumn } from "../core/columnPatterns.ts";

const buildableLabels = computed(() => {
  return snapshot.value.epoch.columns.map((col) => {
    const m = evaluateColumn(col, setting.value.projects);
    if (!m) return "";
    const p = setting.value.projects.find((p) => p.id === m.projectId);
    return p ? `${patternLabel(m.kind)} → ${p.name} (+${p.value})` : "";
  });
});

function getCardFromHand(cardId: string): Card | null {
  return epoch.value.hand.find((c) => c.id === cardId) ?? null;
}
function patternLabel(p: string): string {
  return p.split("-").map(s => s[0]!.toUpperCase() + s.slice(1)).join(" ");
}

function onPlaceCard(cardId: string, i: number): void { game.placeCard(cardId, i); }
function onDiscardLand(i: number): void { game.discardLand(i); }
function onDiscardCharter(i: number): void { game.discardCharter(i); }
function onRecallInfluence(i: number): void { game.recallInfluence(i); }
function onDiscardColumn(i: number): void { game.discardColumn(i); }
function onBuild(i: number): void { game.buildColumn(i); }
function onResolveCrisis(): void { game.resolveCrisis(); }
```

Delete old handlers: `onRetrieve`, `onPlayMegaStructure`, `onDropCardToDiscard` (renamed `onDiscardFromHand`), `onPlayToSlot` (renamed `onPlaceCard`).

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
# Expected: 0 errors. If errors remain, they point at lingering references
# to old types (tableau, megaProjects, retrieveCost, etc.) — fix and re-run.
```

- [ ] **Step 3: Browser smoke test**

```bash
bun run dev
# Open http://localhost:5174/, verify the 3-row tableau renders, drag a Land
# from hand to a column, drag a Role to row 2, drag a Charter to row 3,
# press Build and watch the column empty.
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.vue
git commit -m "feat(renderer): App.vue wires column tableau + UnlockedProjectsPanel + CrisisScreen"
```

---

## Phase F — Cleanup, script, remaining tests

### Task 35: Delete deprecated files

**Files:**
- Delete: `src/core/tableau.ts`, `src/core/patterns.ts`
- Delete: `src/renderer/components/TableauSlot.vue`, `ProjectZonesPanel.vue`, `ProjectZone.vue`, `EndOfEpochScreen.vue`
- Delete: `tests/winflow.test.ts` (replaced by `crisisflow.test.ts` in Task 37)

- [ ] **Step 1: Verify no remaining references**

```bash
grep -rln "from \"\.\.\/core\/tableau" src tests
grep -rln "from \"\.\.\/core\/patterns" src tests
grep -rln "TableauSlot\b" src tests
grep -rln "MegaProject\b" src tests
grep -rln "ProjectZonesPanel\|ProjectZone\.vue\|EndOfEpochScreen\.vue" src
# Expected: zero matches for each.
```

If any matches surface, fix them before deleting (likely lingering imports in the renderer that Task 34 missed).

- [ ] **Step 2: Delete files**

```bash
git rm src/core/tableau.ts src/core/patterns.ts
git rm src/renderer/components/TableauSlot.vue
git rm src/renderer/components/ProjectZonesPanel.vue
git rm src/renderer/components/ProjectZone.vue
git rm src/renderer/components/EndOfEpochScreen.vue
git rm tests/winflow.test.ts
```

- [ ] **Step 3: Typecheck + tests**

```bash
bun run typecheck && bun test
# Expected: green.
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete tableau.ts, patterns.ts, and superseded renderer components"
```

---

### Task 36: Rename `scripts/analyze-paths.ts` to `analyze-crisis.ts` (new heuristic)

**Files:**
- Delete: `scripts/analyze-paths.ts`
- Create: `scripts/analyze-crisis.ts`

- [ ] **Step 1: Create `scripts/analyze-crisis.ts`**

```ts
// Greedy heuristic: per Setting, run N Epochs and report Crisis win rate
// and project-unlock cadence.

import { GameAPI } from "../src/facade/GameAPI.ts";
import { evaluateColumn } from "../src/core/columnPatterns.ts";

const runsPerSetting = Number(process.argv[2] ?? 50);

interface Report {
  setting: string;
  wins: number;
  runs: number;
  avgFirstPair: number | null;
  avgFirstThree: number | null;
  avgFirstFlush: number | null;
  avgFirstFour: number | null;
  avgMargin: number;
}

function runEpoch(api: GameAPI): { won: boolean; firstByPattern: Record<string, number>; margin: number } {
  const firstByPattern: Record<string, number> = {};
  while (api.snapshot().epoch.phase === "play") {
    const snap = api.snapshot();
    // Try to play any hand card to its first valid column.
    let played = false;
    for (const card of snap.epoch.hand) {
      const cols = api.validColumns(card.id);
      if (cols.length === 0) continue;
      const r = api.placeCard(card.id, cols[0]!);
      if (r.ok) { played = true; break; }
    }
    // Try to build any buildable column.
    for (let i = 0; i < snap.epoch.columns.length; i++) {
      const m = evaluateColumn(snap.epoch.columns[i]!, snap.setting.projects);
      if (!m) continue;
      const r = api.buildColumn(i);
      if (r.ok) {
        if (firstByPattern[m.kind] === undefined) {
          firstByPattern[m.kind] = api.snapshot().epoch.turn;
        }
        played = true;
        break;
      }
    }
    if (!played) api.endTurn();
  }
  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const outcome = api.snapshot().epoch.crisis.outcome!;
  const margin = outcome.totalValue - api.snapshot().setting.crisis.difficulty;
  return { won: outcome.cleared, firstByPattern, margin };
}

function reportFor(settingId: string, runs: number): Report {
  let wins = 0;
  let totalMargin = 0;
  const firsts: Record<string, number[]> = { pair: [], "three-of-a-kind": [], flush: [], "four-of-a-kind": [] };
  for (let i = 0; i < runs; i++) {
    const api = new GameAPI(i + 1, { skipLoad: true });
    // Restart into the target setting if different — for now we assume Homeworld start.
    const r = runEpoch(api);
    if (r.won) wins++;
    totalMargin += r.margin;
    for (const k of Object.keys(firsts)) {
      if (r.firstByPattern[k] !== undefined) firsts[k]!.push(r.firstByPattern[k]!);
    }
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return {
    setting: settingId,
    wins,
    runs,
    avgFirstPair: avg(firsts["pair"]!),
    avgFirstThree: avg(firsts["three-of-a-kind"]!),
    avgFirstFlush: avg(firsts["flush"]!),
    avgFirstFour: avg(firsts["four-of-a-kind"]!),
    avgMargin: totalMargin / runs,
  };
}

const report = reportFor("homeworld", runsPerSetting);
console.log(JSON.stringify(report, null, 2));
```

- [ ] **Step 2: Delete the old script**

```bash
git rm scripts/analyze-paths.ts
git add scripts/analyze-crisis.ts
```

- [ ] **Step 3: Smoke run**

```bash
bun run scripts/analyze-crisis.ts 5
# Expected: a JSON report. Exact values not asserted.
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(scripts): rename analyze-paths -> analyze-crisis; new heuristic"
```

---

### Task 37: Add `tests/crisisflow.test.ts` and update remaining tests

**Files:**
- Create: `tests/crisisflow.test.ts`
- Modify: `tests/ideology.test.ts`
- Modify: `tests/smoke.test.ts`

- [ ] **Step 1: Create `tests/crisisflow.test.ts`**

```ts
import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";

describe("Crisis flow", () => {
  test("Epoch reaches Crisis when turn budget is exceeded", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    let safety = 0;
    while (api.snapshot().epoch.phase === "play" && safety < limit + 5) {
      api.endTurn();
      safety++;
    }
    expect(api.snapshot().epoch.phase).toBe("crisis");
  });

  test("resolveCrisis records a CrisisOutcome", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome!;
    expect(typeof out.totalValue).toBe("number");
    expect(typeof out.cleared).toBe("boolean");
  });

  test("with zero unlocks, Crisis fails", () => {
    const api = new GameAPI(7, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome!;
    expect(out.cleared).toBe(false);
    expect(out.totalValue).toBe(0);
  });
});
```

- [ ] **Step 2: Update `tests/ideology.test.ts`**

Open the file. Replace any import of `allTableauCards` from `tableau.ts` with `columnCards` from `column.ts`. Replace test setups that build `TableauSlot[]` with `Column[]` via `createEmptyColumn` + `placeLand`. Add one test for `unlockedIdeologyBreakdown`:

```ts
import { describe, test, expect } from "bun:test";
import { unlockedIdeologyBreakdown } from "../src/core/projects.ts";
import { getCard, landId } from "../src/core/cards.ts";
import type { ProjectUnlock } from "../src/core/types.ts";

describe("unlockedIdeologyBreakdown", () => {
  test("sums non-wild ideologies across unlocks", () => {
    const u: ProjectUnlock = {
      projectId: "x", pattern: "pair", turn: 1,
      cards: [getCard(landId(7, "solidarity")), getCard(landId(7, "heritage"))],
    };
    const b = unlockedIdeologyBreakdown([u]);
    expect(b.solidarity).toBe(1);
    expect(b.heritage).toBe(1);
    expect(b.sovereignty).toBe(0);
  });
});
```

(Keep all `deriveVector` tests; the engineer rewrites their inputs to use `Column[]` instead of `TableauSlot[]`.)

- [ ] **Step 3: Update `tests/smoke.test.ts`**

Replace the file contents:

```ts
import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";

describe("GameAPI smoke", () => {
  test("fresh campaign starts with Homeworld", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const s = api.snapshot();
    expect(s.setting.id).toBe("homeworld");
    expect(s.epoch.epochNumber).toBe(1);
    expect(s.epoch.hand.length).toBe(s.setting.rules.handSize);
    expect(s.epoch.columns.length).toBe(s.setting.rules.columnCount);
    expect(
      s.epoch.columns.every(
        (col) =>
          col.lands.cards.length === 0 && col.influence.card === null && col.charter.card === null,
      ),
    ).toBe(true);
  });

  test("end turn increments the turn counter while in play phase", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const t0 = api.snapshot().epoch.turn;
    api.endTurn();
    expect(api.snapshot().epoch.turn).toBe(t0 + 1);
  });

  test("Crisis fires when turn budget is exceeded", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    expect(api.snapshot().epoch.phase).toBe("crisis");
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
bun test
# Expected: green across the board.
```

- [ ] **Step 5: Commit**

```bash
git add tests/crisisflow.test.ts tests/ideology.test.ts tests/smoke.test.ts
git commit -m "test: crisisflow + smoke + ideology updated for column redesign"
```

---

### Task 38: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

```bash
bun run typecheck
# Expected: 0 errors.
```

- [ ] **Step 2: All tests**

```bash
bun test
# Expected: all green.
```

- [ ] **Step 3: Dev server smoke test**

```bash
bun run dev
# Open http://localhost:5174/.
# - Tableau renders as 3 rows × N columns with row labels.
# - Locked rows show a 🔒 with the right hint.
# - Drag a Land from hand to a column → lands in row 1.
# - Drag a Role to row 2 → influence row fills.
# - Drag a Charter to row 3 → charter row fills.
# - "Build" enables; tooltip shows "{pattern} → {projectName} (+value)".
# - Press Build → column empties, sidebar entry appears.
# - Per-card "Discard" buttons add Dissent to the deck.
# - Turn bar shows "Turn N / max · Crisis after T{max}".
# - End enough turns → Crisis screen reveals the walk and verdict.
```

If any of these fails, file an issue or restart that task — do not declare the redesign done.

- [ ] **Step 4: Commit (no-op summary)**

```bash
git commit --allow-empty -m "chore: tableau three-tier redesign complete"
```

---

## Self-review checklist

Run through this before declaring the plan ready. Each item should map to a task above.

- [x] Card kind rename `keystone` → `charter` — Task 1
- [x] New types (Column, KeystoneProject, ProjectUnlock, Crisis, CrisisOutcome, GameEvent) — Task 2
- [x] Pure column placement helpers — Task 3
- [x] Pure pattern evaluator — Task 4
- [x] Event union + dispatch — Tasks 5–6
- [x] Project registry + ideology breakdown helper — Task 7
- [x] Setting / Epoch shape reshape — Task 8
- [x] All three Settings rewritten — Tasks 9–10
- [x] `deriveVector` reads columns — Task 11
- [x] Epoch initialization on columns — Task 12
- [x] `placeCard` command — Task 13
- [x] Discard / recall commands — Task 14
- [x] `buildColumn` — Task 15
- [x] `endTurn` + Crisis trigger — Task 16
- [x] `resolveCrisis` — Task 17
- [x] Effects context cleanup — Task 18
- [x] Legacy minting from `CrisisOutcome` — Task 19
- [x] Campaign wiring — Task 20
- [x] GameAPI command surface + Snapshot — Task 21
- [x] Persistence v3 with v2 archive — Task 22
- [x] Renderer cells + column + footer — Tasks 23–27
- [x] TableauPanel grid — Task 28
- [x] Sidebar unlocked-projects panel — Task 29
- [x] CrisisScreen — Task 30
- [x] TurnBar turn budget — Task 31
- [x] HandPanel discard rename + drop play-to-project — Task 32
- [x] GameService rewire — Task 33
- [x] App.vue wiring — Task 34
- [x] Delete tableau.ts / patterns.ts / superseded components — Task 35
- [x] Rename / rewrite analyze script — Task 36
- [x] Crisis-flow + smoke + ideology tests — Task 37
- [x] Final verification — Task 38

