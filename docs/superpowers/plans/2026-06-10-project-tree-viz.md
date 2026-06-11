# Project Tree Visualization (M0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hidden "Keystone projects" rail flyout with an always-visible project ladder — every project shown as a goal node (dimmed + pattern requirement when unbuilt, lit + build count when built), royal-flush at top, high-card at bottom.

**Architecture:** Renderer-only (M0 of `docs/superpowers/specs/2026-06-10-column-storage-tech-tree-design.md`). A pure view-model function (`buildProjectTree`) derives ladder nodes from `setting.projects` + `epoch.unlockedProjects`; a new `ProjectTreePanel.vue` renders it as a docked column between the left rail and the play area. The old `UnlockedProjectsPanel` flyout, its rail entry, and the now-unused `Snapshot.ideologyBreakdown` field are deleted. Zero core changes.

**Tech Stack:** Vue 3 SFC (`<script setup>`), TypeScript, Bun test runner (pure-TS view-model only — there is no Vue component test infra in this repo), CSS in `theme.css` `@layer layout` + scoped SFC styles.

**Conventions you must follow** (from CLAUDE.md): strict `core/ → facade/ → renderer/` layering (renderer may import core *types* and pure data helpers — existing components already do); pre-commit hooks run oxlint + prettier + `vue-tsc` automatically; never push `--force`.

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Create the feature branch from up-to-date main**

```bash
cd /Users/elliott/Projects/space-game-demo
git checkout main && git pull && git checkout -b feat/project-tree-panel
```

Expected: `Switched to a new branch 'feat/project-tree-panel'`

---

### Task 1: View-model — `buildProjectTree`

**Files:**
- Create: `src/renderer/util/projectTree.ts`
- Test: `tests/projectTree.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/projectTree.test.ts` with exactly:

```ts
import { describe, test, expect } from "bun:test";
import { buildProjectTree } from "../src/renderer/util/projectTree.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import { PATTERNS_IN_ORDER } from "../src/core/data/projects.ts";
import type { KeystoneProject, ProjectUnlock } from "../src/core/types.ts";

const PROJECTS: KeystoneProject[] = PATTERNS_IN_ORDER.map((pattern, i) => ({
  id: `test-${pattern}`,
  pattern,
  name: `Project ${pattern}`,
  flavor: "",
  value: i + 1,
}));

function unlock(pattern: ProjectUnlock["pattern"], turn: number): ProjectUnlock {
  return {
    projectId: `test-${pattern}`,
    pattern,
    turn,
    cards: [getCard(landId(7, "solidarity"))],
  };
}

describe("buildProjectTree", () => {
  test("returns one node per authored project, in PATTERNS_IN_ORDER", () => {
    const nodes = buildProjectTree(PROJECTS, []);
    expect(nodes.length).toBe(PATTERNS_IN_ORDER.length);
    expect(nodes.map((n) => n.pattern)).toEqual(PATTERNS_IN_ORDER);
  });

  test("unbuilt nodes are dimmed goals: built=false, count=0, no turn", () => {
    const nodes = buildProjectTree(PROJECTS, []);
    for (const n of nodes) {
      expect(n.built).toBe(false);
      expect(n.buildCount).toBe(0);
      expect(n.firstBuiltTurn).toBeNull();
    }
  });

  test("built node carries count and earliest build turn", () => {
    const nodes = buildProjectTree(PROJECTS, [unlock("pair", 5), unlock("pair", 3)]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.built).toBe(true);
    expect(pair?.buildCount).toBe(2);
    expect(pair?.firstBuiltTurn).toBe(3);
    const flush = nodes.find((n) => n.pattern === "flush");
    expect(flush?.built).toBe(false);
  });

  test("carries the project name, value, and a human requirement label", () => {
    const nodes = buildProjectTree(PROJECTS, []);
    const straight = nodes.find((n) => n.pattern === "straight");
    expect(straight?.name).toBe("Project straight");
    expect(straight?.value).toBe(PROJECTS.find((p) => p.pattern === "straight")!.value);
    expect(straight?.requirement).toBe("Straight");
  });

  test("skips patterns with no authored project", () => {
    const partial = PROJECTS.filter((p) => p.pattern !== "royal-flush");
    const nodes = buildProjectTree(partial, []);
    expect(nodes.find((n) => n.pattern === "royal-flush")).toBeUndefined();
    expect(nodes.length).toBe(PATTERNS_IN_ORDER.length - 1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bun test tests/projectTree.test.ts
```

