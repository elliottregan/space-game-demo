# Crisis Tree — Phased, Branching Win Condition

**Date:** 2026-06-18
**Status:** Draft (design)
**Summary:** Replace the single cumulative-points Crisis threshold with a **Crisis Tree** — a directed acyclic graph of build objectives. The player races an always-ticking turn clock down a path: a shared root gate (basic infrastructure), then a fork into branch victory conditions tied to different hand strategies. "Currency" = your builds, typed by pattern; each node is a recipe you fill by building. Reaching a terminal victory node before the clock runs out is the win.

> Builds on the implemented two-row + joker-wilds + count-scaled-promotion mechanics (branch `feat/two-row-tableau-wilds`). This spec changes only the **goal/win-condition** layer, not how columns are built.

---

## 1. Motivation

The current win condition is `total leveled project value >= crisis.difficulty` (`turn.ts:143`) — one fungible number (~16–23 today, ~95 to be "balanced"). Problems, confirmed by simulation:

- **A single sum is flat.** Every pattern converts to the same fungible point, so the rich differences between flush / straight / tall / monoculture strategies are invisible to the goal — strategy can't *be* a win-condition choice.
- **Raising the number adds grind, not tension.** Flush-rush is immune to scale (clears in 1–2 turns regardless of threshold), so a bigger number just makes the *other* strategies slog while the degenerate line stays king.
- **No goal-shift, no planning horizons.** "Reach 95" is one undifferentiated objective; there's no near-term vs. long-term decision texture.

The fix is **structure** (phases/horizons) + **composition** (specific demands), so *what* you build matters, not just *how much* — and so the looming Crisis offers a *choice of how to win*.

---

## 2. Core concept: the Crisis Tree

A Setting's Crisis is a **DAG of objective nodes**.

- **Node** = an objective: a *recipe* of specific built patterns (e.g. "4× two-pair + 4× high-card", "1× straight + 1× two-pair").
- **Edge** = an unlock dependency: clearing a node makes its children available. The single **root** gates everything — everyone plays the shared opening before any branch opens.
- **Branches** = the fork. The root unlocks several mid-tier nodes (the victory paths); the player can realistically only clear the root **+ one branch** before the clock, so *which branch* is the strategic choice.
- **Terminal node** = a victory condition. Reaching any terminal before the turn cap wins the Crisis.

"Currency" is subsumed and made concrete: your **builds are the currency, typed by pattern/ideology**, and a node is a recipe you pay with builds. No new card data — the recipe vocabulary is the existing 10-pattern ladder + ideology.

### Active-objective model (chosen: model A)

The player works **one unlocked node at a time** — the **active objective** (like researching one tech at a time):

- Builds whose pattern matches the active node's recipe **advance that node's progress**.
- Each node retains its own progress; the player may **switch** the active objective among unlocked nodes at will (progress already banked on a node is not lost).
- A build whose pattern is not in the active node's recipe does not advance it (it still happens on the board, mints any policy/ideology effects as today, but doesn't count toward the active goal) — so the player is incentivized to build *what the active node needs*.

This makes the tree a genuine **race-allocation puzzle**: limited turns, choose which node to spend them on.

### The clock

