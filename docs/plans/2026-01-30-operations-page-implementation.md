# Operations Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a side-by-side drag-and-drop interface for assigning colonists to buildings, with skill match highlighting.

**Architecture:** New `/operations` route with `OperationsPage.vue` containing two panels: `ColonistPool` (unassigned colonists) and `BuildingRoleGroups` (buildings grouped by worker role). Uses HTML5 native drag-and-drop. Assignments via existing `gameService.api.colony.assignToBuilding()` and `unassignFromBuilding()`.

**Tech Stack:** Vue 3, TypeScript, HTML5 Drag and Drop API, existing UI components (GPanel, GSection)

---

## Task 1: Add Operations Route

**Files:**
- Modify: `src/renderer/router.ts`
- Modify: `src/renderer/components/TabNav.vue`
- Create: `src/renderer/components/OperationsPage/OperationsPage.vue`

**Step 1: Create placeholder OperationsPage component**

Create `src/renderer/components/OperationsPage/OperationsPage.vue`:

```vue
<script setup lang="ts">
import { GPanel } from "../../ui";
</script>

<template>
  <div class="operations-page">
    <GPanel title="Operations" accent="amber">
      <p>Workforce assignment page - coming soon</p>
    </GPanel>
  </div>
</template>

<style scoped>
.operations-page {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
```

**Step 2: Add route to router**

In `src/renderer/router.ts`, add after the `/research` route:

```typescript
{
  path: "/operations",
  name: "operations",
  component: () => import("./components/OperationsPage/OperationsPage.vue"),
},
```

**Step 3: Add tab to navigation**

In `src/renderer/components/TabNav.vue`, add after Research link:

```vue
<RouterLink to="/operations" class="tab-link" active-class="active"> Operations </RouterLink>
```

**Step 4: Verify manually**

Run: `bun run dev`
Expected: New "Operations" tab appears, clicking it shows placeholder page.

**Step 5: Commit**

```bash
git add src/renderer/router.ts src/renderer/components/TabNav.vue src/renderer/components/OperationsPage/
git commit -m "feat(operations): add operations page route and placeholder"
```

---

## Task 2: Create ColonistDragCard Component

**Files:**
- Create: `src/renderer/components/OperationsPage/ColonistDragCard.vue`

**Step 1: Create the draggable colonist card**

Create `src/renderer/components/OperationsPage/ColonistDragCard.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { MASTERY_DISPLAY_NAMES, ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import type { Colonist, SkillDefinition } from "../../../facade";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [colonistId: string];
  dragstart: [colonistId: string];
  dragend: [];
}>();

const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData("text/plain", props.colonist.id);
  emit("dragstart", props.colonist.id);
}

function onDragEnd() {
  emit("dragend");
}

function onClick() {
  emit("select", props.colonist.id);
}
</script>

<template>
  <div
    class="colonist-card"
    :class="{ selected: isSelected }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="onClick"
  >
    <div class="colonist-header">
      <span class="colonist-name">{{ colonist.name }}</span>
      <span class="colonist-role">{{ ROLE_DISPLAY_NAMES[colonist.role] }}</span>
    </div>
    <div class="colonist-skills" v-if="colonistSkills.length > 0">
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="skill.affinity.includes(colonist.role)"
      />
    </div>
    <div class="colonist-mastery">{{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }}</div>
  </div>
</template>

<style scoped>
.colonist-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  cursor: grab;
  transition: all var(--g-transition-fast);
}

.colonist-card:hover {
  border-color: var(--g-color-text-muted);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.colonist-card.selected {
  border-color: var(--g-accent-cyan);
  box-shadow: 0 0 0 2px var(--g-accent-cyan);
}

.colonist-card:active {
  cursor: grabbing;
}

.colonist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.colonist-name {
  font-weight: 500;
}

.colonist-role {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  text-transform: uppercase;
}

.colonist-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: var(--g-space-xs);
}

.colonist-mastery {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}
</style>
```

**Step 2: Verify component renders**