Expected: FAIL — `Cannot find module '../src/renderer/util/projectTree.ts'` (or equivalent resolve error).

- [ ] **Step 3: Implement the view-model**

Create `src/renderer/util/projectTree.ts` with exactly:

```ts
// Pure view-model for the project tree panel (tech tree v0).
// Derives ladder nodes from a Setting's projects + the Epoch's unlocks.

import type { KeystoneProject, PatternKind, ProjectUnlock } from "../../core/types.ts";
import { PATTERNS_IN_ORDER } from "../../core/data/projects.ts";
import { patternLabel } from "./labels.ts";

export interface ProjectTreeNode {
  pattern: PatternKind;
  name: string;
  value: number;
  /** Human-readable pattern requirement, e.g. "Straight". */
  requirement: string;
  built: boolean;
  buildCount: number;
  firstBuiltTurn: number | null;
}

export function buildProjectTree(
  projects: KeystoneProject[],
  unlocks: ProjectUnlock[],
): ProjectTreeNode[] {
  const nodes: ProjectTreeNode[] = [];
  for (const pattern of PATTERNS_IN_ORDER) {
    const project = projects.find((p) => p.pattern === pattern);
    if (!project) continue;
    const builds = unlocks.filter((u) => u.pattern === pattern);
    nodes.push({
      pattern,
      name: project.name,
      value: project.value,
      requirement: patternLabel(pattern),
      built: builds.length > 0,
      buildCount: builds.length,
      firstBuiltTurn: builds.length > 0 ? Math.min(...builds.map((u) => u.turn)) : null,
    });
  }
  return nodes;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
bun test tests/projectTree.test.ts
```

Expected: `5 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/util/projectTree.ts tests/projectTree.test.ts
git commit -m "feat(renderer): project-tree view model for tech tree v0"
```

(Pre-commit hooks run lint/format/typecheck — they must pass.)

---

### Task 2: `ProjectTreePanel.vue`

**Files:**
- Create: `src/renderer/components/game/ProjectTreePanel.vue`

There is no Vue test runner in this repo; this task is verified by `vue-tsc` (Task 2 step 2) and visually in Task 4.

- [ ] **Step 1: Create the component**

Create `src/renderer/components/game/ProjectTreePanel.vue` with exactly:

```vue
<template>
  <Panel class="project-tree" :title="`Projects (${builtCount}/${nodes.length})`">
    <div class="tree-list">
      <div
        v-for="node in displayNodes"
        :key="node.pattern"
        class="tree-node"
        :class="{ built: node.built }"
      >
        <span class="node-mark" :class="{ filled: node.built }"></span>
        <div class="node-body">
          <span class="node-name">{{ node.name }}</span>
          <span class="node-req">{{ node.requirement }} · +{{ node.value }}</span>
        </div>
        <span v-if="node.buildCount > 1" class="node-count">×{{ node.buildCount }}</span>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { KeystoneProject, ProjectUnlock } from "../../../core/types.ts";
import Panel from "../core/Panel.vue";
import { buildProjectTree } from "../../util/projectTree.ts";

const props = defineProps<{
  projects: KeystoneProject[];
  unlocks: ProjectUnlock[];
}>();

const nodes = computed(() => buildProjectTree(props.projects, props.unlocks));
// Ladder reads top-down from aspiration to floor: royal-flush first.
const displayNodes = computed(() => [...nodes.value].reverse());
const builtCount = computed(() => nodes.value.filter((n) => n.built).length);
</script>

<style scoped>
.tree-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
  min-height: 0;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--mat-strong);
  opacity: 0.55;
}
.tree-node.built {
  opacity: 1;
  border-left: 3px solid var(--accent);
}
/* status glyph, not a container — matches the panel-mark idiom */
.node-mark {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  background: transparent;
  border: 1px solid var(--ink-subtle);
}
.node-mark.filled {
  background: var(--accent);
  border-color: var(--accent);
}
.node-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.node-name {
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.node-req {
  font-size: 0.75rem;
  color: var(--ink-subtle);
}
.node-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
</style>
```

