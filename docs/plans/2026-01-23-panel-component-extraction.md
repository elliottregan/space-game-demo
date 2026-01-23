# Panel Component Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract large panel components into dedicated directories with sub-components, following the PoliticsPanel pattern.

**Architecture:** Each panel component moves to its own directory with an index.ts barrel export. Large components are broken into logical sub-components (sections, cards, lists). Import paths are updated in consuming files.

**Tech Stack:** Vue 3 SFCs, TypeScript, Vite

---

## Panel Analysis

| Panel | Lines | Complexity | Sub-components to Extract |
|-------|-------|------------|---------------------------|
| NPCInfluencePanel | 492 | High | ActiveProposal, NPCList, LobbyControls, ProjectList, CouncilSection |
| BuildingPanel | 401 | High | CategoryTabs, BuildingCard, ConstructionQueue |
| TechnologyPanel | 373 | Medium | CurrentResearch, TechCard, TechSection |
| OperationsPanel | 303 | Medium | PoliciesTab, BuildingsTab, MissionsTab |
| ColonyPanel | 181 | Low | StatRow, WorkforceGrid |
| ResourcePanel | 128 | Low | ResourceItem (already simple, skip extraction) |

## Worktree Setup

Before starting, create an isolated worktree:

```bash
cd /workspace
git worktree add .worktrees/panel-extraction -b feature/panel-component-extraction
cd .worktrees/panel-extraction
bun install
bun test
```

---

## Task 1: NPCInfluencePanel Extraction

**Files:**
- Create: `src/renderer/components/NPCInfluencePanel/ActiveProposal.vue`
- Create: `src/renderer/components/NPCInfluencePanel/NPCListItem.vue`
- Create: `src/renderer/components/NPCInfluencePanel/LobbyControls.vue`
- Create: `src/renderer/components/NPCInfluencePanel/ProjectList.vue`
- Create: `src/renderer/components/NPCInfluencePanel/CouncilSection.vue`
- Create: `src/renderer/components/NPCInfluencePanel/index.ts`
- Modify: `src/renderer/components/NPCInfluencePanel.vue` → move to directory
- Modify: `src/renderer/components/PoliticsTab.vue` (update import)

**Step 1: Create directory and move main component**

```bash
mkdir -p src/renderer/components/NPCInfluencePanel
git mv src/renderer/components/NPCInfluencePanel.vue src/renderer/components/NPCInfluencePanel/NPCInfluencePanel.vue
```

**Step 2: Create ActiveProposal.vue**

Extract lines 146-220 (Active Project Status section) into a new component that displays the active proposal status, progress bar, and threshold marker.

Props:
- `activeProject: ActiveProject`
- `npcs: NPC[]`
- `projects: Project[]`
- `selectedNPCForLobby: string | null`

Emits:
- `select-npc: (npcId: string) => void`

**Step 3: Create NPCListItem.vue**

Extract the NPC row display (lines 176-193) into a reusable component.

Props:
- `npc: NPC`
- `support: number`
- `selected: boolean`

Emits:
- `click: () => void`

**Step 4: Create LobbyControls.vue**

Extract lobbying controls (lines 197-219) into dedicated component.

Props:
- `npc: NPC | undefined`
- `lobbyAmount: number`
- `lobbyCost: number`
- `canLobby: boolean`
- `lobbyOptions: SelectOption[]`

Emits:
- `lobby: () => void`
- `update:lobbyAmount: (value: number) => void`

**Step 5: Create ProjectList.vue**

Extract project proposal list (lines 223-244).

Props:
- `projects: Project[]`
- `selectedProject: string | null`
- `canPropose: boolean`

Emits:
- `select: (projectId: string) => void`
- `propose: () => void`

**Step 6: Create CouncilSection.vue**

Extract council management (lines 247-279).

Props:
- `councils: Council[]`
- `npcs: NPC[]`
- `councilName: string`
- `selectedMembers: string[]`
- `canCreate: boolean`

Emits:
- `update:councilName: (name: string) => void`
- `toggle-member: (npcId: string) => void`
- `create: () => void`

**Step 7: Create index.ts**

```typescript
export { default as NPCInfluencePanel } from "./NPCInfluencePanel.vue";
```

**Step 8: Update NPCInfluencePanel.vue imports**

Update relative paths (add one `../` level) and import sub-components.

**Step 9: Update PoliticsTab.vue import**

```typescript
// Before
import NPCInfluencePanel from "./NPCInfluencePanel.vue";
// After
import { NPCInfluencePanel } from "./NPCInfluencePanel";
```

**Step 10: Verify and commit**

```bash
bun run lint && bun run build
git add src/renderer/components/NPCInfluencePanel/ src/renderer/components/PoliticsTab.vue
git commit -m "refactor: extract NPCInfluencePanel into sub-components"
```

---

## Task 2: BuildingPanel Extraction

