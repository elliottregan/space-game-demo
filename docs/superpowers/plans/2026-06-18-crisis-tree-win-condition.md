# Crisis Tree Win-Condition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single cumulative-points Crisis threshold with a Crisis Tree — a DAG of build objectives (shared root gate → Expansion/Doctrine/Wonder branch terminals) raced against the turn clock; reaching a terminal wins.

**Architecture:** A new pure-core `crisisTree.ts` (types + applyBuild/availableNodes/isWon) feeds off each successful `buildColumn`. The Epoch gains `CrisisTreeState`, the Setting gains a per-Setting `CrisisTree` replacing `crisis.difficulty`, and `resolveCrisis` becomes `isWon`. The win-flip + sim adaptation land atomically; persistence migrates v7→v8; a minimal objectives panel replaces the points bar (polished tree-view deferred).

**Tech Stack:** Vue 3 + TypeScript + Vite + Bun (bun test, tsc --noEmit, lefthook pre-commit). Builds on feat/two-row-tableau-wilds.

---

## Sequencing & commit safety

GREEN-AT-COMMIT RATIONALE (lefthook runs `bun run typecheck` over all of src+tests + oxlint/prettier on staged; scripts/ is OUTSIDE tsconfig and not imported by tests, so it never trips the gate — which is exactly why the sim adaptation in P4 must be deliberate):

- P1 is purely additive (new module + new test + barrel re-export); imports nothing existing, breaks nothing. Safe standalone commit.
- P2 adds `crisisTree` to Setting and authors data while KEEPING `crisis.difficulty`, so every existing reader (resolveCrisis, sims, renderer) still compiles and passes. Non-breaking.
- P3 is the first forced-churn commit (ATOMIC): adding the non-optional `crisisTree` field to Epoch breaks every hand-built Epoch literal in tests at tsc time — they must all gain the field in the SAME commit (fixtures helper + crisisflow + policyCommands). The win condition is still difficulty-based here, so behavior is unchanged and the suite stays green. buildColumn must call applyBuild AFTER dispatch(column-built) because applyBuild needs the inclusive projectBuildCount, which epoch.unlockedProjects only reflects post-push.
- P4 is the win-condition flip (ATOMIC): resolveCrisis switching to isWon breaks crisisflow.test.ts (which asserts difficulty-based cleared) and makes the three sims measure nothing at runtime (they maximize points + read crisis.difficulty). All of these are fixed in ONE commit. The sims are adapted to set an active objective each turn and report won=outcome.cleared so balance tuning works against the real condition — the green gate will NOT force this (scripts aren't typechecked/tested), so it's called out as a deliberate task. totalValue is retained in CrisisOutcome (§7 option b) so legacy.ts/campaign.ts/EpochResult need no change and the 'Crisis leveling' value math test still holds.
- P5 removes the now-dead `crisis.difficulty` (ATOMIC: touches the Crisis type + all three Settings + any straggler reader) and bumps persistence v7->v8 with a migrator. The save version MUST bump because BOTH the Epoch shape (P3 added crisisTree) and the Setting shape (difficulty removed) changed; old saves seed a default crisisTree and load without crashing (mirrors the existing turnPhase/promotedIdeology defensive backfills + migrateV6toV7 pattern). Only the Epoch needs backfill in the save blob since Settings are re-resolved fresh from settingId via getSetting.
- P6 is renderer-only; core+tests are already green, so this can't regress the gate. Kept minimal per spec §9 (objectives panel, not the polished DAG view). ScoreMeter (pure points meter) is deleted; CrisisBar is reduced to the turn clock or folded into the new panel; CrisisScreen drops the difficulty line.

KEY ANCHORS VERIFIED IN CODE: turn.ts resolveCrisis uses `total >= setting.crisis.difficulty` at the cleared= line; buildColumn (commands.ts) returns ProjectUnlock with pattern+promotedIdeology and dispatches column-built which pushes the unlock; dispatch.ts column-built handler pushes unlock then cascades discards (so inclusive count is available right after); Epoch literals needing the new field live in crisisflow.test.ts (epochWithUnlocks) and fixtures.ts emptyPolicyState pattern is the model for emptyCrisisTreeState; persistence v7 = deck-demo-saves-v7 with migrateV6toV7 as the migrator template; GameAPI snapshot deep-clones policy as the model for deep-cloning crisisTree; App.vue uses CrisisBar (turn/maxTurns only — already difficulty-free) + ScoreMeter (reads crisis.difficulty) + CrisisScreen (reads crisis.difficulty + outcome.totalValue). The 4 ideologies come from IDEOLOGIES; setActiveObjective for Doctrine nodes binds one of those four. Sims that read crisis.difficulty: analyze-crisis.ts:465, explore-strategies.ts:440, compare-influence.ts:79.

LEVELING DISPOSITION (spec §7/§8 item 4): adopt option (b)+(c)-lite — RETAIN projectLevels/projectContribution for totalValue (Legacy/Monument magnitude) so resolveCrisis math and its test survive untouched; the upgrade mechanic (§5) is expressed purely via applyBuild's `upgrade?`+projectBuildCount in P1/P3, not via the leveled curve. No need to retire projectLevels in this plan.

REVERIFY BEFORE CODING: read crisisTree.ts spec §4 signatures verbatim; confirm whether App.vue's CrisisBar can be kept clock-only vs folded (it only consumes turn/maxTurns already); confirm tests/persistence.test.ts exists (grep showed it isn't referenced — may need creating).

The sims need the strawman recipe counts to actually be reachable for balance work — P4 ships a 'set active objective + build toward it' driver but the COUNTS themselves are explicitly balance-pending (spec §8); tuning them is downstream of this backbone via run-simulation, not part of the green gate.

---

## Red-team corrections — apply these (authoritative; supersede any task text they touch)

- **C1 (HIGH) — `availableNodes` returns `ObjectiveNode[]` everywhere.** P1 defines `availableNodes(tree, state): ObjectiveNode[]`. Every consumer treats it as nodes, not strings:
  - `setActiveObjective` (commands.ts): availability check is `availableNodes(tree, epoch.crisisTree).some((n) => n.id === nodeId)` — NOT `.includes(nodeId)`.
  - `Snapshot.availableNodes` and the `GameAPI.availableNodes()` query are typed `ObjectiveNode[]`; `snapshot()` assigns `availableNodesCore(tree, epoch.crisisTree)` directly (deep-clone like other snapshot collections).
  - The Doctrine test: `const doctrine = availableNodes(tree, ep.crisisTree).find((n) => n.requireSameIdeology); setActiveObjective(ep, setting, doctrine!.id, "solidarity")` — index by `.id`, never `tree.nodes[node]`.
- **C2 (HIGH) — P3 build-hook tests must avoid the multi-ideology promote rejection.** Core `buildColumn(epoch, setting, columnIndex, rng, promote?)` rejects a column with >=2 present ideologies when `promote` is omitted. Any test that builds either seeds a MONO-ideology column (auto-promote) or passes the arg, e.g. `buildColumn(ep, setting, 0, rng, "solidarity")` (mirrors storage.test.ts:284). Never argless on a 2-color seed.
- **C3 (MED) — CrisisOutcome literal edits are SINGLE-LINE.** The existing `outcome: { totalValue: 0, cleared: true, contributingUnlocks: [], contributions: [] },` literals (dispatch.test.ts, policyCommands.test.ts) are one line. Use single-line exact-match targets when adding `clearedNodeIds: []`; grep each literal first.
- **C4 (MED) — define `emptyCrisisTreeState()` ONCE; the default is the no-op** `{ activeNodeId: null, cleared: [], progress: {}, boundIdeology: {} }`. P4 must NOT redefine it to seed the Homeworld root (that silently changes `storage.test.ts:284`, which builds a column). Tests needing an active objective set it explicitly.
- **C5 (MED) — `tests/persistence.test.ts` EXISTS; edit it, don't author.** Re-grep current line anchors (the plan's drift). After v6->v7->v8 chaining, the existing "a v7 store is returned as-is" test changes meaning — a v7 store now MIGRATES to v8; update that assertion.
- **C6 (MED) — verify sim helpers before use.** In the explore-strategies adaptation, confirm `globalTarget(api)`/`unlockedIdeologyBreakdown` exist; if `globalTarget` is absent, inline a top-present-ideology tally (like the `promoteFor`/`bestPromote` helpers already in the sims).
- **C7 (LOW) — anchors + framing.** Grep `campaign.ts`'s CrisisOutcome literal before editing (line unverified). The facade `buildColumn` returns a reduced `{projectId, pattern, promotedIdeology}`, not a full `ProjectUnlock`; the build->applyBuild hook is wired in CORE `commands.ts`, so ignore the header's "facade returns the unlock" framing.
- **Balance note (not a defect):** with the strawman counts the sims will RUN but report ~0% win (root ~8 builds + a terminal in ~12 turns). That is expected (counts are balance-pending, spec §8) — P4's smoke check confirms the sims RUN and emit cleared-path data, it must NOT assert a win rate.

---

## Phase P1 — Pure `crisisTree.ts` module (types + progress logic)

This phase is **fully additive**: a new pure-core module, a new test file, and three barrel re-exports. Nothing existing imports it, so the whole project stays `tsc`-green and every current test still passes. Two tasks: (1) the failing unit-test file + the module that makes it pass, (2) the barrel re-export + the green-check run.

Anchors verified in code:
- `PatternKind` is defined in `src/core/data/projects.ts:14-24` and re-exported from the barrel `src/core/types.ts:27`.
- `Ideology` is defined in `src/core/data/ideologies.ts:5` and re-exported from the barrel `src/core/types.ts:19`.
- `ProjectUnlock` is defined in `src/core/data/projects.ts:46-58` (`pattern: PatternKind`, `promotedIdeology: Ideology | null`) and re-exported from the barrel `src/core/types.ts:29`. `applyBuild` consumes **only** `unlock.pattern` and `unlock.promotedIdeology`.
- Tests use `import { describe, test, expect } from "bun:test";` (see `tests/columnPatterns.test.ts:1`). Run with `bun test tests/<name>.test.ts`.

---

### Task 1: TDD `crisisTree.ts` — types + `availableNodes` / `applyBuild` / `isWon`

**Files:**
- `tests/crisisTree.test.ts` (new — write first, it fails to import)
- `src/core/engine/crisisTree.ts` (new — the module that makes it pass)

#### Step 1 — Write the failing test file first

- [ ] Create `tests/crisisTree.test.ts` with the following exact content. It imports the not-yet-existing module (so the suite fails at import time first), authors a small Homeworld-shaped tree (`§6` strawman), and a `mkUnlock` helper that builds minimal `ProjectUnlock` literals (mirrors `tests/crisisflow.test.ts:70`):

```ts
import { describe, test, expect } from "bun:test";
import {
  availableNodes,
  applyBuild,
  isWon,
  type CrisisTree,
  type CrisisTreeState,
} from "../src/core/engine/crisisTree.ts";
import type { ProjectUnlock } from "../src/core/types.ts";
import type { PatternKind } from "../src/core/types.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";

// A small §6-Homeworld-shaped tree: root "settlement" gates three terminals.
const TREE: CrisisTree = {
  rootId: "settlement",
  nodes: {
    settlement: {
      id: "settlement",
      name: "Settlement",
      branch: "establish",
      requirements: [
        { pattern: "two-pair", count: 4 },
        { pattern: "high-card", count: 4 },
      ],
      unlocks: ["industry", "capital", "monument"],
      terminal: false,
    },
    industry: {
      id: "industry",
      name: "Industry",
      branch: "expansion",
      requirements: [{ pattern: "any", count: 8 }],
      unlocks: [],
      terminal: true,
    },
    capital: {
      id: "capital",
      name: "Capital",
      branch: "doctrine",
      requirements: [{ pattern: "any", count: 5 }],
      requireSameIdeology: true,
      unlocks: [],
      terminal: true,
    },
    monument: {
      id: "monument",
      name: "Monument",
      branch: "wonder",
      requirements: [
        { pattern: "straight", count: 1 },
        { pattern: "two-pair", count: 1 },
        { pattern: "flush", count: 1, upgrade: true },
      ],
      unlocks: [],
      terminal: true,
    },
  },
};

// Seed a fresh CrisisTreeState for TREE (zeroed progress sized per node).
function seed(activeNodeId: string | null = TREE.rootId): CrisisTreeState {
  const progress: Record<string, number[]> = {};
  for (const id of Object.keys(TREE.nodes)) {
    progress[id] = TREE.nodes[id].requirements.map(() => 0);
  }
  return { activeNodeId, cleared: [], progress, boundIdeology: {} };
}

// Minimal ProjectUnlock literal — applyBuild reads only pattern + promotedIdeology.
function mkUnlock(pattern: PatternKind, promotedIdeology: Ideology | null = null): ProjectUnlock {
  return { projectId: `p-${pattern}`, pattern, turn: 1, cards: [], promotedIdeology };
}

describe("availableNodes", () => {
  test("returns only the root initially", () => {
    const state = seed();
    expect(availableNodes(TREE, state).map((n) => n.id)).toEqual(["settlement"]);
  });

  test("exposes children once their parent is cleared, never a cleared node", () => {
    const state: CrisisTreeState = { ...seed(), cleared: ["settlement"] };
    const ids = availableNodes(TREE, state)
      .map((n) => n.id)
      .sort();
    expect(ids).toEqual(["capital", "industry", "monument"]);
    expect(ids).not.toContain("settlement");
  });

  test("a node whose parent is not cleared is not available", () => {
    const state = seed();
    expect(availableNodes(TREE, state).map((n) => n.id)).not.toContain("industry");
  });
});

describe("applyBuild — matching + advancement", () => {
  test("advances only the active node's matching requirements", () => {
    const state = seed("settlement");
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    // two-pair is requirement index 0; high-card index 1 untouched.
    expect(next.progress.settlement).toEqual([1, 0]);
  });

  test("a build matching no requirement of the active node is a no-op", () => {
    const state = seed("settlement");
    const next = applyBuild(TREE, state, mkUnlock("flush"), 1);
    expect(next.progress.settlement).toEqual([0, 0]);
    expect(next.cleared).toEqual([]);
  });

  test("pattern 'any' matches any pattern", () => {
    const state: CrisisTreeState = { ...seed("industry"), cleared: ["settlement"] };
    const next = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(next.progress.industry).toEqual([1]);
  });

  test("an active node only advances itself, not other available nodes", () => {
    const state: CrisisTreeState = { ...seed("industry"), cleared: ["settlement"] };
    // two-pair would match settlement's recipe, but settlement is cleared and
    // industry is active; industry's {any} matches, settlement is untouched.
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(next.progress.industry).toEqual([1]);
    expect(next.progress.settlement).toEqual([0, 0]);
  });

  test("activeNodeId === null is a no-op", () => {
    const state = seed(null);
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(next.progress.settlement).toEqual([0, 0]);
    expect(next.cleared).toEqual([]);
  });
});

describe("applyBuild — upgrade requirement", () => {
  test("upgrade:true requires projectBuildCount >= 2", () => {
    const state: CrisisTreeState = { ...seed("monument"), cleared: ["settlement"] };
    // monument req index 2 is { flush, count 1, upgrade }. First flush build
    // (count 1) does NOT advance it.
    const first = applyBuild(TREE, state, mkUnlock("flush"), 1);
    expect(first.progress.monument).toEqual([0, 0, 0]);
    // Second flush build of the same project id (count 2) DOES advance it.
    const second = applyBuild(TREE, first, mkUnlock("flush"), 2);
    expect(second.progress.monument).toEqual([0, 0, 1]);
  });
});

describe("applyBuild — requireSameIdeology binding", () => {
  test("only counts builds whose promotedIdeology === boundIdeology[node]", () => {
    const bound: Record<string, Ideology> = { capital: "solidarity" };
    const state: CrisisTreeState = {
      ...seed("capital"),
      cleared: ["settlement"],
      boundIdeology: bound,
    };
    // off-color build: does not count.
    const off = applyBuild(TREE, state, mkUnlock("pair", "heritage"), 1);
    expect(off.progress.capital).toEqual([0]);
    // on-color build: counts.
    const on = applyBuild(TREE, state, mkUnlock("pair", "solidarity"), 1);
    expect(on.progress.capital).toEqual([1]);
    // null promotion never counts toward a bound node.
    const none = applyBuild(TREE, state, mkUnlock("pair", null), 1);
    expect(none.progress.capital).toEqual([0]);
  });
});

describe("applyBuild — clearing + unlocks", () => {
  test("clears the node and appends its unlocks when all requirements hit count", () => {
    let state: CrisisTreeState = seed("settlement");
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(state.cleared).toEqual([]); // high-card req not yet met
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(state.cleared).toContain("settlement");
    // children are now available
    const ids = availableNodes(TREE, state)
      .map((n) => n.id)
      .sort();
    expect(ids).toEqual(["capital", "industry", "monument"]);
  });

  test("does not double-clear an already-cleared node", () => {
    let state: CrisisTreeState = seed("settlement");
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(state.cleared.filter((id) => id === "settlement")).toHaveLength(1);
    // a further matching build (active node still settlement) is a no-op on cleared
    const after = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(after.cleared.filter((id) => id === "settlement")).toHaveLength(1);
  });
});

describe("applyBuild — purity", () => {
  test("returns a new state and does not mutate the input", () => {
    const state = seed("settlement");
    const snapshotProgress = [...state.progress.settlement];
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(next).not.toBe(state);
    expect(next.progress).not.toBe(state.progress);
    expect(next.progress.settlement).not.toBe(state.progress.settlement);
    expect(next.cleared).not.toBe(state.cleared);
    // input untouched
    expect(state.progress.settlement).toEqual(snapshotProgress);
  });
});

describe("isWon", () => {
  test("false until a terminal node is cleared", () => {
    const state = seed();
    expect(isWon(TREE, state)).toBe(false);
    const rootCleared: CrisisTreeState = { ...state, cleared: ["settlement"] };
    expect(isWon(TREE, rootCleared)).toBe(false); // settlement is not terminal
  });

  test("true iff any cleared node is terminal", () => {
    const state: CrisisTreeState = { ...seed(), cleared: ["settlement", "industry"] };
    expect(isWon(TREE, state)).toBe(true);
  });
});
```

- [ ] Run the test to confirm it fails because the module does not exist yet:

```bash
bun test tests/crisisTree.test.ts
```

Expected output: a module-resolution failure, e.g. `error: Cannot find module '../src/core/engine/crisisTree.ts'` (0 tests run / error before tests execute). This confirms we are red for the right reason.

#### Step 2 — Create the module to make the test pass

- [ ] Create `src/core/engine/crisisTree.ts` with the spec §4 interfaces (imported `Ideology` + `PatternKind` as types) and the three pure functions:

