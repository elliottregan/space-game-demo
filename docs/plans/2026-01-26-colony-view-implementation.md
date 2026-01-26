# Colony View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a text-based Colony View tab showing buildings with workers, habitats with residents, and automatic housing assignment.

**Architecture:** Extend the Colonist model with `housingId`, add `capacity` to BuildingDefinition for habitats, implement auto-housing in ColonyManager, create new Vue components for the Colony View tab.

**Tech Stack:** Vue 3, TypeScript, existing GPanel/GBadge UI primitives

---

## Task 1: Extend Data Models

**Files:**
- Modify: `src/core/models/Colonist.ts`
- Modify: `src/core/models/Building.ts`
- Modify: `src/core/data/buildings.ts`

**Step 1: Add housingId to Colonist interface**

In `src/core/models/Colonist.ts`, add to the Colonist interface:

```typescript
export interface Colonist {
  id: string;
  name: string;
  role: ColonistRole;
  experience: number;
  masteryLevel: MasteryLevel;
  trainingTarget?: ColonistRole;
  trainingProgress?: number;
  skills: string[];
  housingId?: string;  // Building ID of assigned habitat
}
```

**Step 2: Add capacity to BuildingDefinition**

In `src/core/models/Building.ts`, add to BuildingDefinition:

```typescript
export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  cost: ResourceDelta;
  constructionTime: number;
  production?: ResourceDelta;
  consumption?: ResourceDelta;
  workerSlots?: number;
  workerRole?: ColonistRole;
  requiredTech?: string;
  requiresDeposit?: boolean;
  repurposeTargets?: string[];
  moraleBoost?: number;
  capacity?: number;  // Housing capacity for habitats
}
```

**Step 3: Add capacity to habitat buildings**

In `src/core/data/buildings.ts`, update habitat definitions:

```typescript
{
  id: "habitat",
  name: "Habitat Module",
  description: "Basic living quarters for colonists",
  cost: { materials: 50 },
  constructionTime: 10,
  consumption: { power: 2, oxygen: 1 },
  capacity: 4,  // Houses 4 colonists
},
```

And for advanced_habitat:

```typescript
{
  id: "advanced_habitat",
  name: "Advanced Habitat",
  description: "Comfortable living for more colonists",
  cost: { materials: 120 },
  constructionTime: 18,
  consumption: { power: 5, oxygen: 2 },
  requiredTech: "advanced_materials",
  capacity: 8,  // Houses 8 colonists
},
```

**Step 4: Commit**

```bash
git add src/core/models/Colonist.ts src/core/models/Building.ts src/core/data/buildings.ts
git commit -m "feat(models): add housingId to Colonist and capacity to BuildingDefinition"
```

---

## Task 2: Add Housing Logic to ColonyManager

**Files:**
- Modify: `src/core/systems/ColonyManager.ts`
- Create: `tests/HousingAssignment.test.ts`

**Step 1: Write failing tests for housing assignment**

Create `tests/HousingAssignment.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { BUILDINGS } from "../src/core/data/buildings";

describe("Housing Assignment", () => {
  let colonyManager: ColonyManager;
  let buildingManager: BuildingManager;

  beforeEach(() => {
    colonyManager = new ColonyManager(0);
    buildingManager = new BuildingManager(BUILDINGS);
  });

  it("assigns new colonist to available habitat", () => {
    // Build a habitat (manually set to active for test)
    const building = buildingManager.startConstruction("habitat");
    if (building) {
      // Force complete construction for test
      for (let i = 0; i < 20; i++) {
        buildingManager.tick({} as any);
      }
    }

    colonyManager.assignHousing(buildingManager);
    const colonist = colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    expect(colonist.housingId).toBeDefined();
  });

  it("returns unhoused colonists when no capacity", () => {
    // Add colonists without any habitats
    colonyManager.addColonist();
    colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(2);
  });

  it("getHousingAssignments returns colonists grouped by habitat", () => {
    const building = buildingManager.startConstruction("habitat");
    if (building) {
      for (let i = 0; i < 20; i++) {
        buildingManager.tick({} as any);
      }
    }

    colonyManager.addColonist();
    colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    const assignments = colonyManager.getHousingAssignments();
    expect(Object.keys(assignments).length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/HousingAssignment.test.ts`