Notes baked into this design: unbuilt nodes show their pattern requirement and value (the "goal" framing from the spec); the old panel's per-unlock ideology glyphs are intentionally dropped — ideology has its own display, and the tree is about goals.

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: clean (the component is not yet imported anywhere; `vue-tsc` still checks it).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/game/ProjectTreePanel.vue
git commit -m "feat(renderer): ProjectTreePanel — always-visible project ladder"
```

---

### Task 3: Integrate into the app layout

**Files:**
- Modify: `src/renderer/App.vue` (template ~lines 33–95, imports, `leftRailItems`)
- Modify: `src/renderer/theme.css` (`.app-main` grid, ~line 282)

- [ ] **Step 1: Mount the panel in `App.vue`**

In `src/renderer/App.vue`, inside `.app-main`, the current structure starts:

```html
    <div class="app-main">
      <Rail side="left" :items="leftRailItems" :active-key="leftRailActive" @toggle="toggleLeft" />

      <div class="play-area">
```

Insert the tree panel between the left `Rail` and `.play-area`:

```html
    <div class="app-main">
      <Rail side="left" :items="leftRailItems" :active-key="leftRailActive" @toggle="toggleLeft" />

      <ProjectTreePanel :projects="setting.projects" :unlocks="epoch.unlockedProjects" />

      <div class="play-area">
```

- [ ] **Step 2: Remove the projects flyout from the template**

Delete this whole block from `App.vue` (the first left-rail `RailFlyout`):

```html
        <RailFlyout
          v-if="leftRailActive === 'projects'"
          side="left"
          title="Keystone projects"
          @close="leftRailActive = null"
        >
          <UnlockedProjectsPanel
            :unlocks="epoch.unlockedProjects"
            :projects="setting.projects"
            :breakdown="snapshot.ideologyBreakdown"
          />
        </RailFlyout>
```

The next flyout begins `v-else-if="leftRailActive === 'crisis'"` — change that `v-else-if` to `v-if` (it's now the first branch).

- [ ] **Step 3: Update imports and rail items in `App.vue`'s script**

Replace:

```ts
import UnlockedProjectsPanel from "./components/game/UnlockedProjectsPanel.vue";
```

with:

```ts
import ProjectTreePanel from "./components/game/ProjectTreePanel.vue";
```

And in `leftRailItems`, delete the projects entry so it reads:

```ts
const leftRailItems: RailItem[] = [
  { key: "crisis", label: "Crisis counter", icon: "crisis" },
  { key: "ideology", label: "Ideology", icon: "ideology" },
];
```

- [ ] **Step 4: Add the grid column in `theme.css`**

In `@layer layout`, change `.app-main` (currently `grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--rail-width);`) to:

```css
  .app-main {
    display: grid;
    grid-template-columns: var(--rail-width) 200px minmax(0, 1fr) var(--rail-width);
    overflow: hidden;
    min-height: 0;
  }

  .project-tree {
    border-right: 1px solid var(--rule-strong);
    overflow: hidden;
    min-height: 0;
  }
```

- [ ] **Step 5: Typecheck and run the full suite**

```bash
bun run typecheck && bun test
```

Expected: typecheck clean; all tests pass (107: 102 existing + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/App.vue src/renderer/theme.css
git commit -m "feat(renderer): dock project tree panel; retire projects flyout"
```

---

### Task 4: Delete the dead surface

**Files:**
- Delete: `src/renderer/components/game/UnlockedProjectsPanel.vue`
- Modify: `src/renderer/components/shell/RailIcon.vue` (remove `projects` icon + union member)
- Modify: `src/facade/GameAPI.ts` (remove `ideologyBreakdown` from `Snapshot`)