```ts
// Crisis Tree — the phased, branching win condition (spec 2026-06-18).
// A Setting's Crisis is a DAG of objective nodes; each node is a recipe of
// built patterns. This module is pure: types + progress logic only. The Setting
// authors the tree; the Epoch carries CrisisTreeState; buildColumn drives it
// via applyBuild. Nothing here imports the layers above core/.

import type { Ideology } from "../data/ideologies.ts";
import type { PatternKind, ProjectUnlock } from "../data/projects.ts";

// A recipe entry: a build COUNT of a matching pattern. Counts builds, not value.
export interface ObjectiveRequirement {
  /** A specific rung, or "any" for volume nodes. */
  pattern: PatternKind | "any";
  /** How many matching builds the node needs. */
  count: number;
  /** Build must be an UPGRADE — the 2nd+ build of its project id this Epoch
   *  (Wonder "build twice"); satisfied when projectBuildCount >= 2. */
  upgrade?: boolean;
}

export interface ObjectiveNode {
  id: string;
  name: string;
  branch: "establish" | "expansion" | "doctrine" | "wonder";
  /** ALL requirements must be met to clear the node. */
  requirements: ObjectiveRequirement[];
  /** When activated the player BINDS a target ideology; requirements then only
   *  count builds promoted to that color (Doctrine). */
  requireSameIdeology?: boolean;
  /** Child node ids unlocked on clear. */
  unlocks: string[];
  /** Clearing it = a victory. */
  terminal: boolean;
  /** Bigger Legacy for deeper terminals (optional). */
  legacyTier?: number;
}

export interface CrisisTree {
  /** The single Establish gate. */
  rootId: string;
  nodes: Record<string, ObjectiveNode>;
}

export interface CrisisTreeState {
  /** The player's current focus; null = no objective selected. */
  activeNodeId: string | null;
  /** Cleared node ids. */
  cleared: string[];
  /** progress[nodeId][requirementIndex] = builds counted so far. */
  progress: Record<string, number[]>;
  /** Bound target color per activated requireSameIdeology (Doctrine) node. */
  boundIdeology: Record<string, Ideology>;
}

/** Unlocked (root, or any node all of whose parents are cleared) and not yet
 *  cleared. A node's parents are the nodes that list it in `unlocks`. */
export function availableNodes(tree: CrisisTree, state: CrisisTreeState): ObjectiveNode[] {
  const cleared = new Set(state.cleared);
  const out: ObjectiveNode[] = [];
  for (const node of Object.values(tree.nodes)) {
    if (cleared.has(node.id)) continue;
    if (node.id === tree.rootId) {
      out.push(node);
      continue;
    }
    const parents = Object.values(tree.nodes).filter((n) => n.unlocks.includes(node.id));
    if (parents.length > 0 && parents.every((p) => cleared.has(p.id))) out.push(node);
  }
  return out;
}

/** Does this build satisfy requirement `r` for `node`? Exactly the spec §4
 *  conjunction. */
function matchesRequirement(
  node: ObjectiveNode,
  r: ObjectiveRequirement,
  unlock: ProjectUnlock,
  projectBuildCount: number,
  boundIdeology: Ideology | undefined,
): boolean {
  const patternOk = r.pattern === "any" || unlock.pattern === r.pattern;
  const upgradeOk = !r.upgrade || projectBuildCount >= 2;
  const ideologyOk =
    !node.requireSameIdeology ||
    (unlock.promotedIdeology !== null && unlock.promotedIdeology === boundIdeology);
  return patternOk && upgradeOk && ideologyOk;
}

/** Advance the ACTIVE node by 1 for each requirement this build matches; clear
 *  the node + append its unlocks when every requirement reaches its count.
 *  Pure: returns a new CrisisTreeState, never mutates the input. */
export function applyBuild(
  tree: CrisisTree,
  state: CrisisTreeState,
  unlock: ProjectUnlock,
  projectBuildCount: number,
): CrisisTreeState {
  // Clone everything we might touch.
  const progress: Record<string, number[]> = {};
  for (const id of Object.keys(state.progress)) progress[id] = [...state.progress[id]];
  const next: CrisisTreeState = {
    activeNodeId: state.activeNodeId,
    cleared: [...state.cleared],
    progress,
    boundIdeology: { ...state.boundIdeology },
  };

  const activeId = next.activeNodeId;
  if (activeId === null) return next;
  if (next.cleared.includes(activeId)) return next;
  const node = tree.nodes[activeId];
  if (node === undefined) return next;

  const bound = next.boundIdeology[activeId];
  const nodeProgress = next.progress[activeId] ?? node.requirements.map(() => 0);
  next.progress[activeId] = nodeProgress;

  for (let i = 0; i < node.requirements.length; i++) {
    const r = node.requirements[i];
    if (nodeProgress[i] >= r.count) continue; // already satisfied
    if (matchesRequirement(node, r, unlock, projectBuildCount, bound)) {
      nodeProgress[i] += 1;
    }
  }

  const allMet = node.requirements.every((r, i) => nodeProgress[i] >= r.count);
  if (allMet && !next.cleared.includes(activeId)) {
    next.cleared.push(activeId);
    for (const childId of node.unlocks) {
      if (!next.cleared.includes(childId)) {
        // unlocks are exposed via availableNodes, not added to cleared; no-op
        // body kept intentionally minimal — children become available because
        // their parent is now in `cleared`.
      }
    }
  }

  return next;
}

/** True iff any cleared node is terminal. */
export function isWon(tree: CrisisTree, state: CrisisTreeState): boolean {
  return state.cleared.some((id) => tree.nodes[id]?.terminal === true);
}
```