Expected: FAIL - methods don't exist

**Step 3: Implement housing methods in ColonyManager**

Add to `src/core/systems/ColonyManager.ts`:

```typescript
// Add import at top
import type { BuildingManager } from "./BuildingManager";

// Add these methods to the class:

assignHousing(buildingManager: BuildingManager): void {
  const habitats = buildingManager
    .getBuildings()
    .filter((b) => {
      const def = buildingManager.getDefinition(b.definitionId);
      return def?.capacity && def.capacity > 0 && b.status === "active";
    });

  // Get current housing counts per habitat
  const housingCounts = new Map<string, number>();
  for (const habitat of habitats) {
    housingCounts.set(habitat.id, 0);
  }

  // Count currently housed colonists
  for (const colonist of this.colonists.values()) {
    if (colonist.housingId && housingCounts.has(colonist.housingId)) {
      housingCounts.set(
        colonist.housingId,
        (housingCounts.get(colonist.housingId) || 0) + 1
      );
    }
  }

  // Assign unhoused colonists to available habitats
  for (const colonist of this.colonists.values()) {
    if (colonist.housingId) continue; // Already housed

    for (const habitat of habitats) {
      const def = buildingManager.getDefinition(habitat.definitionId);
      const currentCount = housingCounts.get(habitat.id) || 0;
      if (def?.capacity && currentCount < def.capacity) {
        colonist.housingId = habitat.id;
        housingCounts.set(habitat.id, currentCount + 1);
        break;
      }
    }
  }
}

getUnhousedColonists(): Colonist[] {
  return Array.from(this.colonists.values()).filter((c) => !c.housingId);
}

getHousingAssignments(): Record<string, Colonist[]> {
  const assignments: Record<string, Colonist[]> = {};
  for (const colonist of this.colonists.values()) {
    if (colonist.housingId) {
      if (!assignments[colonist.housingId]) {
        assignments[colonist.housingId] = [];
      }
      assignments[colonist.housingId].push(colonist);
    }
  }
  return assignments;
}

clearHousingAssignment(colonistId: string): void {
  const colonist = this.colonists.get(colonistId);
  if (colonist) {
    colonist.housingId = undefined;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/HousingAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/ColonyManager.ts tests/HousingAssignment.test.ts
git commit -m "feat(colony): add automatic housing assignment for colonists"
```

---

## Task 3: Expose Housing Data via GameService

**Files:**
- Modify: `src/renderer/services/GameService.ts`
- Modify: `src/facade.ts` (if needed for type exports)

**Step 1: Add housing state to GameUIState**

In `src/renderer/services/GameService.ts`, add to the GameUIState interface:

```typescript
interface GameUIState {
  // ... existing fields ...
  housingAssignments: Record<string, Colonist[]>;
  unhoused: Colonist[];
}
```

**Step 2: Initialize housing state**

In the reactive state initialization, add:

```typescript
housingAssignments: {},
unhoused: [],
```

**Step 3: Update syncState to include housing**

In the `syncState()` method, add:

```typescript
// After syncing colonists
this.state.housingAssignments = this.api.colony.getHousingAssignments?.() ?? {};
this.state.unhoused = this.api.colony.getUnhousedColonists?.() ?? [];
```

**Step 4: Trigger housing assignment in tick**

Ensure housing is assigned each tick. In GameState.tick() or where appropriate:

```typescript
// After buildings tick, reassign housing
this.colonyManager.assignHousing(this.buildingManager);
```

**Step 5: Commit**

```bash
git add src/renderer/services/GameService.ts src/core/GameState.ts
git commit -m "feat(service): expose housing assignments to Vue components"
```

---

## Task 4: Create ColonyViewTab Component

**Files:**
- Create: `src/renderer/components/ColonyView/ColonyViewTab.vue`

**Step 1: Create the main tab component**