Import and use in OperationsPage temporarily to verify it works.

**Step 3: Commit**

```bash
git add src/renderer/components/OperationsPage/ColonistDragCard.vue
git commit -m "feat(operations): add ColonistDragCard component"
```

---

## Task 3: Create WorkerSlot Component

**Files:**
- Create: `src/renderer/components/OperationsPage/WorkerSlot.vue`

**Step 1: Create the worker slot component**

Create `src/renderer/components/OperationsPage/WorkerSlot.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { Colonist, SkillDefinition } from "../../../facade";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  colonist?: Colonist;
  skillDefinitions: SkillDefinition[];
  workerRole: string;
  isValidDrop: boolean;
  isDragActive: boolean;
}>();

const emit = defineEmits<{
  drop: [colonistId: string];
  unassign: [colonistId: string];
}>();

const isDragOver = ref(false);

function getRelevantSkill(): SkillDefinition | undefined {
  if (!props.colonist) return undefined;
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .find((s) => s?.affinity.includes(props.workerRole as never));
}

function onDragOver(e: DragEvent) {
  if (props.isValidDrop && !props.colonist) {
    e.preventDefault();
    isDragOver.value = true;
  }
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const colonistId = e.dataTransfer?.getData("text/plain");
  if (colonistId && props.isValidDrop) {
    emit("drop", colonistId);
  }
}

function onUnassign() {
  if (props.colonist) {
    emit("unassign", props.colonist.id);
  }
}
</script>

<template>
  <div
    class="worker-slot"
    :class="{
      filled: !!colonist,
      empty: !colonist,
      'drag-over': isDragOver,
      'valid-drop': isDragActive && isValidDrop && !colonist,
      'invalid-drop': isDragActive && !isValidDrop && !colonist,
    }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <template v-if="colonist">
      <span class="worker-name">{{ colonist.name }}</span>
      <ColonistSkillBadge
        v-if="getRelevantSkill()"
        :skill="getRelevantSkill()!"
        :is-active="true"
      />
      <button class="unassign-btn" @click="onUnassign" title="Unassign">&times;</button>
    </template>
    <template v-else>
      <span class="empty-label">+ Empty Slot</span>
    </template>
  </div>
</template>

<style scoped>
.worker-slot {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  min-height: 40px;
  border: 1px dashed var(--g-color-border);
  transition: all var(--g-transition-fast);
}

.worker-slot.filled {
  border-style: solid;
  background: var(--g-color-bg-base);
}

.worker-slot.empty {
  justify-content: center;
}

.worker-slot.valid-drop {
  border-color: var(--g-color-positive);
  background: rgba(67, 160, 71, 0.1);
}

.worker-slot.drag-over {
  border-color: var(--g-accent-cyan);
  background: rgba(0, 188, 212, 0.15);
  box-shadow: 0 0 0 2px var(--g-accent-cyan);
}

.worker-slot.invalid-drop {
  border-color: var(--g-color-negative);
  background: rgba(198, 40, 40, 0.1);
  opacity: 0.5;
}

.worker-name {
  font-weight: 500;
  flex: 1;
}

.empty-label {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
}

.unassign-btn {
  background: transparent;
  border: none;
  color: var(--g-color-text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 var(--g-space-xs);
  line-height: 1;
}

.unassign-btn:hover {
  color: var(--g-color-negative);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/OperationsPage/WorkerSlot.vue
git commit -m "feat(operations): add WorkerSlot component"
```

---

## Task 4: Create BuildingWorkSlots Component

**Files:**
- Create: `src/renderer/components/OperationsPage/BuildingWorkSlots.vue`

**Step 1: Create the building card with worker slots**