The Crisis counter is **always ticking** — it is the existing turn cap (`rules.maxTurns`). The Crisis resolves when `turn > maxTurns`:
- A terminal victory node already cleared → **win**.
- No terminal cleared → **loss** (you didn't survive in time).

Deeper / harder terminals are reachable only by clearing more of the tree first; reaching a deeper terminal mints a **larger Legacy** (a natural push-your-luck lever — keep racing for a bigger reward vs. lock in the safe win). v1 may ship with flat-Legacy terminals and add tiering later.

---

## 3. The three branches (strategy → win condition)

The root unlocks three branch paths, each filled by a different play style. The mapping is the payoff for the strategy diversity the build mechanics already produce:

| Branch | Recipe leans on | Strategy that affords it |
|---|---|---|
| **Expansion** | raw **volume** of any projects | rush / tall (many cheap builds) |
| **Doctrine** | many projects of a **single ideology** (uses the promoted color) | monoculture |
| **Wonder** | a few **high-tier** patterns + **upgrades** | flush / straight specialists |

- **Doctrine** is where the **policy engine finally gets a job**: it is the same per-color concentration the count-scaled promotion already measures. Today's "policy flood from easy builds" stops being noise and becomes this path's fuel. (v1: Doctrine counts one-ideology builds; *wiring policy strength into the Doctrine requirement is an explicit later option, §8 — not v1 scope.*)
- **Wonder** absorbs the **"build twice = upgrade"** idea: rebuilding a project counts as upgrading it (see §5), and Wonder recipes call for upgraded/high-tier builds.

A flush-rusher ends up able to afford **Wonder** but not **Expansion** (too few builds) — strategy becomes a wallet, and the **flush-rush degenerate line is structurally blocked**: it cannot fill the root's *spread* of basic infrastructure on turn 1, so it has to actually play the game.

---

## 4. Data model (core, pure TS)

New module `src/core/engine/crisisTree.ts` (types + pure progress logic), with the tree authored per Setting.

```ts
// A recipe entry: a build COUNT of a matching pattern. (Counts builds, not value.)
interface ObjectiveRequirement {
  pattern: PatternKind | "any";  // a specific rung, or "any" for volume nodes
  count: number;                 // how many matching builds the node needs
  upgrade?: boolean;             // build must be an UPGRADE — the 2nd+ build of its
                                 // project id this Epoch (Wonder "build twice"); see §5
}

interface ObjectiveNode {
  id: string;
  name: string;
  branch: "establish" | "expansion" | "doctrine" | "wonder";
  requirements: ObjectiveRequirement[];   // ALL must be met to clear
  // Doctrine nodes: when activated the player BINDS a target ideology, and this
  // node's requirements only count builds promoted to that color (any one of the
  // four — the player's choice). Keeps "5× one ideology" expressible without a
  // pre-fixed color, and keeps per-requirement progress a single number.
  requireSameIdeology?: boolean;
  unlocks: string[];                       // child node ids unlocked on clear
  terminal: boolean;                       // clearing it = a victory
  legacyTier?: number;                     // bigger Legacy for deeper terminals (optional v1)
}

interface CrisisTree {
  rootId: string;                          // the single Establish gate
  nodes: Record<string, ObjectiveNode>;
}
```

Runtime state lives on the Epoch (so it's saved + drives the renderer):

```ts
interface CrisisTreeState {
  activeNodeId: string | null;             // the player's current focus
  cleared: string[];                       // cleared node ids
  // progress[nodeId][requirementIndex] = builds counted so far toward it
  progress: Record<string, number[]>;
  // bound target color for each activated requireSameIdeology (Doctrine) node
  boundIdeology: Record<string, Ideology>;
}
```

Pure helpers in `crisisTree.ts`:
- `availableNodes(tree, state)` — unlocked (root, or any node all of whose parents are cleared) and not yet cleared.
- `applyBuild(tree, state, unlock, projectBuildCount)` — when a `buildColumn` succeeds, advance the **active** node by 1 for each requirement the build matches, where a build matches requirement `r` iff: `(r.pattern === "any" || unlock.pattern === r.pattern)` **and** `(!r.upgrade || projectBuildCount >= 2)` (it's the 2nd+ build of this project id) **and** (the node is not `requireSameIdeology`, or `unlock.promotedIdeology === boundIdeology[node]`). Marks the node `cleared` + appends its `unlocks` when every requirement reaches its `count`. Pure; returns new state. (`projectBuildCount` = how many times this `projectId` has been built this Epoch, including this build.)
- `isWon(tree, state)` — any cleared node is `terminal`.

Commands: `setActiveObjective(nodeId, ideology?)` — selects an available node as active; for a `requireSameIdeology` node it also records `boundIdeology[nodeId] = ideology` (required for those nodes). Switching is free; per-node progress and bindings persist.

`Epoch` gains `crisisTree: CrisisTreeState`; the `Setting` gains `crisisTree: CrisisTree` (replacing the scalar `crisis.difficulty`). `createEpoch` seeds `CrisisTreeState` with `activeNodeId = rootId`, empty `cleared`, zeroed `progress`.

---

## 5. Mechanics & integration

- **Build hook.** `buildColumn` already returns the `ProjectUnlock` (pattern + promotedIdeology). On a successful build, the harness calls `applyBuild` to advance the active objective. This is the *only* coupling between the build loop and the goal layer.
- **Selecting / switching the active objective.** The `setActiveObjective(nodeId, ideology?)` command (§4) makes an available node active; a `requireSameIdeology` (Doctrine) node also binds its target color. Switching is free and retains per-node progress + bindings.
- **Upgrades ("build twice").** Rebuilding the *same project id* is reframed from "diminishing leveled value" to an **upgrade**: a requirement `{ pattern: "flush", count: 1, upgrade: true }` is satisfied by the 2nd build of a flush project id (its `projectBuildCount >= 2`). The existing `projectLevels`/diminishing-value machinery is **repurposed or retired** here (see §7).
- **Crisis resolution.** `resolveCrisis` (`turn.ts`) is rewritten: instead of `total >= difficulty`, the outcome is `isWon(tree, state)`. `CrisisOutcome` carries the cleared path (for Legacy minting + the end screen) instead of `totalValue`.
- **Loss is real and reachable now.** Because the root demands a spread the player must assemble within the clock, losing is possible (good — today's win rate is ~100%).

---

## 6. Strawman trees (illustrative — recipes are balance-pending)

Exact counts are **to be tuned with the simulator** (§8); these show the *shape*. Homeworld (12 turns, 7 columns):

```
Settlement (root, establish)  reqs: [{two-pair, 4}, {high-card, 4}]
   ├── Industry  (expansion, terminal)  reqs: [{any, 8}]
   ├── Capital   (doctrine,  terminal)  requireSameIdeology; reqs: [{any, 5}]   (player binds the color on activation)
   └── Monument  (wonder,    terminal)  reqs: [{straight, 1}, {two-pair, 1}, {flush, 1, upgrade}]
```

Generation Ship (14 turns, 4 columns, 2-ideology deck) and Ruined Homeworld (16 turns, 5 columns) each get their own tree, sized to their column count / turn budget / deck (e.g. the Ship's mono-ideology deck makes its Doctrine branch cheaper and its tall-dependent nodes harder — mirroring the strategy data we measured). Deeper non-terminal nodes (a capstone past a branch terminal, for a bigger Legacy) are an optional v1 addition.

---

## 7. What this replaces / repurposes

- **Replaced:** `setting.crisis.difficulty` (scalar) → `setting.crisisTree`. `resolveCrisis`'s `total >= difficulty` → `isWon`. The per-Setting difficulty re-baseline effort is **moot** — there's no single number to tune; balance moves into tree recipes.
- **Repurposed / decided at plan time:** the leveled diminishing-value system (`projectLevels`, `projectContribution`, `marginalContribution`). The tree counts *builds*, not summed value, so per-build value no longer feeds the win condition. Options (resolve in the plan): (a) retire it; (b) keep it only for **Monument record / Legacy magnitude**; (c) fold it into the upgrade mechanic. Recommendation: (b)+(c).
- **Unchanged:** the entire column-build mechanic (two rows, joker wilds, promotion, policy draws), Monuments, Legacy carry-over, the turn/phase machinery.

---

## 8. Open / balance items (explicit, not blocking the design)

1. **Recipe counts per Setting** — tune via the simulator so each branch is *reachable by its strategy and not by the others*, and the root meaningfully gates. The strategy explorer (`explore-strategies.ts`, now strategy-pluggable) is the tuning tool: a good tree shows each strategy clearing a *different* branch fastest, and flush-rush no longer winning in 1–2 turns.
2. **Policy ↔ Doctrine wiring** — v1 counts one-ideology builds; a later version could make Doctrine require policy strength (giving policy real teeth). Out of v1 scope.
3. **Legacy tiering** by terminal depth (push-your-luck) — optional v1.
4. **Leveling disposition** — §7 (b)+(c) recommended; confirm at plan time.

---

## 9. Renderer (high-level)

The points meter / `CrisisBar` is replaced by a **Crisis Tree view**: the DAG with cleared/available/locked node states, the active objective highlighted with its recipe + progress (e.g. "two-pair 2/4"), and the turn clock. Selecting an available node sets it active. Detailed UI is a separate design pass; the core mechanic (this spec) is renderer-agnostic and fully testable in `core/`.

---

## 10. Out of scope

- New card types or non-ideology/non-tier resources (rejected as boil-the-ocean).
- Cross-Epoch tree progression / a campaign-level tech tree (this is per-Epoch).
- The detailed tree-view UI (separate design).
- Re-tuning the column mechanics — unchanged.