Create `src/renderer/components/ColonyView/ColonyViewTab.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import ColonyStatsBar from "./ColonyStatsBar.vue";
import BuildingSection from "./BuildingSection.vue";
import HousingSection from "./HousingSection.vue";
import UnhousedSection from "./UnhousedSection.vue";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeBuildings = computed(() =>
  state.buildings.filter((b) => b.status === "active" || b.status === "pending")
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const buildingsByCategory = computed(() => {
  const categories: Record<string, typeof state.buildings> = {
    housing: [],
    production: [],
    infrastructure: [],
    recreation: [],
    research: [],
  };

  for (const building of activeBuildings.value) {
    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def) continue;

    if (def.capacity) {
      categories.housing.push(building);
    } else if (def.moraleBoost) {
      categories.recreation.push(building);
    } else if (def.workerRole === "research") {
      categories.research.push(building);
    } else if (def.production?.food || def.production?.water || def.production?.oxygen) {
      categories.production.push(building);
    } else {
      categories.infrastructure.push(building);
    }
  }

  return categories;
});
</script>

<template>
  <div class="colony-view">
    <ColonyStatsBar />

    <HousingSection
      :buildings="buildingsByCategory.housing"
      :housing-assignments="state.housingAssignments"
      :building-definitions="state.buildingDefinitions"
      :skill-definitions="state.skillDefinitions"
    />

    <UnhousedSection
      v-if="state.unhoused.length > 0"
      :colonists="state.unhoused"
      :buildings="state.buildings"
      :building-definitions="state.buildingDefinitions"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.production.length > 0"
      title="Production"
      :buildings="buildingsByCategory.production"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.infrastructure.length > 0"
      title="Infrastructure"
      :buildings="buildingsByCategory.infrastructure"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.recreation.length > 0"
      title="Recreation"
      :buildings="buildingsByCategory.recreation"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.research.length > 0"
      title="Research"
      :buildings="buildingsByCategory.research"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />
  </div>
</template>

<style scoped>
.colony-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/ColonyViewTab.vue
git commit -m "feat(ui): add ColonyViewTab main component"
```

---

## Task 5: Create ColonyStatsBar Component

**Files:**
- Create: `src/renderer/components/ColonyView/ColonyStatsBar.vue`

**Step 1: Create the stats bar component**

Create `src/renderer/components/ColonyView/ColonyStatsBar.vue`:

```vue
<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { GPanel, GProgress } from "../../ui";
import { getHealthVariant, getMoraleVariant } from "../../utils/displayThresholds";

const state = gameService.getState();
</script>

<template>
  <GPanel title="Colony Overview">
    <div class="stats-bar">
      <div class="stat">
        <span class="label">Population</span>
        <span class="value">{{ state.population }}</span>
      </div>
      <div class="stat">
        <span class="label">Health</span>
        <GProgress
          :value="state.health"
          :max="100"
          :variant="getHealthVariant(state.health)"
          show-label
        />
      </div>
      <div class="stat">
        <span class="label">Morale</span>
        <GProgress
          :value="state.morale"
          :max="100"
          :variant="getMoraleVariant(state.morale)"
          show-label
        />
      </div>
      <div class="stat" v-if="state.moraleBoost > 0">
        <span class="label">Recreation Bonus</span>
        <span class="value positive">+{{ state.moraleBoost }}</span>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.stats-bar {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 100px;
}

.label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.value {
  font-size: var(--g-font-size-lg);
  font-weight: bold;
}

.value.positive {
  color: var(--color-positive);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/ColonyStatsBar.vue
git commit -m "feat(ui): add ColonyStatsBar component"
```

---

## Task 6: Create BuildingSection Component

**Files:**
- Create: `src/renderer/components/ColonyView/BuildingSection.vue`

**Step 1: Create the building section component**

Create `src/renderer/components/ColonyView/BuildingSection.vue`:

```vue
<script setup lang="ts">
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GPanel } from "../../ui";
import BuildingEntry from "./BuildingEntry.vue";

defineProps<{
  title: string;
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();
</script>

<template>
  <GPanel :title="title">
    <div class="building-list">
      <BuildingEntry
        v-for="building in buildings"
        :key="building.id"
        :building="building"
        :definition="buildingDefinitions.find((d) => d.id === building.definitionId)"
        :colonists="colonists"
        :skill-definitions="skillDefinitions"
      />
    </div>
  </GPanel>
</template>

<style scoped>
.building-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/BuildingSection.vue
git commit -m "feat(ui): add BuildingSection component"
```

---

## Task 7: Create BuildingEntry Component

**Files:**
- Create: `src/renderer/components/ColonyView/BuildingEntry.vue`

**Step 1: Create the building entry component**

Create `src/renderer/components/ColonyView/BuildingEntry.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { ROLE_DISPLAY_NAMES, MASTERY_DISPLAY_NAMES } from "../../../core/models/Colonist";
import { GBadge, GProgress } from "../../ui";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  building: Building;
  definition?: BuildingDefinition;
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusVariant = computed(() => {
  switch (props.building.status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "disabled":
      return "neutral";
    case "idle":
      return "neutral";
    case "recycling":
      return "warning";
    default:
      return "neutral";
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusLabel = computed(() => {
  if (props.building.broken) return "Broken";
  switch (props.building.status) {
    case "active":
      return "Active";
    case "pending":
      return "Building";
    case "disabled":
      return "Disabled";
    case "idle":
      return "Idle";
    case "recycling":
      return "Recycling";
    default:
      return props.building.status;
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const assignedWorkers = computed(() => {
  return props.building.assignedWorkers
    .map((id) => props.colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => c !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workerSlots = computed(() => props.definition?.workerSlots || 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getColonistSkills(colonist: Colonist): SkillDefinition[] {
  return colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatResourceDelta(delta: Record<string, number> | undefined): string {
  if (!delta) return "";
  return Object.entries(delta)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
    .join(", ");
}
</script>

<template>
  <div class="building-entry" :class="{ broken: building.broken }">
    <div class="building-header">
      <div class="building-title">
        <span class="building-name">{{ definition?.name || building.definitionId }}</span>
        <span class="building-id">#{{ building.id.split("_").pop() }}</span>
      </div>
      <div class="building-status">
        <GBadge :variant="building.broken ? 'danger' : statusVariant">
          {{ statusLabel }}
        </GBadge>
        <span class="condition" v-if="building.status === 'active'">
          {{ Math.round(building.condition) }}%
        </span>
      </div>
    </div>

    <div class="building-stats" v-if="building.status === 'active'">
      <span v-if="definition?.production" class="production">
        Production: {{ formatResourceDelta(definition.production) }}
      </span>
      <span v-if="definition?.consumption" class="consumption">
        Consumption: {{ formatResourceDelta(definition.consumption) }}
      </span>
      <span class="efficiency">
        Efficiency: {{ building.condition >= 50 ? 100 : Math.round(building.condition * 2) }}%
      </span>
    </div>

    <div class="construction-progress" v-if="building.status === 'pending'">
      <GProgress
        :value="building.constructionProgress"
        :max="definition?.constructionTime || 10"
        variant="warning"
        show-label
      />
    </div>

    <div class="workers-section" v-if="workerSlots > 0">
      <div class="workers-header">
        Workers ({{ assignedWorkers.length }}/{{ workerSlots }}):
      </div>
      <div class="workers-list">
        <div v-for="worker in assignedWorkers" :key="worker.id" class="worker-row">
          <span class="worker-name">{{ worker.name }}</span>
          <span class="worker-role">
            {{ ROLE_DISPLAY_NAMES[worker.role] }} ({{ MASTERY_DISPLAY_NAMES[worker.masteryLevel] }})
          </span>
          <div class="worker-skills">
            <ColonistSkillBadge
              v-for="skill in getColonistSkills(worker)"
              :key="skill.id"
              :skill="skill"
              :is-active="skill.affinity.includes(worker.role)"
              size="small"
            />
          </div>
        </div>
        <div
          v-for="i in workerSlots - assignedWorkers.length"
          :key="'empty-' + i"
          class="worker-row empty"
        >
          <span class="empty-slot">(Empty slot)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.building-entry {
  padding: 0.75rem;
  background: var(--g-color-bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--g-color-border);
}

.building-entry.broken {
  border-color: var(--color-danger);
}

.building-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.building-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.building-name {
  font-weight: bold;
}

.building-id {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.building-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.condition {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.building-stats {
  display: flex;
  gap: 1rem;
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.production {
  color: var(--color-positive);
}

.consumption {
  color: var(--color-negative);
}

.construction-progress {
  margin-bottom: 0.5rem;
}

.workers-section {
  border-top: 1px solid var(--g-color-border);
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}

.workers-header {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: 0.5rem;
}

.workers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.worker-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
  padding-left: 0.5rem;
  border-left: 2px solid var(--g-color-border);
}

.worker-row.empty {
  opacity: 0.5;
}

.worker-name {
  font-weight: 500;
  min-width: 120px;
}

.worker-role {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  min-width: 140px;
}

.worker-skills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.empty-slot {
  font-style: italic;
  color: var(--g-color-text-muted);
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/BuildingEntry.vue
git commit -m "feat(ui): add BuildingEntry component with worker details"
```