Create `src/renderer/components/OperationsPage/BuildingWorkSlots.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist, ColonistRole, SkillDefinition } from "../../../facade";
import WorkerSlot from "./WorkerSlot.vue";

const props = defineProps<{
  building: Building;
  definition: BuildingDefinition;
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
  selectedColonistId: string | null;
  draggingColonistId: string | null;
}>();

const emit = defineEmits<{
  assign: [colonistId: string, buildingId: string];
  unassign: [colonistId: string];
}>();

const assignedWorkers = computed(() => {
  return props.building.assignedWorkers
    .map((id) => props.colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => c !== undefined);
});

const workerSlots = computed(() => props.definition.workerSlots || 0);

const emptySlots = computed(() => Math.max(0, workerSlots.value - assignedWorkers.value.length));

const skillBonus = computed(() => {
  const colonistId = props.selectedColonistId || props.draggingColonistId;
  if (!colonistId) return null;

  const colonist = props.colonists.find((c) => c.id === colonistId);
  if (!colonist) return null;

  // Check if colonist has a skill that matches this building's worker role
  const workerRole = props.definition.workerRole;
  if (!workerRole) return null;

  let totalBonus = 0;
  for (const skillId of colonist.skills) {
    const skill = props.skillDefinitions.find((s) => s.id === skillId);
    if (skill?.affinity.includes(workerRole)) {
      totalBonus += skill.efficiencyBonus;
    }
  }

  return totalBonus > 0 ? totalBonus : null;
});

const isValidDropTarget = computed(() => {
  const colonistId = props.selectedColonistId || props.draggingColonistId;
  if (!colonistId) return false;
  if (emptySlots.value === 0) return false;

  // Any colonist can be assigned (role matching is soft - affects efficiency)
  return true;
});

const isDragActive = computed(() => !!props.draggingColonistId);

function formatResourceDelta(delta: Record<string, number> | undefined): string {
  if (!delta) return "";
  return Object.entries(delta)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
    .join(", ");
}

function onDrop(colonistId: string) {
  emit("assign", colonistId, props.building.id);
}

function onUnassign(colonistId: string) {
  emit("unassign", colonistId);
}
</script>

<template>
  <div
    class="building-card"
    :class="{
      'has-bonus': skillBonus !== null,
      'valid-target': isValidDropTarget,
      'full': emptySlots === 0,
    }"
  >
    <div class="building-header">
      <span class="building-name">{{ definition.name }} #{{ building.id.split('_').pop() }}</span>
      <span v-if="skillBonus !== null" class="skill-bonus">+{{ Math.round(skillBonus * 100) }}%</span>
      <span v-if="emptySlots === 0 && isDragActive" class="full-badge">Full</span>
    </div>

    <div class="building-stats" v-if="definition.production">
      <span class="production">{{ formatResourceDelta(definition.production) }}</span>
    </div>

    <div class="worker-slots">
      <WorkerSlot
        v-for="worker in assignedWorkers"
        :key="worker.id"
        :colonist="worker"
        :skill-definitions="skillDefinitions"
        :worker-role="definition.workerRole || ''"
        :is-valid-drop="false"
        :is-drag-active="isDragActive"
        @unassign="onUnassign"
      />
      <WorkerSlot
        v-for="i in emptySlots"
        :key="'empty-' + i"
        :skill-definitions="skillDefinitions"
        :worker-role="definition.workerRole || ''"
        :is-valid-drop="isValidDropTarget"
        :is-drag-active="isDragActive"
        @drop="onDrop"
      />
    </div>
  </div>
</template>

<style scoped>
.building-card {
  padding: var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  transition: all var(--g-transition-fast);
}

.building-card.has-bonus {
  border-color: var(--g-color-positive);
  box-shadow: 0 0 8px rgba(67, 160, 71, 0.3);
}

.building-card.full {
  opacity: 0.7;
}

.building-header {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-sm);
}

.building-name {
  font-weight: 500;
  flex: 1;
}

.skill-bonus {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-positive);
  background: rgba(67, 160, 71, 0.15);
  padding: 2px 6px;
}

.full-badge {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
}

.building-stats {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.production {
  color: var(--g-color-positive);
}

.worker-slots {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/OperationsPage/BuildingWorkSlots.vue
git commit -m "feat(operations): add BuildingWorkSlots component"
```

---

## Task 5: Create BuildingRoleGroup Component