**Files:**
- Create: `src/renderer/components/BuildingPanel/CategoryTabs.vue`
- Create: `src/renderer/components/BuildingPanel/BuildingCard.vue`
- Create: `src/renderer/components/BuildingPanel/ConstructionQueue.vue`
- Create: `src/renderer/components/BuildingPanel/index.ts`
- Modify: `src/renderer/components/BuildingPanel.vue` → move to directory
- Modify: `src/renderer/components/MainTab.vue` (update import)

**Step 1: Create directory and move main component**

```bash
mkdir -p src/renderer/components/BuildingPanel
git mv src/renderer/components/BuildingPanel.vue src/renderer/components/BuildingPanel/BuildingPanel.vue
```

**Step 2: Create CategoryTabs.vue**

Extract category tab buttons (lines 178-200).

Props:
- `selectedCategory: "all" | "available" | "built"`
- `activeCount: number`

Emits:
- `update:selectedCategory: (category: string) => void`

**Step 3: Create BuildingCard.vue**

Extract building card display (lines 203-251).

Props:
- `definition: BuildingDefinition`
- `count: number`
- `pendingCount: number`
- `locked: boolean`
- `canBuild: boolean`
- `buildReason: string | undefined`
- `requiredTechName: string`

Emits:
- `build: () => void`
- `hover: () => void`
- `leave: () => void`

**Step 4: Create ConstructionQueue.vue**

Extract construction queue (lines 254-272).

Props:
- `pendingBuildings: PendingBuilding[]`

**Step 5: Create index.ts**

```typescript
export { default as BuildingPanel } from "./BuildingPanel.vue";
```

**Step 6: Update BuildingPanel.vue imports and use sub-components**

**Step 7: Update MainTab.vue import**

```typescript
// Before
import BuildingPanel from "./BuildingPanel.vue";
// After
import { BuildingPanel } from "./BuildingPanel";
```

**Step 8: Verify and commit**

```bash
bun run lint && bun run build
git add src/renderer/components/BuildingPanel/ src/renderer/components/MainTab.vue
git commit -m "refactor: extract BuildingPanel into sub-components"
```

---

## Task 3: TechnologyPanel Extraction

**Files:**
- Create: `src/renderer/components/TechnologyPanel/CurrentResearch.vue`
- Create: `src/renderer/components/TechnologyPanel/TechCard.vue`
- Create: `src/renderer/components/TechnologyPanel/TechSection.vue`
- Create: `src/renderer/components/TechnologyPanel/index.ts`
- Modify: `src/renderer/components/TechnologyPanel.vue` → move to directory
- Modify: `src/renderer/components/ResearchTab.vue` (check if imported)

**Step 1: Create directory and move main component**

```bash
mkdir -p src/renderer/components/TechnologyPanel
git mv src/renderer/components/TechnologyPanel.vue src/renderer/components/TechnologyPanel/TechnologyPanel.vue
```

**Step 2: Create CurrentResearch.vue**

Extract current research display (lines 140-152).

Props:
- `tech: Technology | null`
- `progress: number`
- `currentProgress: number`
- `requiredSols: number`

Emits:
- `cancel: () => void`

**Step 3: Create TechCard.vue**

Extract tech card display (lines 158-178, 185-209).

Props:
- `tech: Technology`
- `variant: "available" | "completed" | "locked"`
- `canResearch: boolean`
- `hasActiveResearch: boolean`
- `prerequisiteNames: string[]`
- `hasAllPrerequisites: boolean`

Emits:
- `research: () => void`
- `hover: () => void`
- `leave: () => void`

**Step 4: Create TechSection.vue**

Extract tech section wrapper (lines 155-210).

Props:
- `title: string`
- `techs: Technology[]`
- `completed?: boolean`

Slot: default (for tech cards)

**Step 5: Create index.ts**

```typescript
export { default as TechnologyPanel } from "./TechnologyPanel.vue";
```

**Step 6: Update TechnologyPanel.vue imports and use sub-components**

**Step 7: Check and update any imports**

```bash
grep -r "TechnologyPanel" src/renderer/components/
```

Update any files importing TechnologyPanel.vue.

**Step 8: Verify and commit**

```bash
bun run lint && bun run build
git add src/renderer/components/TechnologyPanel/
git commit -m "refactor: extract TechnologyPanel into sub-components"
```

---

## Task 4: OperationsPanel Extraction

**Files:**
- Create: `src/renderer/components/OperationsPanel/PoliciesTab.vue`
- Create: `src/renderer/components/OperationsPanel/BuildingsTab.vue`
- Create: `src/renderer/components/OperationsPanel/MissionsTab.vue`
- Create: `src/renderer/components/OperationsPanel/index.ts`
- Modify: `src/renderer/components/OperationsPanel.vue` → move to directory
- Modify: `src/renderer/components/PoliticsTab.vue` (update import)

**Step 1: Create directory and move main component**

```bash
mkdir -p src/renderer/components/OperationsPanel
git mv src/renderer/components/OperationsPanel.vue src/renderer/components/OperationsPanel/OperationsPanel.vue
```

**Step 2: Create PoliciesTab.vue**

Extract policies tab content (lines 109-161).