---

## Task 8: Create HousingSection Component

**Files:**
- Create: `src/renderer/components/ColonyView/HousingSection.vue`

**Step 1: Create the housing section component**

Create `src/renderer/components/ColonyView/HousingSection.vue`:

```vue
<script setup lang="ts">
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GPanel } from "../../ui";
import HabitatEntry from "./HabitatEntry.vue";

defineProps<{
  buildings: Building[];
  housingAssignments: Record<string, Colonist[]>;
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
}>();
</script>

<template>
  <GPanel title="Housing">
    <div class="housing-list">
      <HabitatEntry
        v-for="building in buildings"
        :key="building.id"
        :building="building"
        :definition="buildingDefinitions.find((d) => d.id === building.definitionId)"
        :residents="housingAssignments[building.id] || []"
        :skill-definitions="skillDefinitions"
      />
      <div v-if="buildings.length === 0" class="no-housing">
        No habitats built. Colonists need housing!
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.housing-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-housing {
  padding: 1rem;
  text-align: center;
  color: var(--color-warning);
  font-style: italic;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/HousingSection.vue
git commit -m "feat(ui): add HousingSection component"
```

---

## Task 9: Create HabitatEntry Component

**Files:**
- Create: `src/renderer/components/ColonyView/HabitatEntry.vue`

**Step 1: Create the habitat entry component**

Create `src/renderer/components/ColonyView/HabitatEntry.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GBadge, GProgress } from "../../ui";
import ColonistRow from "./ColonistRow.vue";

const props = defineProps<{
  building: Building;
  definition?: BuildingDefinition;
  residents: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const capacity = computed(() => props.definition?.capacity || 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusVariant = computed(() => {
  if (props.building.broken) return "danger";
  if (props.building.status === "pending") return "warning";
  return "success";
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusLabel = computed(() => {
  if (props.building.broken) return "Broken";
  if (props.building.status === "pending") return "Building";
  return "Active";
});
</script>

<template>
  <div class="habitat-entry" :class="{ broken: building.broken }">
    <div class="habitat-header">
      <div class="habitat-title">
        <span class="habitat-name">{{ definition?.name || building.definitionId }}</span>
        <span class="habitat-id">#{{ building.id.split("_").pop() }}</span>
      </div>
      <div class="habitat-status">
        <GBadge :variant="statusVariant">{{ statusLabel }}</GBadge>
        <span class="condition" v-if="building.status === 'active'">
          {{ Math.round(building.condition) }}%
        </span>
      </div>
    </div>

    <div class="construction-progress" v-if="building.status === 'pending'">
      <GProgress
        :value="building.constructionProgress"
        :max="definition?.constructionTime || 10"
        variant="warning"
        show-label
      />
    </div>

    <div class="residents-header" v-if="building.status === 'active'">
      Residents: {{ residents.length }}/{{ capacity }}
    </div>

    <div class="residents-list" v-if="building.status === 'active' && residents.length > 0">
      <ColonistRow
        v-for="colonist in residents"
        :key="colonist.id"
        :colonist="colonist"
        :skill-definitions="skillDefinitions"
        show-workplace
      />
    </div>

    <div
      v-if="building.status === 'active' && residents.length === 0"
      class="no-residents"
    >
      No residents assigned
    </div>
  </div>
</template>

<style scoped>
.habitat-entry {
  padding: 0.75rem;
  background: var(--g-color-bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--g-color-border);
}

.habitat-entry.broken {
  border-color: var(--color-danger);
}

.habitat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.habitat-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.habitat-name {
  font-weight: bold;
}

.habitat-id {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.habitat-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.condition {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.construction-progress {
  margin-bottom: 0.5rem;
}

.residents-header {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--g-color-border);
}

.residents-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-residents {
  font-style: italic;
  color: var(--g-color-text-muted);
  padding: 0.5rem 0;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/HabitatEntry.vue
git commit -m "feat(ui): add HabitatEntry component with resident display"
```