**Files:**
- Create: `src/renderer/components/OperationsPage/BuildingRoleGroup.vue`

**Step 1: Create the collapsible building group**

Create `src/renderer/components/OperationsPage/BuildingRoleGroup.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { ROLE_DISPLAY_NAMES, type ColonistRole } from "../../../core/models/Colonist";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import BuildingWorkSlots from "./BuildingWorkSlots.vue";

const props = defineProps<{
  role: ColonistRole;
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
  selectedColonistId: string | null;
  draggingColonistId: string | null;
}>();

const emit = defineEmits<{
  assign: [colonistId: string, buildingId: string];
  unassign: [colonistId: string];
}>();

const isExpanded = ref(true);

const stats = computed(() => {
  let totalSlots = 0;
  let filledSlots = 0;

  for (const building of props.buildings) {
    const def = props.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.workerSlots) continue;
    totalSlots += def.workerSlots;
    filledSlots += building.assignedWorkers.length;
  }

  return { total: totalSlots, filled: filledSlots };
});

function getDefinition(building: Building): BuildingDefinition | undefined {
  return props.buildingDefinitions.find((d) => d.id === building.definitionId);
}

function onAssign(colonistId: string, buildingId: string) {
  emit("assign", colonistId, buildingId);
}

function onUnassign(colonistId: string) {
  emit("unassign", colonistId);
}
</script>

<template>
  <div class="role-group">
    <button class="role-header" @click="isExpanded = !isExpanded">
      <span class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="role-name">{{ ROLE_DISPLAY_NAMES[role] }}</span>
      <span class="role-stats">({{ buildings.length }} buildings, {{ stats.filled }}/{{ stats.total }} workers)</span>
    </button>

    <div v-if="isExpanded" class="role-buildings">
      <BuildingWorkSlots
        v-for="building in buildings"
        :key="building.id"
        :building="building"
        :definition="getDefinition(building)!"
        :colonists="colonists"
        :skill-definitions="skillDefinitions"
        :selected-colonist-id="selectedColonistId"
        :dragging-colonist-id="draggingColonistId"
        @assign="onAssign"
        @unassign="onUnassign"
      />
    </div>
  </div>
</template>

<style scoped>
.role-group {
  margin-bottom: var(--g-space-md);
}

.role-header {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  width: 100%;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  cursor: pointer;
  text-align: left;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text);
}

.role-header:hover {
  background: var(--g-color-bg-surface);
}

.expand-icon {
  font-size: var(--g-font-size-xs);
  width: 1em;
}

.role-name {
  font-weight: 600;
}

.role-stats {
  color: var(--g-color-text-muted);
  font-weight: normal;
}

.role-buildings {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  border: 1px solid var(--g-color-border);
  border-top: none;
  background: var(--g-color-bg-base);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/OperationsPage/BuildingRoleGroup.vue
git commit -m "feat(operations): add BuildingRoleGroup component"
```

---

## Task 6: Create ColonistPool Component

**Files:**
- Create: `src/renderer/components/OperationsPage/ColonistPool.vue`

**Step 1: Create the colonist pool panel**