Props:
- `policies: Policies`
- `policyCooldownRemaining: number`
- `policyOptions: PolicyOptions`

Emits:
- `set-policy: (type: PolicyType, value: string) => void`

**Step 3: Create BuildingsTab.vue**

Extract buildings tab content (lines 164-171).

(Simple component, just displays hint and legend)

**Step 4: Create MissionsTab.vue**

Extract missions tab content (lines 174-206).

Props:
- `activeExpeditions: Expedition[]`
- `prospectingSites: ProspectingSite[]`

Emits:
- `reveal-site: (siteId: string) => void`
- `develop-site: (siteId: string) => void`

**Step 5: Create index.ts**

```typescript
export { default as OperationsPanel } from "./OperationsPanel.vue";
```

**Step 6: Update OperationsPanel.vue imports and use sub-components**

**Step 7: Update PoliticsTab.vue import**

```typescript
// Before
import OperationsPanel from "./OperationsPanel.vue";
// After
import { OperationsPanel } from "./OperationsPanel";
```

**Step 8: Verify and commit**

```bash
bun run lint && bun run build
git add src/renderer/components/OperationsPanel/ src/renderer/components/PoliticsTab.vue
git commit -m "refactor: extract OperationsPanel into sub-components"
```

---

## Task 5: ColonyPanel Extraction

**Files:**
- Create: `src/renderer/components/ColonyPanel/StatRow.vue`
- Create: `src/renderer/components/ColonyPanel/WorkforceGrid.vue`
- Create: `src/renderer/components/ColonyPanel/index.ts`
- Modify: `src/renderer/components/ColonyPanel.vue` → move to directory
- Modify: `src/renderer/components/MainTab.vue` (update import)

**Step 1: Create directory and move main component**

```bash
mkdir -p src/renderer/components/ColonyPanel
git mv src/renderer/components/ColonyPanel.vue src/renderer/components/ColonyPanel/ColonyPanel.vue
```

**Step 2: Create StatRow.vue**

Extract stat display rows (lines 66-93).

Props:
- `label: string`
- `value?: number`
- `progress?: { percent: number; variant: string }`

**Step 3: Create WorkforceGrid.vue**

Extract workforce grid (lines 95-108).

Props:
- `workforceStats: Record<ColonistRole, number>`

**Step 4: Create index.ts**

```typescript
export { default as ColonyPanel } from "./ColonyPanel.vue";
```

**Step 5: Update ColonyPanel.vue imports and use sub-components**

**Step 6: Update MainTab.vue import**

```typescript
// Before
import ColonyPanel from "./ColonyPanel.vue";
// After
import { ColonyPanel } from "./ColonyPanel";
```

**Step 7: Verify and commit**

```bash
bun run lint && bun run build
git add src/renderer/components/ColonyPanel/ src/renderer/components/MainTab.vue
git commit -m "refactor: extract ColonyPanel into sub-components"
```

---

## Task 6: ResourcePanel (Directory Only)

ResourcePanel is already simple (128 lines). Just move to directory structure for consistency.

**Files:**
- Create: `src/renderer/components/ResourcePanel/index.ts`
- Modify: `src/renderer/components/ResourcePanel.vue` → move to directory
- Modify: `src/renderer/components/MainTab.vue` (update import)

**Step 1: Create directory and move**

```bash
mkdir -p src/renderer/components/ResourcePanel
git mv src/renderer/components/ResourcePanel.vue src/renderer/components/ResourcePanel/ResourcePanel.vue
```

**Step 2: Create index.ts**

```typescript
export { default as ResourcePanel } from "./ResourcePanel.vue";
```

**Step 3: Update ResourcePanel.vue imports (add one `../` level)**

**Step 4: Update MainTab.vue import**

```typescript
// Before
import ResourcePanel from "./ResourcePanel.vue";
// After
import { ResourcePanel } from "./ResourcePanel";
```

**Step 5: Verify and commit**

```bash
bun run lint && bun run build
git add src/renderer/components/ResourcePanel/ src/renderer/components/MainTab.vue
git commit -m "refactor: move ResourcePanel to directory structure"
```

---

## Task 7: Final Verification and Cleanup

**Step 1: Run full test suite**

```bash
bun test
```

**Step 2: Run dev server and verify UI**

```bash
bun run dev
# Manually verify all panels render correctly
```

**Step 3: Final commit if any fixes needed**

**Step 4: Merge back to main branch**

```bash
cd /workspace
git checkout refactor/panel-facade-migration
git merge feature/panel-component-extraction
git worktree remove .worktrees/panel-extraction
```

---

## Summary

| Task | Component | New Files | Commits |
|------|-----------|-----------|---------|
| 1 | NPCInfluencePanel | 6 | 1 |
| 2 | BuildingPanel | 4 | 1 |
| 3 | TechnologyPanel | 4 | 1 |
| 4 | OperationsPanel | 4 | 1 |
| 5 | ColonyPanel | 3 | 1 |
| 6 | ResourcePanel | 1 | 1 |
| 7 | Final verification | 0 | 0-1 |

Total: ~22 new files, 6-7 commits
