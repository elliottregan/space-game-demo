# Housing Building UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline housing building to HousingSection and OperationsPage, removing Residential from BuildingPanel tabs.

**Architecture:** Create a shared `BuildableHousingCard` component that displays residential building definitions with Build buttons. Integrate into HousingSection (new section at top) and OperationsPage (new Housing panel). Remove Residential tab from BuildingPanel's CategoryTabs.

**Tech Stack:** Vue 3, TypeScript, existing UI components (GButton, GSection), GameService API

---

### Task 1: Create BuildableHousingCard Component

**Files:**
- Create: `src/renderer/components/ColonyView/BuildableHousingCard.vue`

**Step 1: Create the component file**

```vue
<script setup lang="ts">
import type { BuildingDefinition } from "../../../facade";
import { GButton } from "../../ui";

const props = defineProps<{
  definition: BuildingDefinition;
  canBuild: boolean;
  buildReason?: string;
  pendingCount: number;
}>();

const emit = defineEmits<{
  build: [];
  hover: [];
  leave: [];
}>();

function formatCapacity(def: BuildingDefinition): string {
  return def.capacity ? `${def.capacity} beds` : "";
}

function formatCost(def: BuildingDefinition): string {
  return def.cost.materials ? `${def.cost.materials} materials` : "";
}
</script>

<template>
  <div
    class="buildable-housing-card"
    :class="{ disabled: !canBuild }"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <div class="housing-info">
      <span class="housing-name">{{ definition.name }}</span>
      <span class="housing-capacity">{{ formatCapacity(definition) }}</span>
      <span class="housing-cost">{{ formatCost(definition) }}</span>
      <span v-if="pendingCount > 0" class="housing-pending">({{ pendingCount }} building)</span>
    </div>
    <GButton
      size="sm"
      :disabled="!canBuild"
      :title="buildReason"
      @click="emit('build')"
    >
      Build
    </GButton>
  </div>
</template>

<style scoped>
.buildable-housing-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  border-radius: var(--g-radius-sm);
}

.buildable-housing-card.disabled {
  opacity: 0.6;
}

.housing-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-md);
}

.housing-name {
  font-weight: 500;
}

.housing-capacity {
  color: var(--g-color-info);
  font-size: var(--g-font-size-sm);
}

.housing-cost {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
}

.housing-pending {
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
}
</style>
```

**Step 2: Verify file created**

Run: `ls -la src/renderer/components/ColonyView/BuildableHousingCard.vue`
Expected: File exists

**Step 3: Run linter**

Run: `bun run lint`
Expected: No errors in BuildableHousingCard.vue

**Step 4: Commit**

```bash
git add src/renderer/components/ColonyView/BuildableHousingCard.vue
git commit -m "feat(ui): add BuildableHousingCard component"
```

---

### Task 2: Add Build Section to HousingSection

**Files:**
- Modify: `src/renderer/components/ColonyView/HousingSection.vue`

**Step 1: Add imports and computed properties**

Add after existing imports (line 6):

```typescript
import { BuildingPurpose } from "../../../core/models/Building";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildableHousingCard from "./BuildableHousingCard.vue";
```

Add after `selectedColonistId` ref (line 17):

```typescript
const api = gameService.api;

const residentialDefinitions = computed(() => {
  return props.buildingDefinitions.filter((def) => {
    if (def.purpose !== BuildingPurpose.Residential) return false;
    if (def.requiredTech && !api.technology.isResearched(def.requiredTech)) return false;
    return true;
  });
});

function canBuild(defId: string): boolean {
  return api.buildings.canBuild(defId).allowed;
}

function getBuildReason(defId: string): string | undefined {
  const check = api.buildings.canBuild(defId);
  return check.allowed ? undefined : check.reason;
}

function buildBuilding(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

function getPendingCount(defId: string): number {
  return gameService.getState().pendingBuildings.filter((b) => b.definitionId === defId).length;
}

function onBuildingHover(def: { cost: Record<string, number> }): void {
  const currentResources = api.resources.snapshot().current as Record<string, number>;
  const info = calculateHighlightInfo(def.cost, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

function onBuildingLeave(): void {
  clearHighlights();
}
```

**Step 2: Add template section**

Add after `<GPanel title="Housing">` (line 69), before housing-controls:

```vue
    <div class="build-housing-section">
      <div class="section-label">Build New Housing</div>
      <div class="buildable-list">
        <BuildableHousingCard
          v-for="def in residentialDefinitions"
          :key="def.id"
          :definition="def"
          :can-build="canBuild(def.id)"
          :build-reason="getBuildReason(def.id)"
          :pending-count="getPendingCount(def.id)"
          @build="buildBuilding(def.id)"
          @hover="onBuildingHover(def)"
          @leave="onBuildingLeave"
        />
      </div>
    </div>
```