Create `src/renderer/components/OperationsPage/ColonistPool.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { Colonist, SkillDefinition } from "../../../facade";
import { GSection } from "../../ui";
import ColonistDragCard from "./ColonistDragCard.vue";

defineProps<{
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
  selectedColonistId: string | null;
}>();

const emit = defineEmits<{
  select: [colonistId: string | null];
  dragstart: [colonistId: string];
  dragend: [];
  drop: [colonistId: string];
}>();

const isDragOver = ref(false);

function onSelect(colonistId: string) {
  emit("select", colonistId);
}

function onDragStart(colonistId: string) {
  emit("dragstart", colonistId);
}

function onDragEnd() {
  emit("dragend");
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const colonistId = e.dataTransfer?.getData("text/plain");
  if (colonistId) {
    emit("drop", colonistId);
  }
}
</script>

<template>
  <div
    class="colonist-pool"
    :class="{ 'drag-over': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <GSection title="Available Colonists" :badge="colonists.length">
      <div v-if="colonists.length === 0" class="empty-state">
        All colonists are assigned to buildings
      </div>
      <div v-else class="colonist-list">
        <ColonistDragCard
          v-for="colonist in colonists"
          :key="colonist.id"
          :colonist="colonist"
          :skill-definitions="skillDefinitions"
          :is-selected="selectedColonistId === colonist.id"
          @select="onSelect"
          @dragstart="onDragStart"
          @dragend="onDragEnd"
        />
      </div>
    </GSection>
  </div>
</template>

<style scoped>
.colonist-pool {
  min-width: 280px;
  max-width: 320px;
  transition: all var(--g-transition-fast);
}

.colonist-pool.drag-over {
  background: rgba(0, 188, 212, 0.1);
}

.colonist-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.empty-state {
  padding: var(--g-space-lg);
  text-align: center;
  color: var(--g-color-text-muted);
  font-style: italic;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/OperationsPage/ColonistPool.vue
git commit -m "feat(operations): add ColonistPool component"
```

---

## Task 7: Assemble OperationsPage

**Files:**
- Modify: `src/renderer/components/OperationsPage/OperationsPage.vue`

**Step 1: Update OperationsPage to use all components**

Replace `src/renderer/components/OperationsPage/OperationsPage.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { ColonistRole } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import BuildingRoleGroup from "./BuildingRoleGroup.vue";
import ColonistPool from "./ColonistPool.vue";

const state = gameService.getState();

// Drag and selection state
const selectedColonistId = ref<string | null>(null);
const draggingColonistId = ref<string | null>(null);

// Get unassigned colonists (not assigned to any building)
const unassignedColonists = computed(() => {
  const assignedIds = new Set<string>();
  for (const building of state.buildings) {
    for (const colonistId of building.assignedWorkers) {
      assignedIds.add(colonistId);
    }
  }
  return state.colonists.filter((c) => !assignedIds.has(c.id));
});

// Group buildings by worker role
const buildingsByRole = computed(() => {
  const groups: Partial<Record<ColonistRole, typeof state.buildings>> = {};

  for (const building of state.buildings) {
    if (building.status !== "active") continue;

    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.workerSlots || !def.workerRole) continue;

    const role = def.workerRole;
    if (!groups[role]) {
      groups[role] = [];
    }
    groups[role]!.push(building);
  }

  return groups;
});

// Order of roles to display
const roleOrder: ColonistRole[] = [
  ColonistRole.FARMING,
  ColonistRole.ENGINEERING,
  ColonistRole.RESEARCH,
  ColonistRole.CIVIL_SCIENCE,
];

function onSelect(colonistId: string | null) {
  selectedColonistId.value = selectedColonistId.value === colonistId ? null : colonistId;
}

function onDragStart(colonistId: string) {
  draggingColonistId.value = colonistId;
  selectedColonistId.value = null;
}

function onDragEnd() {
  draggingColonistId.value = null;
}

function onAssign(colonistId: string, buildingId: string) {
  // Unassign first if already assigned
  const currentWorkplace = state.buildings.find((b) => b.assignedWorkers.includes(colonistId));
  if (currentWorkplace) {
    gameService.api.colony.unassignFromBuilding(colonistId);
  }

  gameService.api.colony.assignToBuilding(colonistId, buildingId);
  selectedColonistId.value = null;
  draggingColonistId.value = null;
}

function onUnassign(colonistId: string) {
  gameService.api.colony.unassignFromBuilding(colonistId);
}

function onDropToPool(colonistId: string) {
  gameService.api.colony.unassignFromBuilding(colonistId);
}
</script>

<template>
  <div class="operations-page">
    <GPanel title="Workforce Assignment" accent="amber">
      <div class="operations-layout">
        <ColonistPool
          :colonists="unassignedColonists"
          :skill-definitions="state.skillDefinitions"
          :selected-colonist-id="selectedColonistId"
          @select="onSelect"
          @dragstart="onDragStart"
          @dragend="onDragEnd"
          @drop="onDropToPool"
        />

        <div class="buildings-panel">
          <template v-for="role in roleOrder" :key="role">
            <BuildingRoleGroup
              v-if="buildingsByRole[role]?.length"
              :role="role"
              :buildings="buildingsByRole[role]!"
              :building-definitions="state.buildingDefinitions"
              :colonists="state.colonists"
              :skill-definitions="state.skillDefinitions"
              :selected-colonist-id="selectedColonistId"
              :dragging-colonist-id="draggingColonistId"
              @assign="onAssign"
              @unassign="onUnassign"
            />
          </template>

          <div v-if="Object.keys(buildingsByRole).length === 0" class="empty-state">
            No buildings require workers yet. Build farms, research labs, or other staffed buildings.
          </div>
        </div>
      </div>
    </GPanel>
  </div>
</template>

<style scoped>
.operations-page {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.operations-layout {
  display: flex;
  gap: var(--g-space-lg);
  min-height: 400px;
}

.buildings-panel {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  padding: var(--g-space-xl);
  text-align: center;
  color: var(--g-color-text-muted);
  font-style: italic;
}

@media (max-width: 768px) {
  .operations-layout {
    flex-direction: column;
  }

  .colonist-pool {
    max-width: none;
  }
}
</style>
```

