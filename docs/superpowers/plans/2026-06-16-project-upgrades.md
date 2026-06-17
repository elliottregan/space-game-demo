# Project Upgrades (M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Repeat-building the same pattern levels its project up with **diminishing** Crisis-value increments instead of farming flat `value × count`. Pair-spam stays viable (the survivable floor) but bends toward diminishing returns, nudging players toward new patterns.

**Architecture:** Mechanic 2 of `docs/superpowers/specs/2026-06-10-column-storage-tech-tree-design.md`. A per-project level curve (`ProjectLevel[]`, default derived from base `value`) drives a pure `projectContribution(project, count)` helper. `resolveCrisis` groups unlocks by project and sums leveled contributions, emitting a per-build `contributions` list on `CrisisOutcome`. Renderer + simulator consume the helper so nothing duplicates the curve.

**Decisions (from design Q&A 2026-06-16):** diminishing increments; **value-only launch** but `ProjectLevel` carries an unused `effect?` placeholder; base storage capacity stays 1 everywhere.

**Tech Stack:** TS core (Bun tests), Vue 3 renderer, `scripts/analyze-crisis.ts` simulator.

**Branch:** `feat/project-upgrades` (off `main`).

---

### Task 1: Level model + contribution helpers (core, TDD)

**Files:**
- Modify: `src/core/data/projects.ts`
- Modify: `src/core/types.ts` (export new types)
- Test: `tests/projects.test.ts` (append)