Note: the spec phrase "append its `unlocks`" is realized by adding the **parent** to `cleared` (which `availableNodes` then keys off via the `unlocks` edge) — there is no separate "unlocked" list in `CrisisTreeState`. The empty loop above documents that intent; drop it if `oxlint` flags it (replace the `if (allMet ...)` block's body with just `next.cleared.push(activeId);`). Use the simpler form to avoid a lint warning:

```ts
  const allMet = node.requirements.every((r, i) => nodeProgress[i] >= r.count);
  if (allMet) next.cleared.push(activeId);
```

(We already early-return above when `activeId` is in `cleared`, so this push is never a duplicate.)

- [ ] Re-run the test and confirm green:

```bash
bun test tests/crisisTree.test.ts
```

Expected output: all describe blocks pass, e.g.

```
 14 pass
 0 fail
```

(14 = the test count in the file above; the exact number must be all-pass, 0 fail.)

#### Step 3 — Commit

- [ ] Confirm the whole suite is still green (the module is additive — no existing test imports it):

```bash
bun test tests && bun run typecheck
```

Expected: `bun test` reports `0 fail` across the whole suite; `bun run typecheck` (`tsc --noEmit`) prints nothing and exits 0.

- [ ] Commit:

```bash
git add src/core/engine/crisisTree.ts tests/crisisTree.test.ts
git commit -m "feat(core): pure crisisTree module — availableNodes/applyBuild/isWon

Add src/core/engine/crisisTree.ts: ObjectiveRequirement / ObjectiveNode /
CrisisTree / CrisisTreeState types + the pure progress fns availableNodes,
applyBuild (advance the active node's matching requirements; pattern/upgrade/
bound-ideology conjunction per spec §4; clear + expose children on full
recipe), isWon. Fully additive — driven by tests/crisisTree.test.ts.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Re-export the public crisisTree types from the `core/types.ts` barrel

**Files:**
- `src/core/types.ts` (add a `export type { … } from "./engine/crisisTree.ts"` block; insert near the other `engine/` re-exports, e.g. after the `TurnPhase` line at `src/core/types.ts:42`)

#### Step 1 — Add the re-export

- [ ] In `src/core/types.ts`, after the existing line:

```ts
export type { TurnPhase } from "./engine/turnPhase.ts";
```

add:

```ts
export type {
  CrisisTree,
  CrisisTreeState,
  ObjectiveNode,
  ObjectiveRequirement,
} from "./engine/crisisTree.ts";
```

This lets later phases (P2 `Setting`, P3 `Epoch`/`commands`, P5 facade) grab these via `core/types` like every other type, matching the convention in this barrel.

#### Step 2 — Verify nothing else broke and the barrel resolves

- [ ] Run typecheck and the full suite:

```bash
bun run typecheck && bun test tests
```

Expected: `tsc --noEmit` prints nothing and exits 0; `bun test` reports `0 fail` across the whole suite (the barrel addition is type-only and unused by any consumer yet, so behavior is unchanged).

- [ ] Sanity-check the barrel actually re-exports the new types (smoke import via tsc-only file is overkill; the typecheck above already proves resolution). Optionally confirm with a grep that the block is present:

```bash
grep -n "crisisTree" src/core/types.ts
```

Expected: one line referencing `from "./engine/crisisTree.ts"`.

#### Step 3 — Commit

- [ ] Commit:

```bash
git add src/core/types.ts
git commit -m "refactor(core): re-export crisisTree types from the types barrel

Surface CrisisTree, CrisisTreeState, ObjectiveNode, ObjectiveRequirement via
core/types.ts so the Setting/Epoch/facade layers in later phases import them
the same way as every other core type. Type-only; behavior unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

#### Phase exit criteria
- `src/core/engine/crisisTree.ts` exists with the four spec §4 interfaces and pure `availableNodes` / `applyBuild` / `isWon`.
- `tests/crisisTree.test.ts` is all-green and is the sole importer of the new module.
- The four public types are re-exported from `src/core/types.ts`.
- `bun run typecheck` and `bun test tests` are both green. No file outside the three listed in this phase was touched (P2 wires it into `Setting`; P3 into `Epoch`/`commands`/facade).

---

## Phase P2: Author per-Setting CrisisTree data + extend Setting type (keep difficulty)

> **Depends on P1** (`src/core/engine/crisisTree.ts` exists and exports `ObjectiveRequirement`, `ObjectiveNode`, `CrisisTree`, `CrisisTreeState` + the pure fns `availableNodes`/`applyBuild`/`isWon`; `src/core/types.ts` re-exports those four types). This phase is **purely additive**: it adds a `crisisTree: CrisisTree` field to `Setting`, authors the strawman tree per Setting, and adds data-integrity tests. **`crisis.difficulty` stays** — `resolveCrisis` (`src/core/engine/turn.ts:143`), the renderer (`ScoreMeter.vue`, `CrisisScreen.vue`), and the three sims keep reading it, so nothing breaks. The win-condition flip is P4; field removal is P5.
>
> **Verified anchors** (re-read before coding):
> - `Setting` interface: `src/core/settings/index.ts:25-40`; `SETTINGS` array exported at `:46`.
> - `PatternKind` union: `src/core/data/projects.ts:14-24` (exact strings: `"high-card" | "pair" | "two-pair" | "three-of-a-kind" | "straight" | "flush" | "full-house" | "four-of-a-kind" | "straight-flush" | "royal-flush"`).
> - `Ideology` union: `src/core/data/ideologies.ts:5` (`"solidarity" | "sovereignty" | "transformation" | "heritage"`).
> - `ObjectiveNode.branch` union (P1): `"establish" | "expansion" | "doctrine" | "wonder"` (spec §4).
> - Each Setting imports its types from `"../types.ts"` (the barrel) — homeworld.ts:3, generationShip.ts:3, ruinedHomeworld.ts:3 — so `CrisisTree` becomes available there via the P1 barrel re-export.
> - Generation Ship deck is 2-ideology (sovereignty + transformation) → trips / quads / full-house are mathematically impossible; only `high-card`/`pair`/`two-pair`/`straight`/`flush`/`straight-flush`/`royal-flush`/`any` are reachable (`generationShip.ts:16-29`).
> - Per-Setting clocks/columns: Homeworld 12 turns / 7 cols (`homeworld.ts:97-103`); Generation Ship 14 turns / 4 cols (`generationShip.ts:119-125`); Ruined Homeworld 16 turns / 5 cols (`ruinedHomeworld.ts:94-100`).

---

### Task 3: Add `crisisTree` to the `Setting` interface

Add the non-optional `crisisTree: CrisisTree` field to the `Setting` type. This is the type-change half of the phase; it must land with the three authored data objects (Tasks 2–4) and the integrity test (Task 5) in a single commit, because a non-optional field with no value would fail `tsc`. Author the data first conceptually, but the `tsc`-green state is only reached at the end of Task 4 — so this task's edits are interleaved with the next three and committed together at the end of Task 5.

**Files:**
- `src/core/settings/index.ts` (interface at :25-40, import block at :3-7)

- [ ] Add the `CrisisTree` type import. In `src/core/settings/index.ts`, the existing import (line 4) is:

  ```ts
  import type { Crisis, KeystoneProject } from "../data/projects.ts";
  ```

  Add a new type-only import for `CrisisTree` from the P1 module (import directly from `engine/crisisTree.ts`, mirroring how `ColumnConfig` is imported from `../engine/column.ts` at line 3):

  ```ts
  import type { ColumnConfig } from "../engine/column.ts";
  import type { Crisis, KeystoneProject } from "../data/projects.ts";
  import type { CrisisTree } from "../engine/crisisTree.ts";
  ```

- [ ] Add the field to the `Setting` interface. The current interface keeps `crisis: Crisis` (line 35). Add `crisisTree` immediately after it, keeping `crisis` in place:

  ```ts
  export interface Setting {
    id: string;
    name: string;
    description: string;
    flavorText: string;
    rules: SettingRules;
    startingDeck: string[];
    startingColumns: ColumnConfig[];
    /** Exactly one project per pattern (see PATTERNS_IN_ORDER in data/projects.ts). */
    projects: KeystoneProject[];
    /** Legacy scalar Crisis (id/name/flavor/difficulty). Win condition reads
     *  difficulty until P4; the scalar is retired in P5. */
    crisis: Crisis;
    /** The branching win-condition DAG. Authored per Setting (§6). */
    crisisTree: CrisisTree;
    transitions: {
      onWin: string | "campaign-end";
      onLoss: string | "campaign-end";
    };
  }
  ```

- [ ] **Do not run `typecheck` yet** — the three Settings now fail to satisfy `Setting` (missing `crisisTree`). They are filled in Tasks 2–4; green is reached at the end of Task 4. (Authoring the data first, then the type, would also work; the order here keeps the type contract visible up top.)

- [ ] Also re-export `CrisisTree` from the barrel for consumers that prefer `../types.ts` (P1 already added this; verify it's present so the Settings can keep importing types from the barrel as they do today):

  ```bash
  grep -n "CrisisTree" src/core/types.ts
  ```

  Expected output (P1's re-export — confirm the four names are there):

  ```
  export type {
    CrisisTree,
    CrisisTreeState,
    ObjectiveNode,
    ObjectiveRequirement,
  } from "./engine/crisisTree.ts";
  ```

  If the barrel does not yet list `CrisisTree`, P1 is incomplete — stop and resolve P1 first (this phase depends on it).

---

### Task 4: Author `HOMEWORLD.crisisTree` (§6 strawman)

Author the Homeworld tree exactly per spec §6: a root `establish` node (`settlement`) requiring `[{two-pair, 4}, {high-card, 4}]`, unlocking three terminal branch nodes — `industry` (expansion), `capital` (doctrine, `requireSameIdeology`), `monument` (wonder). Counts are strawman values per the spec; balance tuning is downstream (P4 sims, spec §8).

**Files:**
- `src/core/settings/homeworld.ts` (CRISIS at :82-87; `HOMEWORLD` object at :91-112)

- [ ] Add the `CrisisTree` type import. The current import (line 3) is:

  ```ts
  import type { Setting, KeystoneProject, Crisis, ColumnConfig } from "../types.ts";
  ```

  Add `CrisisTree` to it:

  ```ts
  import type { Setting, KeystoneProject, Crisis, ColumnConfig, CrisisTree } from "../types.ts";
  ```

- [ ] Add the `CRISIS_TREE` constant immediately after the existing `CRISIS` constant (after line 87, before `STARTING_COLUMNS`):

  ```ts
  // Crisis Tree (§6 Homeworld strawman, 12 turns / 7 columns). The root
  // demands a spread of basic infrastructure (two-pair + high-card), then forks
  // into three terminal victory branches. Counts are balance-pending strawman.
  const CRISIS_TREE: CrisisTree = {
    rootId: "settlement",
    nodes: {
      settlement: {
        id: "settlement",
        name: "Settlement",
        branch: "establish",
        requirements: [
          { pattern: "two-pair", count: 4 },
          { pattern: "high-card", count: 4 },
        ],
        unlocks: ["industry", "capital", "monument"],
        terminal: false,
      },
      industry: {
        id: "industry",
        name: "Industry",
        branch: "expansion",
        requirements: [{ pattern: "any", count: 8 }],
        unlocks: [],
        terminal: true,
      },
      capital: {
        id: "capital",
        name: "Capital",
        branch: "doctrine",
        requireSameIdeology: true,
        requirements: [{ pattern: "any", count: 5 }],
        unlocks: [],
        terminal: true,
      },
      monument: {
        id: "monument",
        name: "Monument",
        branch: "wonder",
        requirements: [
          { pattern: "straight", count: 1 },
          { pattern: "two-pair", count: 1 },
          { pattern: "flush", count: 1, upgrade: true },
        ],
        unlocks: [],
        terminal: true,
      },
    },
  };
  ```

- [ ] Wire it into the `HOMEWORLD` object. Add `crisisTree: CRISIS_TREE,` immediately after the existing `crisis: CRISIS,` line (currently line 107):

  ```ts
    projects: PROJECTS,
    crisis: CRISIS,
    crisisTree: CRISIS_TREE,
    transitions: {
      onWin: "generation-ship",
      onLoss: "ruined-homeworld",
    },
  ```

---

### Task 5: Author `GENERATION_SHIP.crisisTree` (2-ideology deck, 14 turns / 4 columns)

The Ship's 2-ideology deck makes trips / quads / full-house impossible, so its recipes use only `high-card`/`pair`/`two-pair`/`straight`/`flush`/`any`. With only 4 columns and 14 turns, the spread root is tight; the Doctrine branch is the Ship's natural identity (monoculture pull from the constrained deck), so it gets the cheapest terminal. One `establish` root unlocks the three branch terminals.

**Files:**
- `src/core/settings/generationShip.ts` (CRISIS at :107-112; `GENERATION_SHIP` object at :114-134)

- [ ] Add the `CrisisTree` type import. The current import (line 3) is:

  ```ts
  import type { Setting, KeystoneProject, Crisis } from "../types.ts";
  ```

  Add `CrisisTree`:

  ```ts
  import type { Setting, KeystoneProject, Crisis, CrisisTree } from "../types.ts";
  ```

- [ ] Add the `CRISIS_TREE` constant immediately after the existing `CRISIS` constant (after line 112, before the `GENERATION_SHIP` object):

  ```ts
  // Crisis Tree (Generation Ship, 14 turns / 4 columns, 2-ideology deck).
  // Trips/quads/full-house are impossible here, so recipes stay on
  // high-card/pair/two-pair/straight/flush/any. The constrained deck makes
  // monoculture the path of least resistance, so Doctrine (Mission) is the
  // cheapest terminal; the tall Expansion branch is harder with only 4 columns.
  // Counts are balance-pending strawman.
  const CRISIS_TREE: CrisisTree = {
    rootId: "shakedown",
    nodes: {
      shakedown: {
        id: "shakedown",
        name: "Shakedown",
        branch: "establish",
        requirements: [
          { pattern: "pair", count: 3 },
          { pattern: "high-card", count: 3 },
        ],
        unlocks: ["fleet", "mission", "beacon"],
        terminal: false,
      },
      fleet: {
        id: "fleet",
        name: "Fleet Standard",
        branch: "expansion",
        requirements: [{ pattern: "any", count: 6 }],
        unlocks: [],
        terminal: true,
      },
      mission: {
        id: "mission",
        name: "Mission",
        branch: "doctrine",
        requireSameIdeology: true,
        requirements: [{ pattern: "any", count: 3 }],
        unlocks: [],
        terminal: true,
      },
      beacon: {
        id: "beacon",
        name: "Beacon",
        branch: "wonder",
        requirements: [
          { pattern: "straight", count: 1 },
          { pattern: "flush", count: 1, upgrade: true },
        ],
        unlocks: [],
        terminal: true,
      },
    },
  };
  ```

- [ ] Wire it into the `GENERATION_SHIP` object. Add `crisisTree: CRISIS_TREE,` immediately after `crisis: CRISIS,` (currently line 129):

  ```ts
    projects: PROJECTS,
    crisis: CRISIS,
    crisisTree: CRISIS_TREE,
    transitions: {
      onWin: "campaign-end",
      onLoss: "campaign-end",
    },
  ```

---

### Task 6: Author `RUINED_HOMEWORLD.crisisTree` (16 turns / 5 columns)

Ruined Homeworld has the longest clock (16 turns) and a full-ideology deck (so all patterns reachable). With 5 columns and a longer budget the spread root is achievable but the terminals can be slightly heavier than Homeworld. One `establish` root unlocks three terminal branches. Reaching `tsc`-green is completed by the end of this task (all three Settings now satisfy `Setting`).

**Files:**
- `src/core/settings/ruinedHomeworld.ts` (CRISIS at :82-87; `RUINED_HOMEWORLD` object at :89-109)

- [ ] Add the `CrisisTree` type import. The current import (line 3) is:

  ```ts
  import type { Setting, KeystoneProject, Crisis } from "../types.ts";
  ```

  Add `CrisisTree`:

  ```ts
  import type { Setting, KeystoneProject, Crisis, CrisisTree } from "../types.ts";
  ```

- [ ] Add the `CRISIS_TREE` constant immediately after the existing `CRISIS` constant (after line 87, before the `RUINED_HOMEWORLD` object):

  ```ts
  // Crisis Tree (Ruined Homeworld, 16 turns / 5 columns, full deck). The
  // longest clock and the full ideology spread make every pattern reachable, so
  // the root demands a wider re-founding spread and the terminals are a touch
  // heavier than Homeworld. Counts are balance-pending strawman.
  const CRISIS_TREE: CrisisTree = {
    rootId: "refounding",
    nodes: {
      refounding: {
        id: "refounding",
        name: "Re-founding",
        branch: "establish",
        requirements: [
          { pattern: "two-pair", count: 4 },
          { pattern: "pair", count: 4 },
          { pattern: "high-card", count: 4 },
        ],
        unlocks: ["reclamation", "creed", "spire"],
        terminal: false,
      },
      reclamation: {
        id: "reclamation",
        name: "Reclamation",
        branch: "expansion",
        requirements: [{ pattern: "any", count: 10 }],
        unlocks: [],
        terminal: true,
      },
      creed: {
        id: "creed",
        name: "Creed",
        branch: "doctrine",
        requireSameIdeology: true,
        requirements: [{ pattern: "any", count: 6 }],
        unlocks: [],
        terminal: true,
      },
      spire: {
        id: "spire",
        name: "Spire",
        branch: "wonder",
        requirements: [
          { pattern: "straight", count: 1 },
          { pattern: "two-pair", count: 2 },
          { pattern: "flush", count: 1, upgrade: true },
        ],
        unlocks: [],
        terminal: true,
      },
    },
  };
  ```

- [ ] Wire it into the `RUINED_HOMEWORLD` object. Add `crisisTree: CRISIS_TREE,` immediately after `crisis: CRISIS,` (currently line 104):

  ```ts
    projects: PROJECTS,
    crisis: CRISIS,
    crisisTree: CRISIS_TREE,
    transitions: {
      onWin: "campaign-end",
      onLoss: "campaign-end",
    },
  ```

- [ ] Run `typecheck` now that all three Settings satisfy the extended `Setting` interface:

  ```bash
  bun run typecheck
  ```

  Expected output: no errors (exit code 0). `tsc --noEmit` prints nothing on success. If it reports a missing-property error on a Setting, the `crisisTree` field is missing or misspelled in that file; if it reports an unknown property in a node literal, re-check the literal against the P1 `ObjectiveNode`/`ObjectiveRequirement` shapes (e.g. `requireSameIdeology` is the exact key, `upgrade` is the exact key).

---

### Task 7: Data-integrity tests over `SETTINGS`, then commit the phase

Extend the existing P1 `tests/crisisTree.test.ts` with a `describe` block that validates every authored tree against the shape contract: rootId resolves, every `unlocks` id resolves, exactly one `establish` root, at least one terminal reachable from the root, and `requireSameIdeology` nodes use only count-bearing requirements (no `upgrade`-only recipes, which can't be satisfied by a single-ideology `any` count). This is the TDD net that catches authoring typos in node ids and dangling edges across all three Settings.

**Files:**
- `tests/crisisTree.test.ts` (append a new `describe` block; P1 created the file)

- [ ] **Write the failing test first.** Append this block to `tests/crisisTree.test.ts`. (If P1's file already imports `describe`/`expect`/`it` from `"bun:test"`, do not duplicate the import — add only the new `import { SETTINGS }` line and the `describe` block.)

  ```ts
  import { describe, expect, it } from "bun:test";
  import { SETTINGS } from "../src/core/settings/index.ts";
  import type { CrisisTree } from "../src/core/types.ts";

  /** Walk the DAG from the root, collecting every reachable node id. */
  function reachableFrom(tree: CrisisTree): Set<string> {
    const seen = new Set<string>();
    const stack = [tree.rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = tree.nodes[id];
      if (node) stack.push(...node.unlocks);
    }
    return seen;
  }

  describe("authored Setting crisisTrees", () => {
    for (const setting of SETTINGS) {
      const tree = setting.crisisTree;

      describe(setting.id, () => {
        it("has a rootId that resolves to a node", () => {
          expect(tree.nodes[tree.rootId]).toBeDefined();
        });

        it("has exactly one establish-branch root and it is the rootId", () => {
          const establishNodes = Object.values(tree.nodes).filter(
            (n) => n.branch === "establish",
          );
          expect(establishNodes).toHaveLength(1);
          expect(establishNodes[0]!.id).toBe(tree.rootId);
        });

        it("has every unlocks id resolve to a node in nodes", () => {
          for (const node of Object.values(tree.nodes)) {
            for (const childId of node.unlocks) {
              expect(tree.nodes[childId]).toBeDefined();
            }
          }
        });

        it("declares each node's own id consistently with its key", () => {
          for (const [key, node] of Object.entries(tree.nodes)) {
            expect(node.id).toBe(key);
          }
        });

        it("has at least one terminal node reachable from the root", () => {
          const reachable = reachableFrom(tree);
          const reachableTerminals = [...reachable].filter((id) => tree.nodes[id]?.terminal);
          expect(reachableTerminals.length).toBeGreaterThan(0);
        });

        it("gives every node at least one count-bearing requirement", () => {
          for (const node of Object.values(tree.nodes)) {
            expect(node.requirements.length).toBeGreaterThan(0);
            for (const req of node.requirements) {
              expect(req.count).toBeGreaterThan(0);
            }
          }
        });

        it("uses only count-bearing (non-upgrade-only) reqs on requireSameIdeology nodes", () => {
          for (const node of Object.values(tree.nodes)) {
            if (!node.requireSameIdeology) continue;
            // A Doctrine node binds a single ideology and counts builds of that
            // color; an upgrade-only requirement can't be expressed as a simple
            // per-ideology count, so forbid `upgrade` on these nodes.
            for (const req of node.requirements) {
              expect(req.upgrade ?? false).toBe(false);
            }
          }
        });
      });
    }
  });
  ```

- [ ] Run the new test (it exercises authored data — it will pass once Tasks 2–4 are in place; running it now confirms the data is well-formed):

  ```bash
  bun test tests/crisisTree.test.ts
  ```

  Expected output: all tests pass — the P1 unit tests plus the new `authored Setting crisisTrees` block, with one nested `describe` per Setting (`homeworld`, `generation-ship`, `ruined-homeworld`). Final line resembles:

  ```
   N pass
   0 fail
  ```

  If `has exactly one establish-branch root` fails for a Setting, two nodes share `branch: "establish"` or the root's branch isn't `"establish"`. If `has every unlocks id resolve` fails, a node's `unlocks` references a misspelled child id. If `declares each node's own id consistently` fails, a node literal's `id` doesn't match its key in `nodes`.

- [ ] Run the full suite + typecheck to confirm the phase is green end-to-end (every existing test still passes — this phase is additive and `crisis.difficulty` is untouched):

  ```bash
  bun run typecheck && bun test
  ```

  Expected output: `tsc` prints nothing (exit 0); `bun test` reports `0 fail` across the whole suite.

- [ ] Commit the phase. All five tasks (the `Setting` field + three authored trees + the integrity tests) land in one commit so the non-optional field never exists without its three values:

  ```bash
  git add src/core/settings/index.ts src/core/settings/homeworld.ts src/core/settings/generationShip.ts src/core/settings/ruinedHomeworld.ts tests/crisisTree.test.ts
  git commit -m "feat(core): author per-Setting CrisisTree data + add crisisTree to Setting type

Add the §6 strawman Crisis Tree (establish root forking into expansion/
doctrine/wonder terminals) to all three Settings and a non-optional
crisisTree field on Setting. Additive: crisis.difficulty stays, so
resolveCrisis/sims/renderer still compile. Data-integrity tests over
SETTINGS guard rootId/unlocks/terminal reachability per tree.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

  The pre-commit hook (lefthook) runs `oxlint --fix` + `prettier --write` on the staged files and `tsc --noEmit` over the project; expect it to pass since `typecheck` and `bun test` were green above. If prettier reformats the new literals, re-stage and re-run the commit.

---

**Phase exit criteria:** `Setting` has a non-optional `crisisTree: CrisisTree`; all three Settings carry an authored `establish`-rooted tree with three terminal branches; `crisis.difficulty` is unchanged and still read by every existing consumer; `bun run typecheck` and `bun test` are both green; the integrity tests in `tests/crisisTree.test.ts` cover all of `SETTINGS`. P3 builds on this by seeding `CrisisTreeState` on the `Epoch` from `setting.crisisTree` and wiring `applyBuild`.

---

## Phase P3 — Seed crisisTree on Epoch + setActiveObjective command + buildColumn hook + facade passthrough

**Atomic phase.** Adding the non-optional `crisisTree: CrisisTreeState` field to the `Epoch` interface breaks every hand-built `Epoch` literal in the test suite at `tsc` time. The type change, the `createEpoch` seeding, the `setActiveObjective` command, the `buildColumn` hook, the facade passthrough, the fixtures helper, **and every test-file Epoch-literal patch** therefore all land in **one commit**. The win condition is still `total >= setting.crisis.difficulty` here — P3 is additive state plumbing, so behavior is unchanged and the whole suite stays green.

**Prerequisite from P1/P2 (already committed before this phase runs):**
- `src/core/engine/crisisTree.ts` exports types `ObjectiveRequirement`, `ObjectiveNode`, `CrisisTree`, `CrisisTreeState` and pure fns `availableNodes(tree, state)`, `applyBuild(tree, state, unlock, projectBuildCount)`, `isWon(tree, state)`. These are re-exported from `src/core/types.ts`.
- `Setting` (in `src/core/settings/index.ts`) has a non-optional `crisisTree: CrisisTree`, and all three Settings author it. Homeworld's tree: root `settlement` (establish, reqs `[{two-pair,4},{high-card,4}]`) unlocking three terminals — `industry` (expansion, `[{any,8}]`), `capital` (doctrine, `requireSameIdeology`, `[{any,5}]`), `monument` (wonder, `[{straight,1},{two-pair,1},{flush,1,upgrade}]`).

> P3 tests must NOT hardcode P2's exact node-id strings beyond the spec's `settlement`/`capital` examples; where possible derive ids from `setting.crisisTree.rootId`, `availableNodes(...)`, and a node's `requireSameIdeology` flag, so the tests survive any id-naming the P2 authoring chose.

---

### Task 8: Seed crisisTree on Epoch + setActiveObjective command + buildColumn hook + facade passthrough (single atomic commit)

**Files:**
- `src/core/engine/epoch.ts` — add `crisisTree: CrisisTreeState` to the `Epoch` interface (after `policy`, ~line 47); add `seedCrisisTreeState(tree)` helper; call it in `createEpoch` (~line 110-127).
- `src/core/engine/commands.ts` — add `setActiveObjective(epoch, setting, nodeId, ideology?)` (after `requirePolicyResolution`, ~line 50; import `availableNodes`/`applyBuild`); wire `applyBuild` into `buildColumn`'s success path (~line 228).
- `src/facade/GameAPI.ts` — import `setActiveObjective` core fn + `availableNodes` + the `CrisisTreeState`/`ObjectiveNode` types; extend `snapshot()` to deep-clone `crisisTree` + expose `availableNodes` (~line 207-257); add `setActiveObjective` passthrough + `availableNodes()` query.
- `tests/fixtures.ts` — add `emptyCrisisTreeState()` helper (~after `emptyPolicyState`, line 20).
- `tests/crisisflow.test.ts` — patch `epochWithUnlocks` literal (~line 44-63) with `crisisTree`.
- `tests/policyCommands.test.ts` — patch `makeEpoch` literal (~line 66-88) with `crisisTree`.
- `tests/dispatch.test.ts` — patch `freshEpoch` literal (~line 12-30) with `crisisTree`.
- `tests/effectiveRules.test.ts` — patch `makeEpoch` literal (~line 39-55) with `crisisTree`.
- `tests/effectiveRules-routing.test.ts` — patch `epochWith` literal (~line 29-45) with `crisisTree`.
- `tests/storage.test.ts` — patch `freshEpoch` literal (~line 19-35) with `crisisTree`.
- `tests/crisisTree.test.ts` — append P3 integration tests (createEpoch seeding, setActiveObjective gating/binding, buildColumn advancing progress).

---

#### Step-by-step

- [ ] **Write the failing P3 tests first (TDD).** Append a new `describe` block to `tests/crisisTree.test.ts`. These exercise the seeding, the command, and the build hook against the real Homeworld tree + a real GameAPI. They will not compile yet (`crisisTree` not on `Epoch`, `setActiveObjective`/`availableNodes` don't exist):

```ts
import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";
import { createEpoch } from "../src/core/engine/epoch.ts";
import { setActiveObjective, buildColumn } from "../src/core/engine/commands.ts";
import { availableNodes } from "../src/core/engine/crisisTree.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { getCard, landId } from "../src/core/data/cards.ts";

describe("crisisTree — Epoch seeding (P3)", () => {
  test("createEpoch seeds activeNodeId=rootId, empty cleared, zeroed progress per req", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(1), 1);
    const tree = setting.crisisTree;
    expect(ep.crisisTree.activeNodeId).toBe(tree.rootId);
    expect(ep.crisisTree.cleared).toEqual([]);
    expect(ep.crisisTree.boundIdeology).toEqual({});
    // progress has one zero-filled array per node, sized to its requirements.
    for (const [id, node] of Object.entries(tree.nodes)) {
      expect(ep.crisisTree.progress[id]).toEqual(node.requirements.map(() => 0));
    }
  });
});

describe("setActiveObjective (P3)", () => {
  test("rejects a node that is not currently available", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(1), 1);
    const tree = setting.crisisTree;
    // A child of the (uncleared) root is locked: not in availableNodes yet.
    const lockedChild = tree.nodes[tree.rootId].unlocks[0];
    const r = setActiveObjective(ep, setting, lockedChild);
    expect(r.ok).toBe(false);
    // The root itself is available.
    const ok = setActiveObjective(ep, setting, tree.rootId);
    expect(ok.ok).toBe(true);
    expect(ep.crisisTree.activeNodeId).toBe(tree.rootId);
  });

  test("a requireSameIdeology (Doctrine) node binds its ideology on activation", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(1), 1);
    const tree = setting.crisisTree;
    // Force the doctrine child into the available set by marking the root cleared.
    ep.crisisTree.cleared = [tree.rootId];
    const doctrineId = availableNodes(tree, ep.crisisTree).find(
      (n) => tree.nodes[n].requireSameIdeology === true,
    );
    if (!doctrineId) throw new Error("expected a requireSameIdeology node");
    // Missing ideology is rejected; supplying one binds it.
    const bad = setActiveObjective(ep, setting, doctrineId);
    expect(bad.ok).toBe(false);
    const good = setActiveObjective(ep, setting, doctrineId, "solidarity");
    expect(good.ok).toBe(true);
    expect(ep.crisisTree.activeNodeId).toBe(doctrineId);
    expect(ep.crisisTree.boundIdeology[doctrineId]).toBe("solidarity");
  });
});

describe("buildColumn advances the active node (P3)", () => {
  // Build a two-pair (the root recipe's first requirement) directly in column 0,
  // set the root active, build, and assert the matching requirement advanced.
  test("a build matching the active root recipe advances its progress via snapshot", () => {
    const api = new GameAPI(99, { skipLoad: true, forceSettingId: "homeworld" });
    // Seed a buildable two-pair column by hand-placing through the core epoch:
    // place a pair of one rank in the land row + a pair of another rank in the
    // influence row (the cheapest two-pair the evaluator recognizes).
    // We reach into core state directly because this test targets the tree hook,
    // not the placement UX.
    const ep = (api as unknown as { epoch: ReturnType<typeof createEpoch> }).epoch;
    const setting = (api as unknown as { setting: ReturnType<typeof getSetting> }).setting;
    const rng = (api as unknown as { rng: ReturnType<typeof createRng> }).rng;
    ep.crisisTree.activeNodeId = setting.crisisTree.rootId;
    const col = ep.columns[0];
    col.lands.cards.push(getCard(landId(7, "solidarity")), getCard(landId(7, "solidarity")));
    col.influence.cards.push(getCard(landId(9, "heritage")), getCard(landId(9, "heritage")));
    const before = [...ep.crisisTree.progress[setting.crisisTree.rootId]];
    const r = buildColumn(ep, setting, 0, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pattern).toBe("two-pair");
    const after = ep.crisisTree.progress[setting.crisisTree.rootId];
    // The two-pair requirement index advanced by exactly 1; total progress rose.
    const advanced = after.reduce((s, n) => s + n, 0) - before.reduce((s, n) => s + n, 0);
    expect(advanced).toBe(1);
  });
});
```

> Note on the two-pair seed: a land-row pair (rank 7) + an influence-row pair (rank 9) is the canonical two-pair the evaluator returns (see `columnPatterns.ts` "pair in each row → two-pair"). If P2 named the root's first requirement a different pattern, the build-hook test still asserts "the active node advanced by 1", which holds for whatever pattern the column resolves to **only if** the root recipe includes that pattern — keep the seeded column a two-pair to match the §6 strawman root.

- [ ] **Run the tests to confirm they fail to compile (red).**

```
bun test tests/crisisTree.test.ts
```

Expected: a TypeScript / module error — `Property 'crisisTree' does not exist on type 'Epoch'` and/or `Module '"../src/core/engine/commands.ts"' has no exported member 'setActiveObjective'`. Do not proceed until you see these.

- [ ] **Add `crisisTree` to the `Epoch` interface + the `seedCrisisTreeState` helper** in `src/core/engine/epoch.ts`. First import the type (the file already imports from `./crisisTree.ts`'s neighbors; add it):

```ts
import type { CrisisTree, CrisisTreeState } from "./crisisTree.ts";
```

Add the field to the `Epoch` interface, immediately after `policy: PolicyState;`:

```ts
  policy: PolicyState;
  /** Per-Epoch Crisis Tree progress: active objective, cleared nodes, per-node
   *  per-requirement build counts, and bound ideology for activated Doctrine
   *  nodes. Seeded by createEpoch from setting.crisisTree. */
  crisisTree: CrisisTreeState;
```

Add the seeding helper (place it just above `createEpoch`, after `createPolicyState`):

```ts
/** Fresh Crisis Tree progress for a new Epoch: the root is the active objective,
 *  nothing is cleared, every node's per-requirement progress is zero-filled, no
 *  Doctrine ideology bound yet. */
export function seedCrisisTreeState(tree: CrisisTree): CrisisTreeState {
  const progress: Record<string, number[]> = {};
  for (const [id, node] of Object.entries(tree.nodes)) {
    progress[id] = node.requirements.map(() => 0);
  }
  return {
    activeNodeId: tree.rootId,
    cleared: [],
    progress,
    boundIdeology: {},
  };
}
```

Wire it into the `createEpoch` literal (it already has `setting` in scope), adding the field after `policy: createPolicyState(rng),`:

```ts
    policy: createPolicyState(rng),
    crisisTree: seedCrisisTreeState(setting.crisisTree),
  };
```

- [ ] **Re-export `seedCrisisTreeState`** from the barrel is not needed (it's only used by `epoch.ts` + fixtures import it directly from `epoch.ts`). Confirm `CrisisTreeState` is already re-exported from `src/core/types.ts` (added in P1). If it is not in the barrel yet, add to the P1 re-export block in `types.ts`:

```ts
export type {
  CrisisTree,
  CrisisTreeState,
  ObjectiveNode,
  ObjectiveRequirement,
} from "./engine/crisisTree.ts";
```

(Skip this if P1 already added it — verify with `grep -n "crisisTree" src/core/types.ts` before editing.)

- [ ] **Add the `setActiveObjective` command** to `src/core/engine/commands.ts`. First extend the imports at the top — add `availableNodes` and `applyBuild`:

```ts
import { availableNodes, applyBuild } from "./crisisTree.ts";
```

Add the command right after `requirePolicyResolution` (~line 50). It reuses the existing `requirePlayable` gate so an objective can only be chosen during the play sub-phase:

```ts
/**
 * Set the player's active Crisis-Tree objective. The node must currently be
 * available (root, or a node all of whose parents are cleared, and not itself
 * cleared). A `requireSameIdeology` (Doctrine) node additionally REQUIRES an
 * `ideology` argument, which is recorded as the bound target color for that
 * node — its requirements then only count builds promoted to that color.
 * Switching is free and retains per-node progress + prior bindings.
 */
export function setActiveObjective(
  epoch: Epoch,
  setting: Setting,
  nodeId: string,
  ideology?: Ideology,
): CmdResult<void> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const tree = setting.crisisTree;
  if (!availableNodes(tree, epoch.crisisTree).includes(nodeId)) {
    return { ok: false, error: "Objective not available." };
  }
  const node = tree.nodes[nodeId];
  if (node.requireSameIdeology) {
    if (!ideology) return { ok: false, error: "Choose an ideology to bind." };
    epoch.crisisTree.boundIdeology[nodeId] = ideology;
  }
  epoch.crisisTree.activeNodeId = nodeId;
  return { ok: true, value: undefined };
}
```

- [ ] **Wire `applyBuild` into `buildColumn`'s success path** in `src/core/engine/commands.ts`. The `dispatch(column-built)` call at line 228 pushes the unlock into `epoch.unlockedProjects` (confirmed in `dispatch.ts:53`), so the inclusive build count is available immediately after. Replace the tail of `buildColumn`:

```ts
  dispatch(epoch, { type: "column-built", columnIndex, unlock }, rng);
  return { ok: true, value: unlock };
```

with:

```ts
  dispatch(epoch, { type: "column-built", columnIndex, unlock }, rng);
  // Advance the active Crisis-Tree objective. projectBuildCount is INCLUSIVE of
  // this build (the dispatch above already pushed `unlock` onto unlockedProjects),
  // so the upgrade predicate (>= 2) fires on the second build of a project id.
  const projectBuildCount = epoch.unlockedProjects.filter(
    (u) => u.projectId === unlock.projectId,
  ).length;
  epoch.crisisTree = applyBuild(setting.crisisTree, epoch.crisisTree, unlock, projectBuildCount);
  return { ok: true, value: unlock };
```

> `buildColumn`'s return value is unchanged (still `CmdResult<ProjectUnlock>`), so the facade signature and all existing callers are unaffected.

- [ ] **Add the `emptyCrisisTreeState` fixtures helper** to `tests/fixtures.ts`. It produces a benign, minimal-but-valid `CrisisTreeState` for hand-built Epoch literals that never exercise the tree (dispatch/effectiveRules/storage tests) — `activeNodeId: null` is the documented no-active-node case, so `applyBuild` against it is a no-op and these tests stay behavior-identical. Add the import and the helper:

```ts
import type { CrisisTreeState, PolicyState } from "../src/core/types.ts";
```

(merge with the existing `PolicyState` import line), then after `emptyPolicyState`:

```ts
/** A no-active-node, nothing-cleared, no-progress CrisisTreeState for hand-built
 *  Epoch literals that don't exercise the Crisis Tree. activeNodeId === null is
 *  the documented no-op state: applyBuild against it changes nothing. Tests that
 *  DO drive the tree seed real state via createEpoch / seedCrisisTreeState. */
export function emptyCrisisTreeState(): CrisisTreeState {
  return { activeNodeId: null, cleared: [], progress: {}, boundIdeology: {} };
}
```

- [ ] **Patch every hand-built Epoch literal** to include `crisisTree`. In each of the six factories, add the field immediately after the `policy:` line. Each file already imports from `./fixtures.ts`; extend that import to include `emptyCrisisTreeState`.

  `tests/dispatch.test.ts` — `freshEpoch` (~line 28):
```ts
    policy: emptyPolicyState(),
    crisisTree: emptyCrisisTreeState(),
  };
```
  and update the import:
```ts
import { emptyPolicyState, emptyCrisisTreeState } from "./fixtures.ts";
```

  `tests/storage.test.ts` — `freshEpoch` (~line 34): same two edits (add `crisisTree: emptyCrisisTreeState(),` after `policy: emptyPolicyState(),`; extend the fixtures import).

  `tests/effectiveRules.test.ts` — `makeEpoch` (~line 54): add after `policy: { ...emptyPolicyState(), tableau },`:
```ts
    policy: { ...emptyPolicyState(), tableau },
    crisisTree: emptyCrisisTreeState(),
  };
```
  and extend its fixtures import to include `emptyCrisisTreeState`.

  `tests/effectiveRules-routing.test.ts` — `epochWith` (~line 44): same pattern (add `crisisTree: emptyCrisisTreeState(),` after the `policy:` line; extend the import).

  `tests/policyCommands.test.ts` — `makeEpoch` (~line 82-87): add after the `policy: { ...base, tableau, candidates }` block:
```ts
    policy: {
      ...base,
      tableau: opts.tableau ?? [],
      candidates: opts.candidates ?? [],
    },
    crisisTree: emptyCrisisTreeState(),
  };
```
  and extend its fixtures import (`import { emptyPolicyState, emptyCrisisTreeState } from "./fixtures.ts";`).

  `tests/crisisflow.test.ts` — `epochWithUnlocks` (~line 61): add after `policy: emptyPolicyState(),`:
```ts
    policy: emptyPolicyState(),
    crisisTree: emptyCrisisTreeState(),
  };
```
  and extend the fixtures import (`import { emptyPolicyState, emptyCrisisTreeState } from "./fixtures.ts";`).

- [ ] **Add the facade passthrough + queries** in `src/facade/GameAPI.ts`. Import the core command and helper + the types. Extend the core-commands import block (it already imports from `commands.ts`):

```ts
  removePolicy as removePolicyCore,
  setActiveObjective as setActiveObjectiveCore,
  storeCard as storeCardCore,
```

Add an import for `availableNodes` from core engine:

```ts
import { availableNodes as availableNodesCore } from "../core/engine/crisisTree.ts";
```

Extend the `../core/types.ts` type import to bring in `CrisisTreeState` and `ObjectiveNode`:

```ts
  CrisisTreeState,
  ...
  ObjectiveNode,
```

(add these to the existing `import type { ... } from "../core/types.ts";` block).

Extend the `Snapshot` interface with the cloned tree state + available node ids:

```ts
  influence: Record<Ideology, number>; // majority-counter tally per ideology
  crisisTree: CrisisTreeState; // deep-cloned Crisis Tree progress
  availableNodes: string[]; // node ids the player may set active right now
```

In `snapshot()`, deep-clone `crisisTree` so `shallowRef` sees fresh references — add a private cloner and use it. Add the cloner method near `clonePolicy`:

```ts
  /** Deep-clone the Crisis Tree progress so shallowRef sees fresh references
   *  (same discipline as clonePolicy). */
  private cloneCrisisTree(): CrisisTreeState {
    const t = this.epoch.crisisTree;
    const progress: Record<string, number[]> = {};
    for (const [id, arr] of Object.entries(t.progress)) progress[id] = [...arr];
    return {
      activeNodeId: t.activeNodeId,
      cleared: [...t.cleared],
      progress,
      boundIdeology: { ...t.boundIdeology },
    };
  }
```

In the `snapshot()` return object, add the two fields after `influence`:

```ts
      influence: ideologyInfluence(this.epoch.unlockedProjects),
      crisisTree: this.cloneCrisisTree(),
      availableNodes: availableNodesCore(this.setting.crisisTree, this.epoch.crisisTree),
```

Add the passthrough command + query methods (place near `buildColumn`):

```ts
  setActiveObjective(nodeId: string, ideology?: Ideology): CommandResult {
    return setActiveObjectiveCore(this.epoch, this.setting, nodeId, ideology);
  }

  /** Node ids the player may set active right now (unlocked + not cleared). */
  availableNodes(): string[] {
    return availableNodesCore(this.setting.crisisTree, this.epoch.crisisTree);
  }
```

> `ObjectiveNode` is imported so the snapshot consumer (renderer, P6) can type a node lookup against `setting.crisisTree.nodes`; it is not otherwise referenced in P3. If `tsc` flags it as unused-import under the project's oxlint config, drop it from the import list now and re-add in P6 — verify with the typecheck step below.

- [ ] **Backfill `crisisTree` defensively in the GameAPI constructor + `loadFromState`.** A v7 save predates `crisisTree` (the migrator/backfill lands fully in P5, but the constructor must not crash if the field is absent now). Import `seedCrisisTreeState` from `epoch.ts`:

```ts
import { createEpoch, currentVector, seedCrisisTreeState } from "../core/engine/epoch.ts";
```

In the constructor's `if (active)` block, after the `turnPhase` defensive default (~line 92), add:

```ts
      if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
      // Defensive: a save predating crisisTree seeds a fresh tree state so it
      // loads interactive (full v7→v8 migration lands in P5).
      if (this.epoch.crisisTree === undefined) {
        this.epoch.crisisTree = seedCrisisTreeState(this.setting.crisisTree);
      }
```

Mirror the same guard in `loadFromState`, after its `turnPhase` default (~line 193):

```ts
    if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
    if (this.epoch.crisisTree === undefined) {
      this.epoch.crisisTree = seedCrisisTreeState(this.setting.crisisTree);
    }
```

- [ ] **Run the new tests — confirm green.**

```
bun test tests/crisisTree.test.ts
```

Expected: all P1/P2/P3 tests in the file pass, e.g. `✓ createEpoch seeds activeNodeId=rootId...`, `✓ rejects a node that is not currently available`, `✓ a requireSameIdeology (Doctrine) node binds its ideology on activation`, `✓ a build matching the active root recipe advances its progress via snapshot`. `0 fail`.

- [ ] **Run the full suite — confirm nothing regressed (win condition still difficulty-based).**

```
bun test
```

Expected: all suites pass (`0 fail`). In particular `crisisflow.test.ts` (`✓ resolveCrisis records a CrisisOutcome`, `✓ with zero unlocks, Crisis fails`), `policyCommands.test.ts`, `dispatch.test.ts`, `effectiveRules.test.ts`, `effectiveRules-routing.test.ts`, `storage.test.ts`, and `smoke.test.ts` all stay green — the Epoch-literal patches kept them compiling and behavior is unchanged.

- [ ] **Run the typecheck gate (whole project).**

```
bun run typecheck
```

Expected: exit 0, no output. (If `ObjectiveNode` is flagged as an unused import in `GameAPI.ts`, remove it from the import list and re-run — see the note above.)

- [ ] **Run lint + format on the touched files** (mirrors the pre-commit hook so the commit isn't reformatted under you).

```
bun run lint && bun run format:check
```

Expected: both pass clean. If `format:check` flags a file, run `bun run format` and re-stage.

- [ ] **Commit (single atomic commit for the whole phase).**

```
git add src/core/engine/epoch.ts src/core/engine/commands.ts src/facade/GameAPI.ts src/core/types.ts tests/fixtures.ts tests/crisisTree.test.ts tests/crisisflow.test.ts tests/policyCommands.test.ts tests/dispatch.test.ts tests/effectiveRules.test.ts tests/effectiveRules-routing.test.ts tests/storage.test.ts
git commit -m "feat(core): seed crisisTree on Epoch + setActiveObjective + buildColumn hook + facade passthrough (P3)

Add crisisTree: CrisisTreeState to the Epoch type, seeded by createEpoch
(activeNodeId=rootId, zeroed per-node/req progress). Add the
setActiveObjective command (gated on availableNodes; Doctrine nodes bind an
ideology) and call applyBuild on buildColumn's success path with the inclusive
projectBuildCount. Expose crisisTree + availableNodes through GameAPI.snapshot
with a deep clone, plus a setActiveObjective passthrough. The win condition is
unchanged (still total >= difficulty); this is additive state plumbing. Patch
every hand-built Epoch literal via a new emptyCrisisTreeState() fixture so the
non-optional field keeps the suite tsc-green.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> The pre-commit hook re-runs `bun run typecheck` over src+tests plus oxlint/prettier on staged files. It must pass — if it reformats a staged file, re-stage and re-commit. `scripts/` is untouched in P3 (the sims still read `crisis.difficulty`, which is still present and still drives the unchanged win condition), so no script adaptation is needed here — that is P4's job.

---

#### Why this phase is green at commit

- The only forced churn from making `crisisTree` non-optional is the six test-file Epoch literals + the two GameAPI defensive backfills; all are patched in this same commit, so `tsc --noEmit` over the whole project passes.
- `resolveCrisis` is **untouched** — it still computes `cleared = total >= setting.crisis.difficulty`, so `crisisflow.test.ts`'s `out.cleared`/`out.totalValue` assertions and every Crisis behavior are byte-identical.
- `buildColumn`'s return type and the facade `buildColumn` signature are unchanged; `applyBuild` is a pure call whose result is assigned back to `epoch.crisisTree`, mutating only the new field.
- `emptyCrisisTreeState()` produces `activeNodeId: null`, the documented no-op state, so the dispatch/effectiveRules/storage tests (which never set an active objective and never build into a real tree) behave exactly as before.


---

## Phase P4 — Flip the win condition to `isWon` + adapt `resolveCrisis` / `CrisisOutcome` + rewrite crisisflow tests + adapt all sims

> **Atomic phase.** This is the single project-wide breaking commit. `resolveCrisis` stops comparing `total >= difficulty` and wins iff `isWon(setting.crisisTree, epoch.crisisTree)`. Because the `CrisisOutcome` shape changes and the three sims drive their AIs by maximizing points + reading `crisis.difficulty`, the type change, **every** consumer literal, the crisisflow test rewrite, and all three script adaptations land in **one commit**. `setting.crisis.difficulty` is still PRESENT after this phase (removed in P5) — we change only the resolution logic and the sim objective drivers.
>
> **Depends on P3 having landed:** `epoch.crisisTree: CrisisTreeState` (seeded by `createEpoch`), `setting.crisisTree: CrisisTree`, the pure `isWon` / `availableNodes` from `src/core/engine/crisisTree.ts`, `GameAPI.setActiveObjective(nodeId, ideology?)`, `GameAPI.availableNodes()`, and `snapshot().epoch.crisisTree` + `snapshot().availableNodes`. Re-verify those exist before starting (`grep -n "setActiveObjective\|availableNodes\|crisisTree" src/facade/GameAPI.ts`).
>
> Verify you are on branch `feat/crisis-tree` (`git branch --show-current`).

### Task 9: Flip `resolveCrisis` to `isWon`, extend `CrisisOutcome` with the cleared path, rewrite the crisisflow tests, and adapt all three sims (one atomic commit)

**Files:**
- `src/core/data/projects.ts` — `CrisisOutcome` interface at lines 78–85 (add `clearedNodeIds`)
- `src/core/engine/turn.ts` — `resolveCrisis` at lines 107–155 (import `isWon`; replace `total >= setting.crisis.difficulty` at line 143; populate `clearedNodeIds`)
- `src/core/engine/campaign.ts` — `CrisisOutcome` literal at line 109 (add `clearedNodeIds: []`)
- `tests/dispatch.test.ts` — `CrisisOutcome` literal at line 280 (add `clearedNodeIds: []`)
- `tests/policyCommands.test.ts` — `CrisisOutcome` literal at line 366 (add `clearedNodeIds: []`)
- `tests/crisisflow.test.ts` — rewrite the three flow tests + keep the leveling test (full file)
- `scripts/analyze-crisis.ts` — `runEpoch` (lines 286–475) + `reportFor` (lines 502–547): set an active objective each turn, bias builds, report `won = outcome.cleared`
- `scripts/explore-strategies.ts` — `runEpoch` (lines 435–495): set an active objective, drop `cumValue >= difficulty`, `won = outcome.cleared`
- `scripts/compare-influence.ts` — `runEpoch` (lines 25–80): set an active objective, `won = outcome.cleared`, drop `crisis.difficulty` margin

> The cleared-path field is **required** (non-optional `clearedNodeIds: string[]`) for the same reason `promotedIdeology` is required — it forces tsc to surface every `CrisisOutcome` literal so none silently omits it. There are exactly four literal sites (turn.ts populates it; campaign.ts + the two test fixtures backfill `[]`); all are patched in this commit.

- [ ] **Write the failing test first.** Replace the entire body of `tests/crisisflow.test.ts` with the version below. It drops the difficulty-coupled assertions and asserts the `isWon`-driven `cleared` + the new `clearedNodeIds` field. The `epochWithUnlocks` literal must include `crisisTree` (added to `Epoch` in P3) — use the P3 fixtures helper `emptyCrisisTreeState`. To exercise a **cleared** terminal, hand-author a tiny tree on a synthetic Setting via the helper so the test does not depend on the live Homeworld recipe counts.

```ts
import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";
import { resolveCrisis } from "../src/core/engine/turn.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Epoch, ProjectUnlock, Setting, CrisisTree } from "../src/core/types.ts";
import { emptyPolicyState, emptyCrisisTreeState } from "./fixtures.ts";

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

  test("resolveCrisis records a CrisisOutcome with the cleared path", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome;
    if (!out) throw new Error("expected crisis outcome");
    expect(typeof out.totalValue).toBe("number");
    expect(typeof out.cleared).toBe("boolean");
    expect(Array.isArray(out.clearedNodeIds)).toBe(true);
  });

  test("with no terminal cleared, Crisis fails", () => {
    // A pass-only run clears no objective node → cleared===false, empty path.
    const api = new GameAPI(7, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome;
    if (!out) throw new Error("expected crisis outcome");
    expect(out.cleared).toBe(false);
    expect(out.clearedNodeIds).toEqual([]);
  });

  test("cleared===true when a terminal node is in epoch.crisisTree.cleared", () => {
    // Synthetic 1-node tree whose root is itself terminal: mark it cleared
    // directly and assert resolveCrisis reads it as a win via isWon.
    const tree: CrisisTree = {
      rootId: "win",
      nodes: {
        win: {
          id: "win",
          name: "Instant Win",
          branch: "establish",
          requirements: [{ pattern: "any", count: 1 }],
          unlocks: [],
          terminal: true,
        },
      },
    };
    const setting: Setting = { ...getSetting("homeworld"), crisisTree: tree };
    const ep = epochWithUnlocks([], tree);
    ep.crisisTree.cleared = ["win"];
    const out = resolveCrisis(ep, setting);
    expect(out.cleared).toBe(true);
    expect(out.clearedNodeIds).toEqual(["win"]);
  });
});

function epochWithUnlocks(unlocks: ProjectUnlock[], tree?: CrisisTree): Epoch {
  return {
    epochNumber: 1,
    settingId: "homeworld",
    turn: 13,
    phase: "crisis",
    turnPhase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns: [],
    unlockedProjects: unlocks,
    eventLog: [],
    influence: 0,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
    policy: emptyPolicyState(),
    crisisTree: emptyCrisisTreeState(tree),
  };
}

const pairUnlock = (turn: number): ProjectUnlock => ({
  projectId: "homeworld-commons", // pattern "pair", base value 2
  pattern: "pair",
  turn,
  cards: [getCard(landId(7, "solidarity"))],
  promotedIdeology: "solidarity",
});

describe("Crisis leveling (totalValue retained for Legacy magnitude)", () => {
  test("three pair-builds contribute 2+1+1 = 4, not 6", () => {
    const setting = getSetting("homeworld");
    const ep = epochWithUnlocks([pairUnlock(2), pairUnlock(4), pairUnlock(6)]);
    const out = resolveCrisis(ep, setting);
    expect(out.totalValue).toBe(4);
    expect(out.contributions.map((c) => c.value)).toEqual([2, 1, 1]);
    expect(out.contributions.map((c) => c.level)).toEqual([1, 2, 3]);
    expect(out.contributingUnlocks.length).toBe(3); // unchanged shape preserved
  });
});
```

- [ ] **Run the test — confirm it fails** (the new field and `emptyCrisisTreeState(tree)` overload do not exist yet):

```
bun test tests/crisisflow.test.ts
```

Expected: failures referencing `clearedNodeIds` not existing on `CrisisOutcome` and/or the `tree` arg to `emptyCrisisTreeState` (depending on the P3 helper signature), plus `resolveCrisis` not populating `clearedNodeIds`.

- [ ] **If the P3 `emptyCrisisTreeState` helper does not accept a `tree?` arg**, extend it in `tests/fixtures.ts` to seed from a passed tree (falling back to a default). Read the current helper first, then make it match this shape:

```ts
import type { CrisisTree, CrisisTreeState } from "../src/core/types.ts";
import { HOMEWORLD } from "../src/core/settings/homeworld.ts";

/** A zeroed CrisisTreeState for a hand-built Epoch. Seeds activeNodeId=rootId,
 *  empty cleared, a zero-filled progress array per node sized to its
 *  requirements, and an empty boundIdeology. Defaults to HOMEWORLD's tree. */
export function emptyCrisisTreeState(tree: CrisisTree = HOMEWORLD.crisisTree): CrisisTreeState {
  const progress: Record<string, number[]> = {};
  for (const id of Object.keys(tree.nodes)) {
    progress[id] = tree.nodes[id].requirements.map(() => 0);
  }
  return {
    activeNodeId: tree.rootId,
    cleared: [],
    progress,
    boundIdeology: {},
  };
}
```

> If P3 already shipped a no-arg `emptyCrisisTreeState`, give it this optional `tree` parameter (additive — existing call sites pass nothing and keep working).

- [ ] **Extend the `CrisisOutcome` type.** In `src/core/data/projects.ts`, add the required cleared-path field to the interface at lines 78–85:

```ts
export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  /** Ids of cleared nodes whose clearing decided the outcome (the cleared path).
   *  Empty on a loss. Source of the win verdict + the end-screen path display.
   *  Required so every CrisisOutcome literal is surfaced at tsc time. */
  clearedNodeIds: string[];
  /** Ordered highest pattern first (reverse of PATTERNS_IN_ORDER), then by turn. */
  contributingUnlocks: ProjectUnlock[];
  /** Per-build leveled detail, same order as contributingUnlocks. */
  contributions: CrisisContribution[];
}
```

> `CrisisOutcome` is already re-exported through `src/core/types.ts:25` — no barrel edit needed.

- [ ] **Rewrite `resolveCrisis`.** In `src/core/engine/turn.ts`, add the `isWon` import and replace the `cleared`/`outcome` block. Keep the entire leveled-value sum that produces `total` (it still feeds `totalValue` for Legacy magnitude — §7 option b) and keep `contributingUnlocks` / `contributions` untouched.

First, extend the import at the top of the file (currently imports `ideologyInfluence, projectLevels, reversePatternOrder` from `../data/projects.ts`):

```ts
import { isWon } from "./crisisTree.ts";
```

Then replace lines 143–149 (the `const cleared = total >= setting.crisis.difficulty;` through the `outcome` literal):

```ts
  const cleared = isWon(setting.crisisTree, epoch.crisisTree);
  const clearedNodeIds = cleared
    ? epoch.crisisTree.cleared.filter((id) => setting.crisisTree.nodes[id]?.terminal)
    : [];
  const outcome: CrisisOutcome = {
    totalValue: total,
    cleared,
    clearedNodeIds,
    contributingUnlocks,
    contributions,
  };
```

> `clearedNodeIds` is the subset of `epoch.crisisTree.cleared` that are terminal — the actual victory path the player completed. On a loss it is `[]`. `setting.crisis.difficulty` is no longer read by `resolveCrisis` (it remains on the type until P5).

- [ ] **Patch the three remaining `CrisisOutcome` literals** to satisfy the now-required field.

In `src/core/engine/campaign.ts` line 109 (inside `prepareEndOfEpoch`'s no-outcome guard):

```ts
      crisis: {
        totalValue: 0,
        cleared: false,
        clearedNodeIds: [],
        contributingUnlocks: [],
        contributions: [],
      },
```

In `tests/dispatch.test.ts` line 280:

```ts
      outcome: {
        totalValue: 0,
        cleared: true,
        clearedNodeIds: [],
        contributingUnlocks: [],
        contributions: [],
      },
```

In `tests/policyCommands.test.ts` line 366:

```ts
      outcome: {
        totalValue: 0,
        cleared: false,
        clearedNodeIds: [],
        contributingUnlocks: [],
        contributions: [],
      },
```

> `legacy.ts` (`mintCandidatesOnWin`/`mintCandidatesOnLoss`/`buildMonument`) and `campaign.ts`'s `EpochResult`/`finalizeEpoch` read only `contributingUnlocks` + `totalValue`, both retained — no further edits there.

- [ ] **Run the core + test suite — confirm green:**

```
bun run typecheck && bun test
```

Expected: typecheck passes (`tsc --noEmit` exits 0); `bun test` shows all suites passing, including the four rewritten/extended `tests/crisisflow.test.ts` tests and the unchanged leveling test. No test should reference `crisis.difficulty` anymore in `tests/crisisflow.test.ts`.

- [ ] **Adapt `scripts/analyze-crisis.ts`.** The greedy AI must now pick an active objective each turn and bias toward its required patterns, then report `won = outcome.cleared` (now `isWon`-driven). Make these edits:

  1. **Add an objective-driver helper** before `runEpoch` (after the `worthStoringForStraight` helper, ~line 280). It picks an available node toward a terminal (clear the root first, then the cheapest-reachable branch by total remaining requirement count) and binds an ideology for `requireSameIdeology` nodes:

```ts
import type { ObjectiveNode } from "../src/core/types.ts";

/** Choose + set the active objective from the snapshot's availableNodes.
 *  Prefer a non-terminal (the root gate) until it clears, then the branch with
 *  the fewest total remaining builds. Binds the most-built present ideology for
 *  requireSameIdeology (Doctrine) nodes. Returns the patterns the active node
 *  still needs (to bias the build heuristic). */
function steerObjective(api: GameAPI): { needed: Set<PatternKind>; anyNeeded: boolean } {
  const snap = api.snapshot();
  const tree = snap.setting.crisisTree;
  const state = snap.epoch.crisisTree;
  const avail = snap.availableNodes; // ObjectiveNode[] from GameAPI (P3)
  const remaining = (n: ObjectiveNode) =>
    n.requirements.reduce(
      (s, r, i) => s + Math.max(0, r.count - (state.progress[n.id]?.[i] ?? 0)),
      0,
    );
  // Establish/root gates first; then the cheapest branch.
  const ranked = [...avail].sort((a, b) => {
    const ag = a.branch === "establish" ? 0 : 1;
    const bg = b.branch === "establish" ? 0 : 1;
    return ag - bg || remaining(a) - remaining(b);
  });
  const target = ranked[0];
  const needed = new Set<PatternKind>();
  if (target) {
    if (state.activeNodeId !== target.id) {
      const ideo = target.requireSameIdeology ? topPresentIdeology(snap) : undefined;
      api.setActiveObjective(target.id, ideo);
    }
    const active = api.snapshot().epoch.crisisTree.activeNodeId;
    const node = active ? tree.nodes[active] : undefined;
    if (node) {
      node.requirements.forEach((r, i) => {
        const have = api.snapshot().epoch.crisisTree.progress[node.id]?.[i] ?? 0;
        if (have < r.count && r.pattern !== "any") needed.add(r.pattern);
      });
    }
  }
  return { needed, anyNeeded: needed.size > 0 };
}

/** The present ideology with the most non-wild cards across all columns. */
function topPresentIdeology(snap: ReturnType<GameAPI["snapshot"]>): Ideology | undefined {
  const tally = new Map<Ideology, number>();
  for (const col of snap.epoch.columns) {
    for (const c of [...col.lands.cards, ...col.influence.cards]) {
      if (c.countsAs !== undefined || c.ideology === "wild") continue;
      tally.set(c.ideology, (tally.get(c.ideology) ?? 0) + 1);
    }
  }
  let best: Ideology | undefined;
  let bestN = 0;
  for (const [ideo, n] of tally) if (n > bestN) ((bestN = n), (best = ideo));
  return best;
}
```

  2. **Call `steerObjective` at the top of the play loop** in `runEpoch`, right after the policy-phase early-continue (after line 316, before the Step 1 build block). Capture `needed` for the build bias:

```ts
    // Step 0.5: steer the Crisis-Tree objective and learn which patterns it needs.
    const { needed } = steerObjective(api);
```

  3. **Bias the Step 1 build choice** toward the active node's required patterns. In the build block (lines 321–350), when `needed` is non-empty prefer a buildable column whose `m.kind` is in `needed`; fall back to highest marginal value otherwise. Replace the inner scoring so a needed pattern outranks raw value:

```ts
      let bestScore = -Infinity;
      let bestCol = -1;
      let bestKind: PatternKind | null = null;
      for (let i = 0; i < snap.epoch.columns.length; i++) {
        const m = evaluateColumn(snap.epoch.columns[i], snap.setting.projects);
        if (!m) continue;
        const project = snap.setting.projects.find((p) => p.id === m.projectId);
        if (!project) continue;
        const currentCount = snap.epoch.unlockedProjects.filter(
          (u) => u.projectId === m.projectId,
        ).length;
        // Objective-needed patterns get a large bonus so the AI builds the recipe.
        const bonus = needed.has(m.kind) ? 1000 : 0;
        const score = bonus + marginalContribution(project, currentCount);
        if (score > bestScore) {
          bestScore = score;
          bestCol = i;
          bestKind = m.kind;
        }
      }
```

  4. **Rewrite `RunResult`, the `runEpoch` return, and `reportFor`** to drop `crisis.difficulty` / margin-vs-difficulty and report the cleared path + turns-to-clear. Replace the `RunResult` interface (lines 20–28):

```ts
interface RunResult {
  won: boolean;
  clearedPath: string[]; // terminal node ids cleared (the win path)
  totalValue: number; // retained for magnitude reporting only
  turnsPlayed: number;
  unlocksByPattern: Record<PatternKind, number>;
  firstByPattern: Partial<Record<PatternKind, number>>;
}
```

Replace the `runEpoch` tail (lines 461–474, the `difficulty`/`margin` block):

```ts
  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const snap = api.snapshot();
  const outcome = snap.epoch.crisis.outcome;
  if (!outcome) throw new Error("Crisis did not resolve after MAX_STEPS.");
  return {
    won: outcome.cleared,
    clearedPath: outcome.clearedNodeIds,
    totalValue: outcome.totalValue,
    turnsPlayed: snap.epoch.turn - 1, // turn is 1-based after Crisis fires
    unlocksByPattern,
    firstByPattern,
  };
```

In `reportFor` (lines 502–547), delete the `margins` array and the `difficulty` / `margin` report keys. Replace the report object's `difficulty` + `margin` + `totalValue` block with:

```ts
  return {
    setting: settingId,
    runs,
    wins,
    winRate: round(wins / runs, 3),
    clearedPaths: results.flatMap((r) => r.clearedPath).reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {}),
    avgTurnsPlayed: round(mean(results.map((r) => r.turnsPlayed))),
    totalValue: {
      mean: round(mean(results.map((r) => r.totalValue))),
      median: round(median(results.map((r) => r.totalValue))),
    },
    avgTotalUnlocks,
    avgUnlocksPerPattern: avgUnlocks,
    avgFirstUnlockTurn: avgFirst,
  };
```

> Remove the now-unused `const difficulty = snap.setting.crisis.difficulty;` (was line 465) and the `margins`/`totals`-margin computations. Keep `median`/`mean`/`stdev`/`round` helpers. Ensure `Ideology` and the new `ObjectiveNode` type imports are present.

- [ ] **Adapt `scripts/explore-strategies.ts`.** Each policy must steer an objective each turn and report `won = outcome.cleared`; drop the `cumValue >= difficulty` earliest-win logic.

  1. **Add a `steerObjective` tactic** at the top of every policy's tactic list so the active node is set before the strategy's build/place tactics fire. Add this helper near the other tactics (after `seedStraight`, ~line 378):

```ts
import type { ObjectiveNode } from "../src/core/types.ts";

/** Tactic: set the active objective toward a terminal (root gate first, then the
 *  cheapest branch). Never "acts" on the board, so it returns false (the policy
 *  loop falls through to the real tactics). Binds an ideology for Doctrine nodes. */
function steerObjective(api: GameAPI): boolean {
  const snap = api.snapshot();
  const state = snap.epoch.crisisTree;
  const avail = snap.availableNodes as ObjectiveNode[];
  const remaining = (n: ObjectiveNode) =>
    n.requirements.reduce(
      (s, r, i) => s + Math.max(0, r.count - (state.progress[n.id]?.[i] ?? 0)),
      0,
    );
  const ranked = [...avail].sort((a, b) => {
    const ag = a.branch === "establish" ? 0 : 1;
    const bg = b.branch === "establish" ? 0 : 1;
    return ag - bg || remaining(a) - remaining(b);
  });
  const target = ranked[0];
  if (target && state.activeNodeId !== target.id) {
    const ideo = target.requireSameIdeology ? (globalTarget(api) as Ideology | null) ?? undefined : undefined;
    api.setActiveObjective(target.id, ideo);
  }
  return false; // steering never counts as a board action
}
```

  2. **Prepend `steerObjective`** to each tactic array in `POLICIES` (lines 385–418). Example for `rush`:

```ts
  rush: [
    steerObjective,
    buildBest(0),
    commitLand(["four-of-a-kind", "full-house", "straight", "three-of-a-kind", "two-pair", "pair"]),
    commitRolePair,
    placeAny,
  ],
```

Do the same (add `steerObjective,` as the first element) for `tall`, `flush`, `monoculture`, and `straight`.

  3. **Rewrite `RunStat` + `runEpoch`** to use the cleared path instead of `earliestWinTurn` via difficulty. Replace `earliestWinTurn` in `RunStat` (line 427) with a `turnsToWin: number | null` and drop `const difficulty = ...` (line 440) + the `cumValue`/`earliestWinTurn` tracking (lines 441–442, 472). Track when the cleared array first contains a terminal:

```ts
interface RunStat {
  won: boolean;
  turnsToWin: number | null; // first turn isWon became true (a terminal cleared)
  totalValue: number;
  unlocks: number;
  topPattern: PatternKind | null;
  byPattern: Record<PatternKind, number>;
  distinctIdeologies: number;
  topIdeologyShare: number;
}

function runEpoch(api: GameAPI, tactics: Tactic[]): RunStat {
  const byPattern = Object.fromEntries(PATTERNS_IN_ORDER.map((p) => [p, 0])) as Record<
    PatternKind,
    number
  >;
  let turnsToWin: number | null = null;
  let steps = 0;

  while (api.snapshot().epoch.phase === "play" && steps < 2000) {
    steps++;
    if (api.snapshot().epoch.turnPhase === "policy") {
      const ps = api.snapshot().epoch.policy;
      api.enactPolicies(pickPolicyKeepIds(ps.candidates, ps.tableau));
      continue;
    }
    const before = api.snapshot().epoch.unlockedProjects.length;
    let acted = false;
    for (const t of tactics) {
      if (t(api)) {
        acted = true;
        break;
      }
    }
    if (!acted) {
      api.endTurn();
      continue;
    }
    const snap = api.snapshot();
    if (snap.epoch.unlockedProjects.length > before) {
      const last = snap.epoch.unlockedProjects[snap.epoch.unlockedProjects.length - 1];
      byPattern[last.pattern]++;
    }
    // Record the first turn a terminal node is cleared (isWon became true).
    if (turnsToWin === null) {
      const tree = snap.setting.crisisTree;
      const hasTerminal = snap.epoch.crisisTree.cleared.some((id) => tree.nodes[id]?.terminal);
      if (hasTerminal) turnsToWin = snap.epoch.turn;
    }
  }

  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const snap = api.snapshot();
  const outcome = snap.epoch.crisis.outcome!;
  let topPattern: PatternKind | null = null;
  for (const p of PATTERNS_IN_ORDER) if (byPattern[p] > 0) topPattern = p;
  const ideoCounts = Object.values(unlockedIdeologyBreakdown(snap.epoch.unlockedProjects)).filter(
    (v) => v > 0,
  );
  const ideoTotal = ideoCounts.reduce((a, b) => a + b, 0);
  return {
    won: outcome.cleared,
    turnsToWin,
    totalValue: outcome.totalValue,
    unlocks: Object.values(byPattern).reduce((a, b) => a + b, 0),
    topPattern,
    byPattern,
    distinctIdeologies: ideoCounts.length,
    topIdeologyShare: ideoTotal ? Math.max(...ideoCounts) / ideoTotal : 0,
  };
}
```

  4. **Update `report` + the summary matrix** (lines 510–582) to read `turnsToWin` instead of `earliestWinTurn`. Replace the two references:

```ts
  const winTurns = wins.map((s) => s.turnsToWin).filter((t): t is number => t !== null);
```

and in the report object replace `winTurnMedian: median(winTurns)` / `winTurnMin` keys (keep the same key names — they already read `winTurns`). No other matrix change is needed since `winTurnMedian`/`winTurnMin` already derive from `winTurns`.

> The header text on line 561 (`"median rounds-to-win"`) is still accurate. Leave the `STORAGE_CAP`/`VALUES` env-override plumbing untouched.

- [ ] **Adapt `scripts/compare-influence.ts`.** The simple placement AI must steer an objective each turn and report `won = outcome.cleared`; drop the `crisis.difficulty` margin.

  Replace `runEpoch` (lines 25–80) with a version that steers and reports turns-to-clear margin:

```ts
import type { ObjectiveNode } from "../src/core/types.ts";

function steerObjective(api: GameAPI): void {
  const snap = api.snapshot();
  const state = snap.epoch.crisisTree;
  const avail = snap.availableNodes as ObjectiveNode[];
  const remaining = (n: ObjectiveNode) =>
    n.requirements.reduce(
      (s, r, i) => s + Math.max(0, r.count - (state.progress[n.id]?.[i] ?? 0)),
      0,
    );
  const ranked = [...avail].sort((a, b) => {
    const ag = a.branch === "establish" ? 0 : 1;
    const bg = b.branch === "establish" ? 0 : 1;
    return ag - bg || remaining(a) - remaining(b);
  });
  const target = ranked[0];
  if (!target || state.activeNodeId === target.id) return;
  // Bind the most-present color for Doctrine nodes.
  let ideo: Ideology | undefined;
  if (target.requireSameIdeology) {
    const tally = new Map<Ideology, number>();
    for (const col of snap.epoch.columns)
      for (const c of [...col.lands.cards, ...col.influence.cards]) {
        if (c.countsAs !== undefined || c.ideology === "wild") continue;
        tally.set(c.ideology, (tally.get(c.ideology) ?? 0) + 1);
      }
    let bestN = 0;
    for (const [k, n] of tally) if (n > bestN) ((bestN = n), (ideo = k));
  }
  api.setActiveObjective(target.id, ideo);
}

function runEpoch(api: GameAPI): { won: boolean; turnsPlayed: number } {
  let steps = 0;
  const MAX_STEPS = 1000;
  while (api.snapshot().epoch.phase === "play" && steps < MAX_STEPS) {
    steps++;
    if (api.snapshot().epoch.turnPhase === "policy") {
      const ps = api.snapshot().epoch.policy;
      api.enactPolicies(pickPolicyKeepIds(ps.candidates, ps.tableau));
      continue;
    }
    steerObjective(api);
    const snap = api.snapshot();
    let acted = false;
    for (const card of snap.epoch.hand) {
      const cols = api.validColumns(card.id);
      if (cols[0] === undefined) continue;
      const r = api.placeCard(card.id, cols[0]);
      if (r.ok) {
        acted = true;
        break;
      }
    }
    if (!acted) {
      const snap2 = api.snapshot();
      for (let i = 0; i < snap2.epoch.columns.length; i++) {
        const m = evaluateColumn(snap2.epoch.columns[i], snap2.setting.projects);
        if (!m) continue;
        const tally = new Map<Ideology, number>();
        for (const c of m.cards) {
          if (c.countsAs !== undefined || c.ideology === "wild") continue;
          tally.set(c.ideology, (tally.get(c.ideology) ?? 0) + 1);
        }
        let promote: Ideology | undefined;
        let bestN = 0;
        for (const [k, n] of tally) {
          if (n > bestN) {
            bestN = n;
            promote = k;
          }
        }
        if (api.buildColumn(i, promote).ok) {
          acted = true;
          break;
        }
      }
    }
    if (!acted) api.endTurn();
  }
  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const snap = api.snapshot();
  const outcome = snap.epoch.crisis.outcome;
  if (!outcome) throw new Error("Crisis did not resolve.");
  return { won: outcome.cleared, turnsPlayed: snap.epoch.turn - 1 };
}
```

  Then update `simulate` (lines 82–106) to aggregate `turnsPlayed` instead of `margin`. Replace the `results` typing + the win/margin stats block:

```ts
  const results: { won: boolean; turnsPlayed: number }[] = [];
  for (let i = 0; i < n; i++) {
    const api = new GameAPI(i + 1, { skipLoad: true, forceSettingId: settingId });
    results.push(runEpoch(api));
  }

  setting.rules.baseInfluenceBaseline = original; // restore

  const wins = results.filter((r) => r.won).length;
  const turns = results.map((r) => r.turnsPlayed);
  const mean = turns.reduce((a, b) => a + b, 0) / turns.length;
  const sorted = [...turns].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return {
    winRate: ((wins / n) * 100).toFixed(1) + "%",
    wins,
    mean: mean.toFixed(1),
    median,
  };
```

  Finally, in the table header (lines 116–121) rename the two margin columns to turns columns for honesty:

```ts
  console.log(
    "Variant".padEnd(20),
    "Win rate".padEnd(12),
    "Wins".padEnd(8),
    "Turns mean".padEnd(14),
    "Turns median",
  );
```

> No `setting.crisis.difficulty` read remains in this script after the edit. The `INFLUENCE_VARIANTS` sweep + the per-Setting loop are untouched.

- [ ] **Smoke-run each script — confirm no runtime crash** (scripts are outside tsconfig, so the green gate did not check them; run them explicitly):

```
bun run scripts/analyze-crisis.ts 5 homeworld
bun run scripts/explore-strategies.ts 5 homeworld rush
bun run scripts/compare-influence.ts 5 homeworld
```

Expected: each prints a JSON/table report and exits 0. `analyze-crisis` output includes a `clearedPaths` object and `winRate`; `explore-strategies` prints the win-rate matrix with `@<turn>` medians; `compare-influence` prints the influence-variant table with `Turns mean`/`Turns median` columns. None should throw (a thrown `Crisis did not resolve` or a `setActiveObjective` rejection indicates the steerer is selecting an unavailable node — re-check it reads `snapshot().availableNodes`).

- [ ] **Re-run the full gate — confirm green:**

```
bun run typecheck && bun test
```

Expected: typecheck exits 0; all test suites pass. The win condition is now `isWon`-driven; `crisis.difficulty` is no longer read anywhere in `src/` or `tests/` (only the renderer `CrisisScreen.vue` + persistence still reference it — removed in P5/P6).

- [ ] **Commit** (single atomic commit — type change + all consumers + tests + all three sims):

```
git add src/core/data/projects.ts src/core/engine/turn.ts src/core/engine/campaign.ts \
  tests/crisisflow.test.ts tests/dispatch.test.ts tests/policyCommands.test.ts tests/fixtures.ts \
  scripts/analyze-crisis.ts scripts/explore-strategies.ts scripts/compare-influence.ts
git commit -m "$(cat <<'EOF'
feat(core): win the Crisis via isWon(crisisTree) instead of total>=difficulty

resolveCrisis now wins iff a terminal Crisis-Tree node is cleared; CrisisOutcome
carries the cleared path (clearedNodeIds) and retains totalValue for Legacy
magnitude. Rewrites the crisisflow tests and re-points all three balance sims to
set an active objective each turn and report won=outcome.cleared.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

> If lefthook's `tsc --noEmit` flags a staged file, the commit aborts — fix and re-stage. `tests/fixtures.ts` is included because the `emptyCrisisTreeState(tree?)` overload may be touched here.


---

## Phase P5 — Remove dead scalar reads + persistence v8 migrator

> **Atomic phase — one commit.** Both the `Epoch` shape (P3 added `crisisTree`) and the win condition (P4 flipped to `isWon`) already changed, so any save blob written by a pre-P3 build (a `v7` slot whose `epoch` has no `crisisTree`) will not load cleanly. This phase bumps the save version to **v8** with a migrator that backfills a seeded `CrisisTreeState` onto old epochs, and adds the matching defensive backfills + `exportState` version bump on `GameAPI`. The whole phase ships in a single commit.

> **Crisis-scalar disposition (decided — read before coding).** `bun run typecheck` runs `vue-tsc --noEmit` over `tsconfig.json`'s `include: ["src/**/*", "tests/**/*"]`, which **covers the renderer `.vue` files**. After P4 the only remaining readers of `setting.crisis.difficulty` are renderer-only: `src/renderer/components/game/ScoreMeter.vue` and `src/renderer/components/game/CrisisScreen.vue` (verified by grep — see below). Those are deleted/rewritten in **P6**, not here. Therefore **P5 KEEPS the `difficulty: number` field on the `Crisis` interface and in all three Settings' `CRISIS` literals** — removing it now would break `vue-tsc` before P6 fixes the renderer, violating green-at-commit. The field is dead to the win condition (P4) but still consumed by the renderer until P6; we leave it as flavor/renderer state and let P6 finish its removal. The substantive P5 work is the persistence v8 migrator + the `GameAPI` version bump and backfill. (Grep to re-confirm before coding — see Task 1 step 1.)

> **Dependency note.** This phase assumes P1–P4 have landed: `src/core/engine/crisisTree.ts` exports the `CrisisTree` / `CrisisTreeState` types and `availableNodes`/`applyBuild`/`isWon`; `src/core/types.ts` re-exports `CrisisTree` and `CrisisTreeState`; `src/core/settings/index.ts` `Setting` has a non-optional `crisisTree: CrisisTree`; each of the three settings authored a `crisisTree`; `src/core/engine/epoch.ts` `Epoch` has `crisisTree: CrisisTreeState` and exports a `seedCrisisTreeState(tree: CrisisTree): CrisisTreeState` helper used by `createEpoch`; `GameAPI.snapshot()` exposes `epoch.crisisTree`. Re-verify these names exist (`grep -n "seedCrisisTreeState" src/core/engine/epoch.ts`, `grep -n "crisisTree" src/core/types.ts src/core/settings/index.ts`) before starting; if a name differs, use the actual one.

---

### Task 10: Persistence v8 store + `migrateV7toV8` crisisTree backfill (failing tests first)

Bump the save store to **v8** and add a migrator that walks each v7 slot and, when the slot's `epoch` lacks `crisisTree`, seeds a default `CrisisTreeState` derived from the slot's Setting's `crisisTree`. The save blob stores only `settingId` (not the Setting object — see `SavedState`), so the Setting shape change needs no migration: settings are re-resolved fresh via `getSetting` at load. Only the `Epoch` needs `crisisTree` backfilled. Corrupt slots are dropped, never thrown. The existing v6→v7 chain is preserved (v6 → v7 → v8 in one `loadStore`).

**Files:**
- `src/facade/persistence.ts` — `STORE_KEY`/`PREV_KEY`/`ARCHIVE_KEY` (persistence.ts:8-10), `SavedState.version` (:15), `SaveStore.version` (:33), `emptyStore` (:37-39), `migrateV6toV7` (:46-74) as the template, `loadStore` chain (:76-105)
- `tests/persistence.test.ts` — extend (file exists; v6→v7 suite at :85-174 stays, `GameAPI` defensive suite at :176-213 stays)

**Steps:**

- [ ] **Re-confirm the only post-P4 `crisis.difficulty` readers are renderer-only** (so P5 leaving the field intact is correct). Run:

  ```bash
  cd /Users/elliott/Projects/space-game-demo && grep -rn "crisis\.difficulty\|\.difficulty" src tests | grep -v "/renderer/"
  ```

  Expected output: **only** the data/type declaration sites — `src/core/data/projects.ts` (the `difficulty: number` interface field) and the three settings' `difficulty: 16/12/23` literals. No `turn.ts`, no `tests/`, no facade reader. (If `turn.ts:143` or any test still reads `setting.crisis.difficulty`, P4 did not land — stop and resolve that first.)

- [ ] **Write the v7→v8 migration tests FIRST** in `tests/persistence.test.ts`. The file already stubs `localStorage` via `installLocalStorage()` and declares `V7_KEY`/`V6_KEY`/`V6_ARCHIVE_KEY`. Add a `V8_KEY` / `V7_ARCHIVE_KEY` constant near the others (after persistence.test.ts:34) and a new `describe` block. Add these imports at the top (after the existing imports, persistence.test.ts:1-6): `import { getSetting } from "../src/core/settings/index.ts";`.

  Add the key constants:

  ```ts
  const V8_KEY = "deck-demo-saves-v8";
  const V7_ARCHIVE_KEY = "deck-demo-saves-v7-archive";
  ```

  Add this `describe` block after the existing `persistence v6 → v7 migration` block (after persistence.test.ts:174):

  ```ts
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
  ```

  Also update the **two existing v6→v7 assertions** that hard-code `7` to expect `8`, because the v6 store now migrates through to the final version in one `loadStore` call. In the `persistence v6 → v7 migration` block, change the four `version`/`.version` expectations at persistence.test.ts:91, :94, :126, and the v7-store test at :131-138 as follows:
  - persistence.test.ts:91 `expect(migrated.version).toBe(7)` → `toBe(8)`
  - persistence.test.ts:94 `expect(slot.state.version).toBe(7)` → `toBe(8)`
  - persistence.test.ts:126 `expect(JSON.parse(store.get(V7_KEY)!).version).toBe(7)` → read `V8_KEY` and `toBe(8)`: `expect(JSON.parse(store.get(V8_KEY)!).version).toBe(8)`
  - the `"a v7 store is returned as-is (no re-migration)"` test at :129-138 is now misnamed/obsolete (a bare v7 store must now MIGRATE, not return as-is). Replace its body: feed a v7 store with the `v7SaveStore()` shape and assert it migrated to version 8 with the slot's crisisTree seeded (this duplicates intent with the new block's first test but keeps the v6-suite's existing structure honest). Simplest: delete this one test from the v6 block (the new v8 block covers "v7 migrates" and "v8 returned as-is") — remove persistence.test.ts:129-138 entirely.
  - the migration-chain test at :117-127 (`"archives the raw v6 string..."`) currently asserts the migrated store is written under `V7_KEY`. After chaining, the FINAL store is written under `V8_KEY`. Update its last assertion (persistence.test.ts:126) to read `V8_KEY` and expect version `8` as noted above. The v6-archive assertions (:123-124) stay (v6 raw still archived under `V6_ARCHIVE_KEY`).

- [ ] **Run the new tests — expect RED** (the migrator and v8 store don't exist yet):

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test tests/persistence.test.ts
  ```

  Expected: failures in the new `persistence v7 → v8 migration` block (`migrated.version` is `7`, not `8`; no `crisisTree` on the migrated epoch) and in the updated v6 assertions. This confirms the tests bind to behavior that doesn't exist yet.

- [ ] **Implement the v8 store + migrator** in `src/facade/persistence.ts`. Update the imports at the top (persistence.ts:4-6) to pull the tree types and `getSetting`:

  ```ts
  import type { Campaign, Epoch, ProjectUnlock } from "../core/types.ts";
  import type { CrisisTree, CrisisTreeState } from "../core/types.ts";
  import type { EndOfEpochState } from "../core/engine/campaign.ts";
  import { projectMajority } from "../core/data/projects.ts";
  import { getSetting } from "../core/settings/index.ts";
  ```

  Change the key constants (persistence.ts:8-10) to add v7 as the previous key and bump archive:

  ```ts
  const STORE_KEY = "deck-demo-saves-v8";
  const PREV_KEY = "deck-demo-saves-v7";
  const ARCHIVE_KEY = "deck-demo-saves-v7-archive";
  // The v6→v7 chain is preserved below loadStore so a still-untouched v6 store
  // migrates all the way through v7 to v8 in one call.
  const V6_KEY = "deck-demo-saves-v6";
  const V6_ARCHIVE_KEY = "deck-demo-saves-v6-archive";
  ```

  Bump the version literals on the types (persistence.ts:15 and :33) and `emptyStore` (persistence.ts:37-39):

  ```ts
  export interface SavedState {
    version: 8;
    // ...rest unchanged
  }
  ```

  ```ts
  export interface SaveStore {
    version: 8;
    activeSlotId: string | null;
    slots: SaveSlot[];
  }

  function emptyStore(): SaveStore {
    return { version: 8, activeSlotId: null, slots: [] };
  }
  ```

  Add a `seedCrisisTreeState` helper local to persistence (mirrors the P3 `seedCrisisTreeState` in epoch.ts; duplicated here to avoid a facade→engine helper dependency on a function that may not be exported — if epoch.ts DOES export it, import and use that instead). Place it just above `migrateV6toV7` (before persistence.ts:46):

  ```ts
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
  ```

  Update `migrateV6toV7` (persistence.ts:46-74) to set `slot.state.version = 7` exactly as today (it already does at :63) — leave the v6→v7 body otherwise unchanged; the version literal `7` in its returned store is intentionally the intermediate version. Then add the new `migrateV7toV8` after it (after persistence.ts:74):

  ```ts
  /** Migrate a parsed v7 store to v8: backfill `crisisTree` onto every epoch that
   *  lacks it (predates P3), seeded from the slot's Setting's current crisisTree.
   *  Settings are re-resolved fresh via getSetting at load, so only the epoch blob
   *  needs touching — no Setting shape is stored. Corrupt slots are dropped, not
   *  fatal; the whole call is wrapped in try/catch by loadStore. */
  function migrateV7toV8(parsed: {
    activeSlotId: string | null;
    slots: unknown[];
  }): SaveStore {
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
  ```

  Rewrite `loadStore` (persistence.ts:76-105) so the chain is v8 → v7 → v6, each stage migrating up and writing the result under the v8 key:

  ```ts
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
  ```

  Note: `migrateV6toV7` returns a `SaveStore` typed `{ version: 7, ... }`. After the literal bump above, `SaveStore.version` is `8`, so `migrateV6toV7`'s `return { version: 7, ... }` no longer matches the `SaveStore` type. Fix `migrateV6toV7` to return a structurally-compatible intermediate: change its signature to `: { activeSlotId: string | null; slots: SaveSlot[] }` (drop the `SaveStore` return annotation and the `version` key from its returned object, since `migrateV7toV8` re-stamps `version: 8` and the slots already carry `state.version = 7`). Concretely, in `migrateV6toV7` change the final `return { version: 7, activeSlotId, slots };` (persistence.ts:73) to `return { activeSlotId, slots };` and update its return type annotation to `{ activeSlotId: string | null; slots: SaveSlot[] }`. Then `migrateV7toV8(v7)` accepts it (its param is `{ activeSlotId; slots: unknown[] }`).

- [ ] **Run the persistence suite — expect GREEN:**

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test tests/persistence.test.ts
  ```

  Expected: all tests pass, including the new `persistence v7 → v8 migration` block and the updated v6-chain assertions (v6 now migrates through to version 8, archived raw under `deck-demo-saves-v6-archive`).

---

### Task 11: `GameAPI` version bump + defensive crisisTree backfill

Bump `exportState().version` to `8` and add a defensive `crisisTree` backfill in both load paths (constructor at GameAPI.ts:85-101 and `loadFromState` at GameAPI.ts:187-203), mirroring the existing `turnPhase` (GameAPI.ts:92, :193) and `promotedIdeology` (GameAPI.ts:97-99, :198-200) defensive defaults. This covers a hand-edited or migrator-skipped save whose epoch still lacks `crisisTree`, so the game loads interactive instead of crashing in `snapshot()` (which clones `epoch.crisisTree` — see P3's snapshot work).

**Files:**
- `src/facade/GameAPI.ts` — `exportState` (:113-122), constructor load branch (:85-101), `loadFromState` (:187-203)
- `tests/persistence.test.ts` — extend the `GameAPI defensive ...` describe (:176-213)

**Steps:**

- [ ] **Write the defensive-backfill test FIRST** in `tests/persistence.test.ts`, alongside the existing `GameAPI defensive promotedIdeology backfill` block (after persistence.test.ts:213). It mirrors that test's round-trip technique (seed a real epoch via `skipLoad`, strip `crisisTree`, round-trip through a v8 store, assert the API backfilled it). Add to the imports if not present: `getSetting` is already imported by Task 1.

  ```ts
  describe("GameAPI defensive crisisTree backfill", () => {
    test("a loaded epoch missing crisisTree is seeded from the Setting's tree", () => {
      // Start from a real, fully-formed epoch so snapshot() has a complete
      // deck/policy state to read, then delete crisisTree and round-trip through a
      // v8 store. The constructor's defensive block must seed it (active = root)
      // so snapshot() (which deep-clones crisisTree) does not crash.
      const seed = new GameAPI(3, { skipLoad: true });
      const state = JSON.parse(JSON.stringify(seed.exportState())) as Record<string, unknown>;
      const epoch = state.epoch as Record<string, unknown>;
      delete epoch.crisisTree; // pretend a pre-P3 / hand-edited save

      const v8 = {
        version: 8,
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
      store.set(V8_KEY, JSON.stringify(v8));

      const api = new GameAPI(1);
      const snap = api.snapshot();
      const ct = (snap.epoch as unknown as { crisisTree: { activeNodeId: string } }).crisisTree;
      expect(ct.activeNodeId).toBe(getSetting("homeworld").crisisTree.rootId);
    });

    test("a brand-new GameAPI persists at version 8", () => {
      const api = new GameAPI(99, { skipLoad: true });
      expect(api.exportState().version).toBe(8);
    });
  });
  ```

- [ ] **Run — expect RED** (`exportState().version` is still `7`; the constructor does not backfill `crisisTree`, so either the version assert fails or `snapshot()` throws on the missing `crisisTree`):

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test tests/persistence.test.ts
  ```

  Expected: the two new `GameAPI defensive crisisTree backfill` tests fail.

- [ ] **Bump `exportState` version** in `src/facade/GameAPI.ts` (:114):

  ```ts
  exportState(): SavedState {
    return {
      version: 8,
      campaign: this.campaign,
      settingId: this.setting.id,
      epoch: this.epoch,
      endOfEpoch: this.endOfEpoch,
      seed: this.campaign.seed,
    };
  }
  ```

- [ ] **Add the constructor defensive backfill.** In the `if (active)` branch (GameAPI.ts:85-101), after the `turnPhase` default (GameAPI.ts:92) and before the `promotedIdeology` loop (GameAPI.ts:97), add — note `this.setting` is already assigned at GameAPI.ts:86:

  ```ts
      if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
      // Defensive: a save predating the Crisis Tree (or a migrator-skipped /
      // hand-edited slot) loads `crisisTree === undefined`, which would crash
      // snapshot()'s deep-clone. Seed it from this Setting's tree (active = root).
      if (this.epoch.crisisTree === undefined) {
        this.epoch.crisisTree = seedCrisisTreeState(this.setting.crisisTree);
      }
  ```

- [ ] **Add the same backfill to `loadFromState`** (GameAPI.ts:187-203), after the `turnPhase` default (GameAPI.ts:193). `this.setting` is assigned at GameAPI.ts:189:

  ```ts
      if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
      if (this.epoch.crisisTree === undefined) {
        this.epoch.crisisTree = seedCrisisTreeState(this.setting.crisisTree);
      }
  ```

- [ ] **Import the seed helper.** Use the P3 helper exported from epoch.ts. Add to the existing `createEpoch, currentVector` import from `../core/engine/epoch.ts` (GameAPI.ts:9):

  ```ts
  import { createEpoch, currentVector, seedCrisisTreeState } from "../core/engine/epoch.ts";
  ```

  (Re-verify the export name with `grep -n "export function seedCrisisTreeState\|export { .*seedCrisisTreeState" src/core/engine/epoch.ts`. If P3 named it differently or did not export it, import the actual name, or fall back to the local `seedCrisisTreeStateFor` from persistence — but prefer the single shared engine helper.)

- [ ] **Run the persistence suite — expect GREEN:**

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test tests/persistence.test.ts
  ```

  Expected: all tests pass, including the two new defensive-backfill tests.

---

### Task 12: Whole-suite green + typecheck + commit

Confirm the version bump and migrator did not regress any other suite (notably `smoke.test.ts` and `crisisflow.test.ts`, which round-trip `GameAPI` / `exportState`), confirm `vue-tsc` is green over the whole project (the renderer still reads the retained `crisis.difficulty`, so it must compile), then commit the atomic phase.

**Files:** none new — verification + commit only.

**Steps:**

- [ ] **Run the full test suite — expect GREEN:**

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test
  ```

  Expected: all suites pass. Pay attention to `smoke.test.ts` (`fresh campaign starts with Homeworld`, etc. — these call `snapshot()` on a freshly-created epoch, which now carries `crisisTree` from P3's `createEpoch`, unaffected by P5) and `crisisflow.test.ts` (P4 already rewrote it to assert `cleared` via `isWon`; P5 does not touch win logic). No `0 fail`.

- [ ] **Run the typecheck — expect GREEN** (this is the lefthook gate; it runs `vue-tsc --noEmit` over `src/**/*` + `tests/**/*`, INCLUDING the renderer that still reads `crisis.difficulty` — which is why P5 deliberately did NOT remove the field):

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun run typecheck
  ```

  Expected: no output, exit 0. (If `vue-tsc` complains about `ScoreMeter.vue`/`CrisisScreen.vue` reading `crisis.difficulty`, the `Crisis` interface's `difficulty` field was removed in error — restore it; it stays until P6.)

- [ ] **Smoke-check that old saves still load via the app build** (the migrator runs in-browser; a production build proves the facade compiles into the renderer bundle):

  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun run build
  ```

  Expected: a successful Vite build with no type errors. (This is a belt-and-braces check on top of `typecheck`; skip only if `bun run typecheck` already covers your confidence and the build is slow.)

- [ ] **Commit the atomic phase.** Confirm on the `feat/crisis-tree` branch first (`git branch --show-current` → `feat/crisis-tree`; if not, branch before committing):

  ```bash
  cd /Users/elliott/Projects/space-game-demo && git add -A && git commit -m "$(cat <<'EOF'
  feat(persistence): bump saves to v8 with crisisTree migrator

  Both the Epoch shape (crisisTree, added P3) and the win condition (isWon,
  P4) changed, so pre-Crisis-Tree v7 saves can't load cleanly. Bump the save
  store to v8 with migrateV7toV8: backfill a seeded CrisisTreeState (active =
  the Setting's root node, zeroed per-requirement progress) onto every epoch
  that lacks one. Settings are re-resolved fresh via getSetting at load, so
  only the epoch blob needs touching — no Setting shape is stored. The v6->v7
  chain is preserved (v6 migrates through to v8 in one loadStore). Old v7 raw
  is archived under deck-demo-saves-v7-archive; corrupt slots are dropped, not
  thrown.

  GameAPI.exportState now stamps version 8, and both load paths (constructor +
  loadFromState) defensively seed crisisTree when a hand-edited / migrator-
  skipped slot still lacks it, mirroring the existing turnPhase /
  promotedIdeology backfills.

  crisis.difficulty stays on the Crisis type + the three Settings for now: it
  is still consumed by the renderer (ScoreMeter/CrisisScreen), which P6 fixes;
  removing it here would break vue-tsc. It is dead to the win condition.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ```

  Expected: lefthook runs `oxlint --fix` + `prettier --write` on staged files, then `bun run typecheck` over the whole project — all green — and the commit succeeds. If lefthook restages a formatted file, the commit still completes with the formatted content.

---

**Phase P5 done when:** `bun test` and `bun run typecheck` are both green; a synthetic v7 store migrates to v8 with a root-seeded `crisisTree` and loads through `GameAPI` without throwing; a fresh `GameAPI` persists at version 8; the v6→v7→v8 chain still migrates legacy saves; and `crisis.difficulty` remains on the `Crisis` type / Settings (its removal is deferred to P6, which deletes the renderer that reads it).


---

## Phase P6 — Renderer: replace points CrisisBar/ScoreMeter with a minimal objectives panel + wire GameService

> Renderer-only phase. Core + tests are already green from P5 (`resolveCrisis` is `isWon`-driven, `crisis.difficulty` removed, `Snapshot` exposes `crisisTree` + `availableNodes`, `GameAPI.setActiveObjective` exists, `CrisisOutcome` carries `clearedNodeIds`). `bun run typecheck` = `vue-tsc --noEmit` over `src/**/*` + `tests/**/*`, so **`.vue` files ARE part of the green gate** — every commit below must compile under `vue-tsc`. No test imports a `.vue` file, so `bun test` stays unaffected; the renderer is validated by `vue-tsc` + a manual dev-build sanity check.
>
> **Anchors verified in current code (re-verify by reading before editing):**
> - `src/renderer/App.vue` — `import ScoreMeter` at :199, `<ScoreMeter ... :crisis="setting.crisis" ... />` at :42–46 inside `<aside class="info-column">`; `<CrisisBar :crisis="setting.crisis" :turn=... :max-turns=... />` at :37 inside `.crisis-bar-region`; `<CrisisScreen :crisis="setting.crisis" :outcome="eoe.crisis" .../>` at :121–129. `import CrisisBar` :198. The `game` service is `getGameService()` (:211); `onBuild`/`onPromote` already exist as the model for handlers.
> - `src/renderer/GameService.ts` — `run<T>()` chokepoint (:39), command passthroughs like `buildColumn` (:85). `Ideology` already imported (:6).
> - `src/renderer/components/game/CrisisBar.vue` — consumes only `crisis.name`, `turn`, `maxTurns` (the `crisis` prop is used ONLY for `crisis.name`). `turnsLeft`/`consumedPct` math at :28–33.
> - `src/renderer/components/game/ScoreMeter.vue` — reads `crisis.difficulty` (dead after P5); to be **deleted**.
> - `src/renderer/components/game/CrisisScreen.vue` — `:difficulty` line at :6–8, `verdict` line at :24–27 reads `outcome.totalValue` + `crisis.difficulty`. `outcome` is `CrisisOutcome` (now has `clearedNodeIds: string[]`, `cleared: boolean`, retains `totalValue`/`contributions`).
> - `src/renderer/util/labels.ts` — `patternLabel(p: PatternKind)` (:19) does NOT accept `"any"`; the panel needs an `"any"`-tolerant label helper.
> - `src/facade/GameAPI.ts` — `Snapshot` (:56) now exposes `crisisTree: CrisisTreeState` + `availableNodes: ObjectiveNode[]` (P3); `setActiveObjective(nodeId, ideology?)` passthrough exists (P3). `setting.crisisTree: CrisisTree` (P2). Re-read these to confirm exact field/query names before wiring.
> - `src/core/data/ideologies.ts` — `IDEOLOGIES: Ideology[]` (:50), `IDEOLOGY_DISPLAY` (:19) for the Doctrine ideology binding UI.
> - `src/core/types.ts` barrel re-exports `ObjectiveNode`, `ObjectiveRequirement`, `CrisisTree`, `CrisisTreeState`, `Ideology`, `PatternKind` (P1).

---

### Task 13: Wire `setActiveObjective` through GameService + add an `"any"`-tolerant pattern label helper

Foundational plumbing the panel depends on. The renderer needs (a) a `GameService.setActiveObjective` passthrough routed through `run()` so the snapshot refreshes + persists, and (b) a label helper that renders `"any"` (recipe requirements use `PatternKind | "any"`, and `patternLabel` only accepts `PatternKind`). No component consumes these yet, so this commit is purely additive and stays green.

**Files:**
- `src/renderer/GameService.ts` (add command after `removePolicy`, ~:160)
- `src/renderer/util/labels.ts` (add helper after `patternLabel`, ~:21)

Steps:

- [ ] **Re-verify the facade surface first.** Read `src/facade/GameAPI.ts` and confirm the exact signature of the `setActiveObjective` passthrough added in P3 and the exact `Snapshot` field names for the tree (`crisisTree`, `availableNodes`). Run:
  ```
  grep -n "setActiveObjective\|availableNodes\|crisisTree" src/facade/GameAPI.ts
  ```
  Expected: a `setActiveObjective(nodeId: string, ideology?: Ideology): CommandResult` method on `GameAPI`, and `crisisTree` + `availableNodes` present in the `Snapshot` interface. If the names differ, use the actual names below.

- [ ] In `src/renderer/util/labels.ts`, add a `requirementLabel` helper that tolerates the `"any"` sentinel. Insert directly after the `patternLabel` function (after line 21):
  ```ts
  /** Label for a recipe requirement's pattern, including the "any" sentinel used
   *  by volume (Expansion) nodes. patternLabel only covers concrete PatternKinds. */
  export function requirementLabel(p: PatternKind | "any"): string {
    return p === "any" ? "Any build" : patternLabel(p);
  }
  ```

- [ ] In `src/renderer/GameService.ts`, add a `setActiveObjective` command routed through the `run()` chokepoint. `Ideology` is already imported (line 6). Insert directly after the `removePolicy` method (after line 162, before the closing brace of the class):
  ```ts
  /** Select an available Crisis Tree node as the active objective. For a
   *  requireSameIdeology (Doctrine) node, `ideology` binds the counted color. */
  setActiveObjective(nodeId: string, ideology?: Ideology): void {
    this.run(() => this.api.setActiveObjective(nodeId, ideology));
  }
  ```

- [ ] Run the typecheck gate:
  ```
  bun run typecheck
  ```
  Expected: exits 0, no errors. (If `vue-tsc` reports `Property 'setActiveObjective' does not exist on type 'GameAPI'`, P3's passthrough is missing — stop and confirm P3 landed.)

- [ ] Run the test suite to confirm nothing regressed:
  ```
  bun test
  ```
  Expected: all suites pass (no `.vue`/GameService tests exist, so the count is unchanged from P5).

- [ ] Commit:
  ```
  git add src/renderer/GameService.ts src/renderer/util/labels.ts
  git commit -m "feat(renderer): GameService.setActiveObjective passthrough + any-tolerant requirementLabel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 14: Create `CrisisObjectivesPanel.vue` — available nodes, active objective + recipe progress, turn clock, win/loss

The new minimal-but-functional objectives UI (polished DAG view deferred per spec §9). It renders: the turn clock (turns-left math lifted from `CrisisBar`), the list of available nodes as selectable buttons (with an inline ideology picker for `requireSameIdeology`/Doctrine nodes), the active node's recipe with per-requirement progress (`Any build 2/4`, `Two Pair 1/4`), cleared-node markers, and a win badge when a terminal is cleared. It emits `set-active` with `{ nodeId, ideology? }`; App wiring lands in Task 3. Created in isolation (not yet imported by `App.vue`) so this commit can't break the existing screen — but it IS typechecked by `vue-tsc`.

**Files:**
- `src/renderer/components/game/CrisisObjectivesPanel.vue` (new)

Steps:

- [ ] **Confirm the exact shape of the props this panel will receive** (the `CrisisTreeState`, `ObjectiveNode`, `CrisisTree` field names) before writing the template. Run:
  ```
  grep -n "interface CrisisTreeState\|interface ObjectiveNode\|interface ObjectiveRequirement\|interface CrisisTree\b\|rootId\|activeNodeId\|requireSameIdeology\|boundIdeology\|legacyTier" src/core/engine/crisisTree.ts
  ```
  Expected (from P1 spec §4): `CrisisTreeState { activeNodeId: string | null; cleared: string[]; progress: Record<string, number[]>; boundIdeology: Record<string, Ideology> }`; `ObjectiveNode { id; name; branch; requirements: ObjectiveRequirement[]; requireSameIdeology?: boolean; unlocks: string[]; terminal: boolean; legacyTier?: number }`; `ObjectiveRequirement { pattern: PatternKind | "any"; count: number; upgrade?: boolean }`; `CrisisTree { rootId: string; nodes: Record<string, ObjectiveNode> }`. Use the actual field names if any differ.

- [ ] Create `src/renderer/components/game/CrisisObjectivesPanel.vue` with this full content:
  ```vue
  <template>
    <Panel title="Crisis">
      <!-- Turn clock: turns remaining before the Crisis resolves. -->
      <div class="clock" :class="{ edge: turnsLeft <= 1 }">
        <span class="clock-name">{{ crisisName }}</span>
        <span class="clock-turns">{{ turnsLabel }}</span>
      </div>

      <div v-if="won" class="win-badge">Victory secured</div>

      <!-- Available objectives: selectable, marks the active one. -->
      <div class="nodes">
        <div
          v-for="node in availableNodes"
          :key="node.id"
          class="node"
          :class="{ active: node.id === state.activeNodeId, terminal: node.terminal }"
        >
          <button
            class="node-select"
            :disabled="node.requireSameIdeology && pendingIdeology[node.id] === undefined"
            @click="selectNode(node)"
          >
            <span class="node-name">{{ node.name }}</span>
            <span class="node-branch">{{ node.branch }}</span>
            <span v-if="node.terminal" class="node-flag">win</span>
          </button>

          <!-- Doctrine: bind the counted color before activating. -->
          <div v-if="node.requireSameIdeology" class="ideology-pick">
            <button
              v-for="id in IDEOLOGIES"
              :key="id"
              class="ideology-chip"
              :class="{ chosen: pendingIdeology[node.id] === id }"
              @click="pendingIdeology[node.id] = id"
            >
              {{ IDEOLOGY_DISPLAY[id].abbrev }}
            </button>
          </div>

          <!-- Recipe with per-requirement progress, shown for the active node. -->
          <ul v-if="node.id === state.activeNodeId" class="recipe">
            <li
              v-for="(req, i) in node.requirements"
              :key="i"
              :class="{ done: progressFor(node.id, i) >= req.count }"
            >
              <span class="req-pattern">{{ requirementLabel(req.pattern)
                }}<span v-if="req.upgrade" class="req-upgrade"> (upgrade)</span></span>
              <span class="req-count">{{ progressFor(node.id, i) }}/{{ req.count }}</span>
            </li>
          </ul>
        </div>

        <p v-if="availableNodes.length === 0" class="empty">No objectives available.</p>
      </div>

      <!-- Cleared path summary. -->
      <p v-if="state.cleared.length" class="cleared">
        Cleared: {{ clearedNames.join(" → ") }}
      </p>
    </Panel>
  </template>

  <script setup lang="ts">
  import { computed, reactive } from "vue";
  import type { CrisisTree, CrisisTreeState, Ideology, ObjectiveNode } from "../../../core/types.ts";
  import { IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
  import { requirementLabel } from "../../util/labels.ts";
  import Panel from "../core/Panel.vue";

  const props = defineProps<{
    state: CrisisTreeState;
    availableNodes: ObjectiveNode[];
    tree: CrisisTree;
    crisisName: string;
    turn: number;
    maxTurns: number;
  }>();

  const emit = defineEmits<{ "set-active": [payload: { nodeId: string; ideology?: Ideology }] }>();

  // Local, per-node ideology selection for Doctrine nodes (not yet bound in core
  // until the node is activated). Reset is unnecessary — keyed by node id.
  const pendingIdeology = reactive<Record<string, Ideology | undefined>>({});

  // Crisis fires when turn > maxTurns; while on turn N of M, M - N + 1 turns remain.
  const turnsLeft = computed(() => Math.max(0, props.maxTurns - props.turn + 1));
  const turnsLabel = computed(() => {
    if (turnsLeft.value === 0) return "Crisis now";
    if (turnsLeft.value === 1) return "1 turn left";
    return `${turnsLeft.value} turns left`;
  });

  const won = computed(() =>
    props.state.cleared.some((id) => props.tree.nodes[id]?.terminal ?? false),
  );

  function progressFor(nodeId: string, reqIndex: number): number {
    return props.state.progress[nodeId]?.[reqIndex] ?? 0;
  }

  const clearedNames = computed(() =>
    props.state.cleared.map((id) => props.tree.nodes[id]?.name ?? id),
  );

  function selectNode(node: ObjectiveNode): void {
    if (node.requireSameIdeology) {
      const ideology = pendingIdeology[node.id];
      if (!ideology) return; // button is disabled, but guard anyway
      emit("set-active", { nodeId: node.id, ideology });
    } else {
      emit("set-active", { nodeId: node.id });
    }
  }
  </script>

  <style scoped>
  .clock {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
    font-size: 12px;
  }
  .clock-name {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-muted);
  }
  .clock-turns {
    font-weight: 800;
    color: var(--ink);
  }
  .clock.edge .clock-turns {
    color: var(--status-negative);
  }
  .win-badge {
    align-self: flex-start;
    padding: 2px var(--space-2);
    background: var(--status-positive);
    color: var(--paper);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .nodes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .node {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--mat);
  }
  .node.active {
    outline: 2px solid var(--accent);
  }
  .node-select {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .node-select:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .node-name {
    font-weight: 700;
    color: var(--ink);
  }
  .node-branch {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-subtle);
  }
  .node-flag {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    color: var(--status-warning);
    text-transform: uppercase;
  }
  .ideology-pick {
    display: flex;
    gap: var(--space-1);
  }
  .ideology-chip {
    font-size: 10px;
    font-weight: 700;
    padding: 1px var(--space-1);
    background: var(--mat-strong);
    border: 0;
    cursor: pointer;
    color: var(--ink-muted);
  }
  .ideology-chip.chosen {
    background: var(--accent);
    color: var(--paper);
  }
  .recipe {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
  }
  .recipe li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--ink-muted);
  }
  .recipe li.done {
    color: var(--status-positive);
    font-weight: 600;
  }
  .req-upgrade {
    color: var(--ink-subtle);
  }
  .req-count {
    font-variant-numeric: tabular-nums;
  }
  .empty,
  .cleared {
    margin: 0;
    font-size: 11px;
    color: var(--ink-subtle);
  }
  </style>
  ```

- [ ] Run the typecheck gate (this is the only verification — the component isn't imported yet, so `vue-tsc` parsing it is the proof it's valid):
  ```
  bun run typecheck
  ```
  Expected: exits 0. If `vue-tsc` reports an unknown type (e.g. `CrisisTreeState` / `ObjectiveNode` not exported from `core/types.ts`), P1's barrel re-export is missing — stop and confirm P1 landed.

- [ ] Run the test suite (unchanged):
  ```
  bun test
  ```
  Expected: all suites pass.

- [ ] Commit:
  ```
  git add src/renderer/components/game/CrisisObjectivesPanel.vue
  git commit -m "feat(renderer): minimal Crisis objectives panel (available nodes, recipe progress, clock)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 15: Rewire `App.vue` — swap `ScoreMeter` for `CrisisObjectivesPanel`, collapse the points `CrisisBar` region, delete `ScoreMeter.vue`

The integration commit: `App.vue` stops rendering the points-based `ScoreMeter` and the standalone `CrisisBar` points region, and instead renders `CrisisObjectivesPanel` wired to `snapshot.epoch.crisisTree`, `snapshot.availableNodes`, and `setting.crisisTree`. The panel owns the turn clock (Task 2 lifted the math), so `CrisisBar` and its `.crisis-bar-region` are removed, and the dead `ScoreMeter.vue` is deleted. An `onSetActiveObjective` handler calls `game.setActiveObjective`. After this, the live game runs against the Crisis Tree win condition.

**Files:**
- `src/renderer/App.vue` (template `.crisis-bar-region` :36–38, `<ScoreMeter>` :42–46, imports :198–199, add a handler near :390)
- `src/renderer/components/game/CrisisBar.vue` (deleted)
- `src/renderer/components/game/ScoreMeter.vue` (deleted)

Steps:

- [ ] **Confirm the snapshot field for available nodes** (Task 1 verified the name; restate it for this edit). Run:
  ```
  grep -n "availableNodes\|crisisTree" src/facade/GameAPI.ts
  ```
  Expected: `availableNodes` is a field on the `Snapshot` interface and is populated in `snapshot()`. Use `snapshot.value.availableNodes` and `epoch.value.crisisTree` below (these are the computed refs already defined in `App.vue`: `snapshot` at :234, `epoch` at :236, `setting` at :235).

- [ ] In `src/renderer/App.vue`, **remove the points `CrisisBar` region** entirely. Delete lines 36–38:
  ```vue
      <div class="crisis-bar-region">
        <CrisisBar :crisis="setting.crisis" :turn="epoch.turn" :max-turns="setting.rules.maxTurns" />
      </div>
  ```
  (Leave a single blank line between the `.stats-bar` div and `.app-main` if the formatter wants it; `prettier` runs on commit.)

- [ ] In `App.vue`, **replace the `<ScoreMeter>` block** in `<aside class="info-column">`. Change lines 42–46:
  ```vue
          <ScoreMeter
            :crisis="setting.crisis"
            :unlocks="epoch.unlockedProjects"
            :projects="setting.projects"
          />
  ```
  to:
  ```vue
          <CrisisObjectivesPanel
            :state="epoch.crisisTree"
            :available-nodes="snapshot.availableNodes"
            :tree="setting.crisisTree"
            :crisis-name="setting.crisis.name"
            :turn="epoch.turn"
            :max-turns="setting.rules.maxTurns"
            @set-active="onSetActiveObjective"
          />
  ```

- [ ] In `App.vue`, **fix the imports**. Remove the two now-dead imports (lines 198–199):
  ```ts
  import CrisisBar from "./components/game/CrisisBar.vue";
  import ScoreMeter from "./components/game/ScoreMeter.vue";
  ```
  and add the new import in their place:
  ```ts
  import CrisisObjectivesPanel from "./components/game/CrisisObjectivesPanel.vue";
  ```

- [ ] In `App.vue`, **add the `onSetActiveObjective` handler**. The `Ideology` type is already imported (line 204). Insert directly before `function onPromote` (before line 401), after `onBuild`:
  ```ts
  function onSetActiveObjective(payload: { nodeId: string; ideology?: Ideology }): void {
    game.setActiveObjective(payload.nodeId, payload.ideology);
  }
  ```

- [ ] **Delete the two dead components:**
  ```
  git rm src/renderer/components/game/CrisisBar.vue src/renderer/components/game/ScoreMeter.vue
  ```

- [ ] **Confirm nothing else references the deleted components or the old score path.** Run:
  ```
  grep -rn "CrisisBar\|ScoreMeter\|crisis-bar-region" src/
  ```
  Expected: **no output** (every reference removed). If anything remains (e.g. a stray CSS rule for `.crisis-bar-region` in `App.vue`'s `<style>` — re-check; `App.vue` shown has no scoped style block, styles are global, but verify), remove it.

- [ ] Run the typecheck gate:
  ```
  bun run typecheck
  ```
  Expected: exits 0. (`vue-tsc` resolves `CrisisObjectivesPanel` props against the panel's `defineProps`; a prop-name mismatch fails here.)

- [ ] Run the test suite:
  ```
  bun test
  ```
  Expected: all suites pass (unchanged).

- [ ] **Sanity-check the production build compiles** (catches template/runtime resolution `vue-tsc` may miss):
  ```
  bun run build
  ```
  Expected: Vite build completes with no errors (a `dist/` is produced; warnings about chunk size are fine).

- [ ] Commit:
  ```
  git add src/renderer/App.vue
  git commit -m "feat(renderer): swap ScoreMeter/CrisisBar for CrisisObjectivesPanel; delete dead points UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 16: Update `CrisisScreen.vue` — drop the difficulty/total lines, show the cleared-path verdict

The end-of-Epoch screen still reads `crisis.difficulty` (removed in P5) and renders `Total {{ outcome.totalValue }} / {{ crisis.difficulty }}`. Replace the difficulty header line and the points verdict with a Crisis-Tree verdict: win/loss from `outcome.cleared` plus the cleared node path from `outcome.clearedNodeIds`. The unlock-walk (per-build leveled detail) and Legacy choice flow are retained unchanged — `outcome.contributions`/`totalValue` survive per the §7 (b) leveling disposition, so the walk still renders. This is the last renderer reader of `crisis.difficulty`; after it, `grep` for `crisis.difficulty` across `src/` is clean.

**Files:**
- `src/renderer/components/game/CrisisScreen.vue` (`.difficulty` line :6–8, `.verdict` line :24–27, `.difficulty` style rule :126)

Steps:

- [ ] **Confirm the `CrisisOutcome` cleared-path field name P4 added.** Run:
  ```
  grep -n "clearedNodeIds\|cleared\|totalValue\|interface CrisisOutcome" src/core/data/projects.ts
  ```
  Expected: `CrisisOutcome` has `cleared: boolean` (retained) and `clearedNodeIds: string[]` (added in P4), plus retained `totalValue`/`contributions`/`contributingUnlocks`. Use the actual field name if it differs from `clearedNodeIds`.

- [ ] In `src/renderer/components/game/CrisisScreen.vue`, **remove the difficulty header line**. Delete lines 6–8:
  ```vue
        <p class="difficulty">
          Difficulty: <b>{{ crisis.difficulty }}</b>
        </p>
  ```

- [ ] In `CrisisScreen.vue`, **replace the points verdict** (lines 24–27):
  ```vue
        <p class="verdict">
          Total {{ outcome.totalValue }} / {{ crisis.difficulty }} —
          <b>{{ outcome.cleared ? "Cleared" : "Failed" }}</b>
        </p>
  ```
  with a Crisis-Tree verdict that shows the cleared path:
  ```vue
        <p class="verdict">
          <b>{{ outcome.cleared ? "Crisis averted" : "Crisis overwhelmed you" }}</b>
          <template v-if="clearedPath">— {{ clearedPath }}</template>
        </p>
  ```

- [ ] In `CrisisScreen.vue`, **add the `clearedPath` computed** in the `<script setup>` block. Insert after the `nextLabel` computed (after line 87):
  ```ts
  // The cleared node ids carried by the outcome, joined into a readable path.
  // Node names aren't on the outcome (it carries ids), so show the ids — the
  // detailed tree-view (with names) is the deferred §9 UI pass.
  const clearedPath = computed(() => props.outcome.clearedNodeIds.join(" → "));
  ```

- [ ] In `CrisisScreen.vue`, **fix the dead `.difficulty` style selector**. The rule at line 126–130 groups `.difficulty`, `.verdict`, `.ideology`:
  ```css
  .modal.crisis-screen .difficulty,
  .modal.crisis-screen .verdict,
  .modal.crisis-screen .ideology {
    margin: 0;
  }
  ```
  Remove only the now-dead `.difficulty` selector line so the rule becomes:
  ```css
  .modal.crisis-screen .verdict,
  .modal.crisis-screen .ideology {
    margin: 0;
  }
  ```

- [ ] **Confirm `crisis.difficulty` is gone from the renderer** (and the whole `src/`). Run:
  ```
  grep -rn "crisis.difficulty\|\.difficulty" src/renderer/
  ```
  Expected: **no output**. Then broaden:
  ```
  grep -rn "crisis.difficulty" src/
  ```
  Expected: **no output** (P5 removed all core readers; this task removed the last renderer reader).

- [ ] Run the typecheck gate:
  ```
  bun run typecheck
  ```
  Expected: exits 0. (`vue-tsc` flags `Property 'difficulty' does not exist on type 'Crisis'` if any reference was missed, and `Property 'clearedNodeIds' does not exist on type 'CrisisOutcome'` if P4's field name differs — fix to match the grep result above.)

- [ ] Run the test suite:
  ```
  bun test
  ```
  Expected: all suites pass.

- [ ] **Sanity-check the production build:**
  ```
  bun run build
  ```
  Expected: Vite build completes with no errors.

- [ ] Commit:
  ```
  git add src/renderer/components/game/CrisisScreen.vue
  git commit -m "feat(renderer): CrisisScreen shows cleared-path verdict; drop dead difficulty/total lines

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

#### Phase P6 done — verification summary

After Task 4, the renderer is fully migrated to the Crisis Tree win condition:
- `GameService.setActiveObjective` routes through `run()` (snapshot refresh + persist).
- `CrisisObjectivesPanel.vue` shows available nodes, the active recipe with per-requirement progress (`Any build 2/4`), the turn clock, Doctrine ideology binding, cleared path, and a win badge.
- `App.vue` renders the panel in the info column; `ScoreMeter.vue` + `CrisisBar.vue` are deleted; the `.crisis-bar-region` is gone.
- `CrisisScreen.vue` shows the cleared-path verdict, no `difficulty`.
- `grep -rn "crisis.difficulty\|ScoreMeter\|CrisisBar" src/` → empty.
- `bun run typecheck` (vue-tsc over src + tests) and `bun test` are green; `bun run build` compiles. The polished DAG tree-view remains deferred per spec §9.