---

## Task 10: Create ColonistRow Component

**Files:**
- Create: `src/renderer/components/ColonyView/ColonistRow.vue`

**Step 1: Create the colonist row component**

Create `src/renderer/components/ColonyView/ColonistRow.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Colonist, SkillDefinition, Building, BuildingDefinition } from "../../../facade";
import { ROLE_DISPLAY_NAMES, MASTERY_DISPLAY_NAMES, ColonistRole } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
  showWorkplace?: boolean;
}>();

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workplace = computed(() => {
  if (!props.showWorkplace) return null;

  // Find building where this colonist works
  for (const building of state.buildings) {
    if (building.assignedWorkers.includes(props.colonist.id)) {
      const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
      return {
        building,
        definition: def,
        name: def ? `${def.name} #${building.id.split("_").pop()}` : building.id,
      };
    }
  }
  return null;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isSkillActive(skill: SkillDefinition): boolean {
  return skill.affinity.includes(props.colonist.role);
}
</script>

<template>
  <div class="colonist-row">
    <div class="colonist-main">
      <span class="colonist-name">{{ colonist.name }}</span>
      <div class="colonist-details">
        <span class="colonist-role">
          {{ ROLE_DISPLAY_NAMES[colonist.role] }}
          ({{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }})
        </span>
        <span v-if="showWorkplace && workplace" class="workplace">
          → Works at: {{ workplace.name }}
        </span>
        <span
          v-else-if="showWorkplace && colonist.role === 'unassigned'"
          class="unassigned"
        >
          Unassigned
        </span>
      </div>
    </div>
    <div class="colonist-skills">
      <span class="skills-label">Skills:</span>
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="isSkillActive(skill)"
      />
    </div>
  </div>
</template>

<style scoped>
.colonist-row {
  padding: 0.5rem;
  padding-left: 0.75rem;
  border-left: 2px solid var(--g-color-border);
  background: var(--g-color-bg);
  border-radius: 0 4px 4px 0;
}

.colonist-main {
  margin-bottom: 0.25rem;
}

.colonist-name {
  font-weight: bold;
  display: block;
  margin-bottom: 0.25rem;
}