- [ ] **Step 1: Confirm nothing else references the deletions**

```bash
grep -rn "UnlockedProjectsPanel" src/
grep -rn "snapshot.ideologyBreakdown\|ideologyBreakdown:" src/renderer src/facade
grep -rn "\"projects\"\|'projects'" src/renderer/components/shell/
```

Expected: `UnlockedProjectsPanel` — no hits (import was removed in Task 3). `ideologyBreakdown` — only the `Snapshot` interface field and its assignment in `GameAPI.snapshot()` (CrisisScreen uses `eoe.ideologyBreakdown` from `EndOfEpochState`, which stays). `projects` icon — only RailIcon's own definition. **If any other hit appears, stop and resolve it before deleting.**

- [ ] **Step 2: Delete the component**

```bash
rm src/renderer/components/game/UnlockedProjectsPanel.vue
```

- [ ] **Step 3: Remove the projects icon from `RailIcon.vue`**

Delete this template block:

```html
    <!-- Keystone Projects: filled five-point star -->
    <polygon
      v-if="name === 'projects'"
      points="12,3 14.7,9.3 21.5,9.9 16.4,14.4 18,21 12,17.4 6,21 7.6,14.4 2.5,9.9 9.3,9.3"
      fill="currentColor"
      stroke="none"
    />
```

The next `<template v-else-if="name === 'crisis'">` becomes `<template v-if="name === 'crisis'">`. Remove `| "projects"` from the `RailIconName` union.

- [ ] **Step 4: Remove `ideologyBreakdown` from the facade snapshot**

In `src/facade/GameAPI.ts`: delete the `ideologyBreakdown` field from the `Snapshot` interface, delete the `ideologyBreakdown: unlockedIdeologyBreakdown(this.epoch.unlockedProjects),` line in `snapshot()`, and remove the now-unused `unlockedIdeologyBreakdown` import (verify with the typecheck — `prepareEndOfEpoch` in core still uses its own import).

- [ ] **Step 5: Typecheck, test, commit**

```bash
bun run typecheck && bun test
git add -A
git commit -m "refactor(renderer): delete UnlockedProjectsPanel, projects rail icon, unused snapshot field"
```

Expected: clean / all pass.

---

### Task 5: Visual verification + PR

**Files:** none

- [ ] **Step 1: Run the app and verify by eye**

```bash
bun run dev
```

At http://localhost:5173 check: (1) tree panel docked left of the tableau, 10 nodes, royal-flush at top; (2) all nodes dimmed at game start showing "Pattern · +value"; (3) play a column to a pair and Build — "The Commons" lights with the accent edge and the counter ticks to 1/10; (4) build a second pair — `×2` badge appears; (5) left rail now has only Crisis/Ideology entries and both flyouts still open; (6) no horizontal overflow at a narrow window width.

- [ ] **Step 2: Final gate**

```bash
bun run typecheck && bun test && bun run lint
```

Expected: all clean. (This is renderer-only — `analyze-crisis.ts` numbers are unaffected by design; do not re-tune.)

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/project-tree-panel
gh pr create --title "feat: always-visible project tree panel (tech tree v0)" --body "$(cat <<'EOF'
## Summary
M0 of docs/superpowers/specs/2026-06-10-column-storage-tech-tree-design.md: the Setting's project list becomes an always-visible goal ladder docked beside the tableau — unbuilt projects show their pattern requirement and value, built ones light up with build counts. Replaces the Keystone-projects rail flyout (UnlockedProjectsPanel deleted). Renderer-only; zero core changes; no balance impact.

## Test plan
- bun test (107 pass) — new pure view-model tests in tests/projectTree.test.ts
- bun run typecheck / lint clean
- Manual: verified ladder states at game start, after first build, after repeat build

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (per spec phasing)

- Column storage (M1), simulator heuristic (M2), project upgrade levels (M3), soft gates/tiers (M4), endings (M5).
- Crisis-screen tile styling, build animations, dedicated tree page — polish that waits for the tree to prove itself.