**Step 3: Add styles**

Add before closing `</style>` tag:

```css
.build-housing-section {
  margin-bottom: var(--g-space-md);
  padding-bottom: var(--g-space-md);
  border-bottom: 1px solid var(--g-color-border);
}

.section-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-sm);
}

.buildable-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
```

**Step 4: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 5: Run dev server and verify visually**

Run: `bun run dev`
Expected: HousingSection shows "Build New Housing" section with Habitat Module card

**Step 6: Commit**

```bash
git add src/renderer/components/ColonyView/HousingSection.vue
git commit -m "feat(ui): add build section to HousingSection"
```

---

### Task 3: Add Housing Panel to OperationsPage

**Files:**
- Modify: `src/renderer/components/OperationsPage/OperationsPage.vue`

**Step 1: Add imports**

Add after existing imports (around line 6):

```typescript
import { BuildingPurpose } from "../../../core/models/Building";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildableHousingCard from "../ColonyView/BuildableHousingCard.vue";
```

**Step 2: Add computed and methods**

Add after `autoAssignEnabled` ref (line 17):

```typescript
const residentialDefinitions = computed(() => {
  return state.buildingDefinitions.filter((def) => {
    if (def.purpose !== BuildingPurpose.Residential) return false;
    if (def.requiredTech && !gameService.api.technology.isResearched(def.requiredTech)) return false;
    return true;
  });
});

function canBuildHousing(defId: string): boolean {
  return gameService.api.buildings.canBuild(defId).allowed;
}

function getHousingBuildReason(defId: string): string | undefined {
  const check = gameService.api.buildings.canBuild(defId);
  return check.allowed ? undefined : check.reason;
}

function buildHousing(defId: string): void {
  const result = gameService.api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

function getHousingPendingCount(defId: string): number {
  return state.pendingBuildings.filter((b) => b.definitionId === defId).length;
}

function onHousingHover(def: { cost: Record<string, number> }): void {
  const currentResources = gameService.api.resources.snapshot().current as Record<string, number>;
  const info = calculateHighlightInfo(def.cost, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

function onHousingLeave(): void {
  clearHighlights();
}
```

**Step 3: Add template section**

Add after `<BuildingPanel />` (line 115):

```vue
    <GPanel title="Housing" accent="amber">
      <div class="buildable-list">
        <BuildableHousingCard
          v-for="def in residentialDefinitions"
          :key="def.id"
          :definition="def"
          :can-build="canBuildHousing(def.id)"
          :build-reason="getHousingBuildReason(def.id)"
          :pending-count="getHousingPendingCount(def.id)"
          @build="buildHousing(def.id)"
          @hover="onHousingHover(def)"
          @leave="onHousingLeave"
        />
      </div>
    </GPanel>
```

**Step 4: Add styles**

Add to `<style scoped>` section:

```css
.buildable-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
```

**Step 5: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add src/renderer/components/OperationsPage/OperationsPage.vue
git commit -m "feat(ui): add Housing panel to OperationsPage"
```

---

### Task 4: Remove Residential Tab from BuildingPanel

**Files:**
- Modify: `src/renderer/components/BuildingPanel/CategoryTabs.vue`
- Modify: `src/renderer/components/BuildingPanel/BuildingPanel.vue`

**Step 1: Update CategoryTabs to exclude Residential**

In `CategoryTabs.vue`, replace the `:tabs` array (lines 20-36) with:

```vue
    :tabs="[
      {
        id: BuildingPurpose.Industrial,
        label: 'Industrial',
        badge: counts[BuildingPurpose.Industrial] || undefined,
      },
      {
        id: BuildingPurpose.Social,
        label: 'Social',
        badge: counts[BuildingPurpose.Social] || undefined,
      },
    ]"
```

**Step 2: Update BuildingPanel default category**

In `BuildingPanel.vue`, the `selectedCategory` ref (line 19) is already `Industrial`, so no change needed.

**Step 3: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 4: Run dev server and verify**

Run: `bun run dev`
Expected: BuildingPanel only shows Industrial and Social tabs

**Step 5: Commit**

```bash
git add src/renderer/components/BuildingPanel/CategoryTabs.vue
git commit -m "feat(ui): remove Residential tab from BuildingPanel"
```

---

### Task 5: Run Tests and Final Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Visual verification**

Run: `bun run dev`

Verify:
1. Colony tab → Housing panel shows "Build New Housing" section with Habitat Module
2. Operations tab → New "Housing" panel appears between Buildings and Workforce
3. Operations tab → Buildings panel only shows Industrial and Social tabs
4. Build button works in both locations
5. Resource highlighting works on hover

**Step 3: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 4: Final commit (if any cleanup needed)**

```bash
git status
# If clean, no commit needed
```