.colonist-details {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.colonist-role {
  margin-right: 0.5rem;
}

.workplace {
  color: var(--color-info);
}

.unassigned {
  font-style: italic;
}

.colonist-skills {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.skills-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-right: 4px;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/ColonistRow.vue
git commit -m "feat(ui): add ColonistRow component for colonist display"
```

---

## Task 11: Create UnhousedSection Component

**Files:**
- Create: `src/renderer/components/ColonyView/UnhousedSection.vue`

**Step 1: Create the unhoused section component**

Create `src/renderer/components/ColonyView/UnhousedSection.vue`:

```vue
<script setup lang="ts">
import type { Colonist, Building, BuildingDefinition, SkillDefinition } from "../../../facade";
import { GPanel } from "../../ui";
import ColonistRow from "./ColonistRow.vue";

defineProps<{
  colonists: Colonist[];
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
}>();
</script>

<template>
  <GPanel title="Unhoused" variant="danger">
    <div class="warning-message">
      These colonists have no housing assignment. Build more habitats!
    </div>
    <div class="unhoused-list">
      <ColonistRow
        v-for="colonist in colonists"
        :key="colonist.id"
        :colonist="colonist"
        :skill-definitions="skillDefinitions"
        show-workplace
      />
    </div>
  </GPanel>
</template>

<style scoped>
.warning-message {
  padding: 0.5rem;
  background: var(--bg-danger);
  border-radius: 4px;
  margin-bottom: 0.75rem;
  font-size: var(--g-font-size-sm);
  color: var(--color-warning);
}

.unhoused-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
```

**Step 2: Commit**

```bash
git add src/renderer/components/ColonyView/UnhousedSection.vue
git commit -m "feat(ui): add UnhousedSection component with warning display"
```

---

## Task 12: Register Route and Tab

**Files:**
- Modify: `src/renderer/router.ts`
- Modify: `src/renderer/components/TabNav.vue`

**Step 1: Add route for Colony View**

In `src/renderer/router.ts`, add the new route:

```typescript
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/main",
    },
    {
      path: "/main",
      name: "main",
      component: () => import("./components/MainTab.vue"),
    },
    {
      path: "/colony",
      name: "colony",
      component: () => import("./components/ColonyView/ColonyViewTab.vue"),
    },
    {
      path: "/politics",
      name: "politics",
      component: () => import("./components/PoliticsTab.vue"),
    },
    {
      path: "/research",
      name: "research",
      component: () => import("./components/ResearchTab.vue"),
    },
    {
      path: "/ui",
      name: "ui-showcase",
      component: () => import("./components/UIShowcase.vue"),
    },
  ],
});

export default router;
```

**Step 2: Add tab link in TabNav**

In `src/renderer/components/TabNav.vue`, add the Colony link:

```vue
<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <nav class="tab-nav">
    <RouterLink to="/main" class="tab-link" active-class="active">
      Main
    </RouterLink>
    <RouterLink to="/colony" class="tab-link" active-class="active">
      Colony
    </RouterLink>
    <RouterLink to="/politics" class="tab-link" active-class="active">
      Politics
    </RouterLink>
    <RouterLink to="/research" class="tab-link" active-class="active">
      Research
    </RouterLink>
  </nav>
</template>

<!-- styles unchanged -->
```

**Step 3: Commit**

```bash
git add src/renderer/router.ts src/renderer/components/TabNav.vue
git commit -m "feat(routing): add Colony View tab to navigation"
```

---

## Task 13: Integration and Testing

**Files:**
- Modify: `src/core/GameState.ts` (if housing assignment not yet integrated)

**Step 1: Verify housing assignment is called in game tick**

Check `src/core/GameState.ts` tick method includes housing assignment after building tick:

```typescript
// In tick() method, after buildings.tick() and colony.tick():
this.colonyManager.assignHousing(this.buildingManager);
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Manual testing**

Run: `bun run dev`

Test checklist:
- [ ] Colony tab appears in navigation
- [ ] Stats bar shows population, health, morale
- [ ] Building habitats causes colonists to be assigned
- [ ] Residents appear under their habitat
- [ ] Unhoused section appears when population > capacity
- [ ] Building sections show workers correctly
- [ ] Status badges show correct colors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(colony-view): complete integration and testing"
```

---

## Summary

This plan implements the Colony View feature in 13 tasks:

1. **Data Models** - Add `housingId` to Colonist, `capacity` to BuildingDefinition
2. **Housing Logic** - Implement auto-assignment in ColonyManager
3. **GameService** - Expose housing data to Vue
4. **ColonyViewTab** - Main container component
5. **ColonyStatsBar** - Population/health/morale display
6. **BuildingSection** - Category grouping component
7. **BuildingEntry** - Individual building with workers
8. **HousingSection** - Habitat container
9. **HabitatEntry** - Habitat with residents
10. **ColonistRow** - Reusable colonist display
11. **UnhousedSection** - Warning for homeless colonists
12. **Routing** - Register tab and route
13. **Integration** - Final testing and verification