- [ ] **Step 1: Write failing tests.** Append to `tests/projects.test.ts` (check its existing imports; add what's missing):

```ts
import {
  projectLevels,
  projectContribution,
  marginalContribution,
  type KeystoneProject,
} from "../src/core/data/projects.ts";

const proj = (value: number, levels?: { value: number }[]): KeystoneProject => ({
  id: "t",
  pattern: "pair",
  name: "T",
  flavor: "",
  value,
  ...(levels ? { levels } : {}),
});

describe("project leveling", () => {
  test("default curve: L1 = base, then halving with a floor of 1", () => {
    expect(projectLevels(proj(2)).map((l) => l.value)).toEqual([2, 1, 1]);
    expect(projectLevels(proj(6)).map((l) => l.value)).toEqual([6, 3, 2]);
  });

  test("authored levels override the default", () => {
    expect(projectLevels(proj(5, [{ value: 5 }, { value: 4 }])).map((l) => l.value)).toEqual([
      5, 4,
    ]);
  });

  test("contribution sums increments; tail repeats the last level", () => {
    const p = proj(2); // [2,1,1]
    expect(projectContribution(p, 0)).toBe(0);
    expect(projectContribution(p, 1)).toBe(2);
    expect(projectContribution(p, 2)).toBe(3);
    expect(projectContribution(p, 3)).toBe(4);
    expect(projectContribution(p, 5)).toBe(6); // 2+1+1+1+1
  });

  test("marginal value is the next build's increment", () => {
    const p = proj(2);
    expect(marginalContribution(p, 0)).toBe(2);
    expect(marginalContribution(p, 1)).toBe(1);
    expect(marginalContribution(p, 9)).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`projectLevels` etc. not exported): `bun test tests/projects.test.ts`

- [ ] **Step 3: Implement** in `src/core/data/projects.ts`. Add after the `KeystoneProject` interface:

```ts
export interface ProjectLevel {
  /** Crisis-value increment gained on reaching this level (level 1 = base). */
  value: number;
  /** Reserved for future upgrade effects; unused in the value-only launch. */
  effect?: EffectSpec;
}
```

Add `levels?: ProjectLevel[];` to `KeystoneProject` (after `value`, with a doc comment: `/** Optional authored diminishing curve; defaults derived from value. */`).

Add helpers near the bottom (before `unlockedIdeologyBreakdown` is fine):

```ts
/** The diminishing level curve for a project: authored if present, else a
 *  default of [base, ⌈base/2⌉, ⌈base/4⌉] floored at 1. */
export function projectLevels(project: KeystoneProject): ProjectLevel[] {
  if (project.levels && project.levels.length > 0) return project.levels;
  const base = project.value;
  return [
    { value: base },
    { value: Math.max(1, Math.round(base / 2)) },
    { value: Math.max(1, Math.round(base / 4)) },
  ];
}

/** Total Crisis contribution for building this project `count` times. Level
 *  increments past the authored curve repeat its last entry — the
 *  never-worthless flat tail. */
export function projectContribution(project: KeystoneProject, count: number): number {
  if (count <= 0) return 0;
  const levels = projectLevels(project);
  let total = 0;
  for (let i = 0; i < count; i++) total += levels[Math.min(i, levels.length - 1)].value;
  return total;
}

/** Marginal value of the next build (count → count + 1). For the build AI. */
export function marginalContribution(project: KeystoneProject, currentCount: number): number {
  return projectContribution(project, currentCount + 1) - projectContribution(project, currentCount);
}
```

(`EffectSpec` is already imported in this file.)

- [ ] **Step 4: Export types** in `src/core/types.ts` — add `ProjectLevel` to the `data/projects.ts` type re-export block (alongside `KeystoneProject`).

- [ ] **Step 5: Run — expect PASS** (`bun test`), then commit:

```bash
git add -A && git commit -m "feat(core): project level curve + contribution helpers"
```

---

### Task 2: Leveled Crisis resolution (core, TDD)

**Files:**
- Modify: `src/core/data/projects.ts` (`CrisisOutcome` + new `CrisisContribution`)
- Modify: `src/core/types.ts` (export `CrisisContribution`)
- Modify: `src/core/engine/turn.ts` (`resolveCrisis`)
- Test: `tests/crisisflow.test.ts` (append a direct-resolveCrisis describe)

- [ ] **Step 1: Write failing test.** Append to `tests/crisisflow.test.ts`:

```ts
import { resolveCrisis } from "../src/core/engine/turn.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Epoch, ProjectUnlock } from "../src/core/types.ts";

function epochWithUnlocks(unlocks: ProjectUnlock[]): Epoch {
  return {
    epochNumber: 1,
    settingId: "homeworld",
    turn: 13,
    phase: "crisis",
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
  };
}

const pairUnlock = (turn: number): ProjectUnlock => ({
  projectId: "homeworld-commons", // pattern "pair", base value 2
  pattern: "pair",
  turn,
  cards: [getCard(landId(7, "solidarity"))],
});

describe("Crisis leveling", () => {
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

- [ ] **Step 2: Run — expect FAIL** (`out.contributions` undefined): `bun test tests/crisisflow.test.ts`

- [ ] **Step 3: Implement.** In `src/core/data/projects.ts` add the contribution-detail type and extend the outcome:

```ts
export interface CrisisContribution {
  projectId: string;
  pattern: PatternKind;
  name: string;
  turn: number;
  /** 1-based level this build represents. */
  level: number;
  /** Marginal leveled value this build added. */
  value: number;
}
```

Extend `CrisisOutcome`:

```ts
export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  /** Ordered highest pattern first (reverse of PATTERNS_IN_ORDER), then by turn. */
  contributingUnlocks: ProjectUnlock[];
  /** Per-build leveled detail, same order as contributingUnlocks. */
  contributions: CrisisContribution[];
}
```

Export `CrisisContribution` from `src/core/types.ts` (same block as `CrisisOutcome`).

In `src/core/engine/turn.ts`, import `projectLevels` from `../data/projects.ts` (alongside `reversePatternOrder`), and replace the `resolveCrisis` accumulation loop (the `contributing`/`total` build-up, NOT the early-return or the trailing outcome/dispatch) with:

```ts
  const contributingUnlocks: ProjectUnlock[] = [];
  const contributions: CrisisContribution[] = [];
  let total = 0;
  for (const pattern of order) {
    const unlocks = (byPattern.get(pattern) ?? []).slice().sort((a, b) => a.turn - b.turn);
    const countByProject = new Map<string, number>();
    for (const u of unlocks) {
      const project = setting.projects.find((p) => p.id === u.projectId);
      if (!project) continue;
      const idx = countByProject.get(u.projectId) ?? 0;
      const levels = projectLevels(project);
      const value = levels[Math.min(idx, levels.length - 1)].value;
      countByProject.set(u.projectId, idx + 1);
      total += value;
      contributingUnlocks.push(u);
      contributions.push({
        projectId: u.projectId,
        pattern,
        name: project.name,
        turn: u.turn,
        level: idx + 1,
        value,
      });
    }
  }
```

Then update the `outcome` literal to use `contributingUnlocks` and add `contributions` (the variable previously named `contributing` is gone — make sure the outcome references the new names). Add `CrisisContribution` to the type import in turn.ts if it constructs the objects (it does via the array — the inline objects are structurally typed, but import the type for the array annotation as shown).

- [ ] **Step 4: Run — expect PASS** (`bun test`, full suite — existing crisisflow GameAPI tests still pass since `totalValue`/`cleared`/`contributingUnlocks` are intact), then commit:

```bash
git add -A && git commit -m "feat(core): resolveCrisis sums leveled contributions"
```

---

### Task 3: Renderer — leveled tree + Crisis walk

**Files:**
- Modify: `src/renderer/util/projectTree.ts` (+test `tests/projectTree.test.ts`)
- Modify: `src/renderer/components/game/ProjectTreePanel.vue`
- Modify: `src/renderer/components/game/CrisisScreen.vue`

- [ ] **Step 1: Extend the view-model (TDD).** In `tests/projectTree.test.ts`, the fixture PROJECTS use `value = i + 1`. Append:

```ts
  test("built nodes carry leveled contributed value", () => {
    // pair is index 1 → base value 2 → levels [2,1,1]
    const nodes = buildProjectTree(PROJECTS, [unlock("pair", 1), unlock("pair", 2)]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.buildCount).toBe(2);
    expect(pair?.contributedValue).toBe(3); // 2 + 1
  });
```

Then in `src/renderer/util/projectTree.ts`: add `contributedValue: number` to `ProjectTreeNode`, import `projectContribution` from `../../core/data/projects.ts`, and set `contributedValue: builds.length > 0 ? projectContribution(project, builds.length) : 0` in the node.

- [ ] **Step 2: Run — expect PASS** (`bun test tests/projectTree.test.ts`).

- [ ] **Step 3: ProjectTreePanel display.** In `src/renderer/components/game/ProjectTreePanel.vue`, for built nodes show the contributed value (and keep the ×N badge). Change the `.node-count` / requirement line so a built node reads e.g. `Pair · +3` (contributedValue) with `×2` when buildCount > 1, while unbuilt stays `Pair · +{value}`. Concretely: when `node.built`, render `{{ node.requirement }} · +{{ node.contributedValue }}` in `.node-req`; else `{{ node.requirement }} · +{{ node.value }}`. Keep the `×N` badge for `buildCount > 1`.

- [ ] **Step 4: CrisisScreen leveled walk.** In `src/renderer/components/game/CrisisScreen.vue`, replace the `contributingUnlocks`-based walk with `outcome.contributions`:
  - `const walk = computed(() => props.outcome.contributions);`
  - row template: key `c.projectId + '@' + c.turn`; show `patternLabel(c.pattern)`, `c.name`, `+{{ c.value }}`, and the running total.
  - `runningTotals` sums `c.value` over `walk`.
  - Optionally show `L{{ c.level }}` when `c.level > 1`.
  - Delete the now-unused `projectName` / `projectValue` helpers if nothing else uses them (check first). The final running total must equal `outcome.totalValue` — add nothing else.

- [ ] **Step 5: Verify + commit.** `bun run typecheck && bun test`:

```bash
git add -A && git commit -m "feat(renderer): show leveled contribution in tree panel and Crisis walk"
```

---

### Task 4: Simulator marginal-value build choice + re-baseline

**Files:**
- Modify: `scripts/analyze-crisis.ts`
- Modify (only if guidance changes): `.claude/skills/run-simulation/SKILL.md`
- Possibly modify: the three `settings/*.ts` `crisis.difficulty` (ONLY if re-baseline demands it — see step 3)

- [ ] **Step 1: Marginal-value build choice.** In `scripts/analyze-crisis.ts` step 1 (build the buildable column with the highest project value), change "highest `value`" to "highest **marginal** contribution." Import `marginalContribution` from `../src/core/data/projects.ts`. For each buildable column, compute `currentCount = snapshot.epoch.unlockedProjects.filter(u => u.projectId === match.projectId).length` and score it `marginalContribution(project, currentCount)` where `project = snapshot.setting.projects.find(p => p.id === match.projectId)`. Build the highest-scoring column. (Everything else in the policy stays.)

- [ ] **Step 2: typecheck** (`bun run typecheck`) — script is type-checked.

- [ ] **Step 3: Re-baseline and decide on difficulty.** Run, for each setting, 500 runs at offset 0 AND offset 1000 (independent set — offset ≥ runs):

```bash
for s in homeworld generation-ship ruined-homeworld; do
  bun run scripts/analyze-crisis.ts 500 $s 0    | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['setting'],'off0',f\"{d['winRate']:.0%}\",'margin',d['margin']['mean'])"
  bun run scripts/analyze-crisis.ts 500 $s 1000 | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['setting'],'off1k',f\"{d['winRate']:.0%}\",'margin',d['margin']['mean'])"
done
```

Leveling lowers spam-heavy totals, so win rates will likely drop. **Decision rule:** if a setting's win rate falls below ~75% on both seed sets, lower that setting's `crisis.difficulty` (in `settings/<scenario>.ts`) just enough to bring it back toward ~80%, then re-run to confirm. If win rates stay in 78–90%, leave difficulties alone. Record the before/after numbers in the commit message and the PR. This is a legitimate retune — the contribution model changed (unlike M1).

- [ ] **Step 4: Skill note.** The run-simulation skill's policy bullet says the AI "builds best column" — update "best" to "highest **marginal** (leveled) value" so it stays accurate. No volatile numbers in the skill.

- [ ] **Step 5: Commit.**

```bash
git add -A && git commit -m "feat(sim): build choice uses marginal leveled value; re-baseline (M3)"
```

---

### Task 5: Docs + final review + PR

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-06-10-column-storage-tech-tree-design.md`

- [ ] **Step 1: CLAUDE.md.** Update the Crisis invariant bullet: Crisis now sums each unlocked project's **leveled** contribution — repeat builds of a pattern add diminishing increments (level 1 = full value; later levels taper to a never-worthless flat tail), not flat `value × count`. Note the `projectContribution` helper in the `data/projects.ts` description line.

- [ ] **Step 2: Spec.** In `docs/superpowers/specs/2026-06-10-column-storage-tech-tree-design.md`: mark M3 done in the Phasing table; under Mechanic 2 record the resolved decisions (diminishing curve `[base, ⌈base/2⌉, ⌈base/4⌉]` floor 1; value-only launch with an `effect?` placeholder on `ProjectLevel`; base capacity unchanged at 1; resolve open question #4 to "value-only for now"). Resolve open question #2 → "keep 1".

- [ ] **Step 3: Final gates.** `bun run typecheck && bun test && bun run lint` (13 pre-existing warnings OK).

- [ ] **Step 4: Push + PR.**

```bash
git push -u origin feat/project-upgrades
gh pr create --base main --title "feat: project upgrades (M3) — leveled, diminishing Crisis contribution" --body "<summary + before/after baselines + decisions + simulator note>"
```

---

## Out of scope (per spec / decisions)

- Upgrade **effects** (storage capacity, keep-a-card, influence trickle) — `ProjectLevel.effect` is a placeholder only; wiring deferred.
- Soft gates / tiers (M4); endings (M5).
- Per-Setting base capacity (kept flat at 1).