**Step 2: Verify manually**

Run: `bun run dev`
Expected: Operations page shows side-by-side layout with colonists and buildings. Can drag colonists to buildings.

**Step 3: Commit**

```bash
git add src/renderer/components/OperationsPage/OperationsPage.vue
git commit -m "feat(operations): assemble complete operations page with drag-and-drop"
```

---

## Task 8: Create Index Export

**Files:**
- Create: `src/renderer/components/OperationsPage/index.ts`

**Step 1: Create barrel export**

Create `src/renderer/components/OperationsPage/index.ts`:

```typescript
export { default as OperationsPage } from "./OperationsPage.vue";
export { default as ColonistPool } from "./ColonistPool.vue";
export { default as ColonistDragCard } from "./ColonistDragCard.vue";
export { default as BuildingRoleGroup } from "./BuildingRoleGroup.vue";
export { default as BuildingWorkSlots } from "./BuildingWorkSlots.vue";
export { default as WorkerSlot } from "./WorkerSlot.vue";
```

**Step 2: Commit**

```bash
git add src/renderer/components/OperationsPage/index.ts
git commit -m "feat(operations): add barrel export"
```

---

## Task 9: Final Verification

**Step 1: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 2: Run formatter**

Run: `bun run format`

**Step 3: Run tests**

Run: `bun test`
Expected: Same pass/fail as baseline (930 pass, 1 pre-existing fail)

**Step 4: Manual testing checklist**

- [ ] Operations tab appears in nav
- [ ] Clicking shows workforce assignment page
- [ ] Unassigned colonists appear in left panel
- [ ] Buildings grouped by role in right panel
- [ ] Can drag colonist to empty slot
- [ ] Skill bonus shows when hovering/selecting compatible colonist
- [ ] Can click X to unassign colonist
- [ ] Can drag colonist back to pool to unassign
- [ ] Building shows "Full" when no empty slots

**Step 5: Final commit if any formatting changes**

```bash
git add -A
git commit -m "style: format operations page components"
```

---

## Summary

| Task | Component | Purpose |
|------|-----------|---------|
| 1 | Route + Nav | Add `/operations` route and tab |
| 2 | ColonistDragCard | Draggable colonist card with skills |
| 3 | WorkerSlot | Empty/filled slot with drop handling |
| 4 | BuildingWorkSlots | Building card with worker slots array |
| 5 | BuildingRoleGroup | Collapsible section grouping buildings |
| 6 | ColonistPool | Left panel with unassigned colonists |
| 7 | OperationsPage | Main page assembling all pieces |
| 8 | index.ts | Barrel export |
| 9 | Verification | Lint, format, test, manual check |
