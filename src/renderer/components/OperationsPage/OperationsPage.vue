<script setup lang="ts">
import { computed, ref } from "vue";
import { ColonistRole } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import { GButton, GPanel } from "../../ui";
import BuildingRoleGroup from "./BuildingRoleGroup.vue";
import ColonistPool from "./ColonistPool.vue";

const state = gameService.getState();

// Drag and selection state
const selectedColonistId = ref<string | null>(null);
const draggingColonistId = ref<string | null>(null);

// Auto-assign toggle state
const autoAssignEnabled = ref(gameService.getAutoAssignNewColonists());

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

// Workforce controls
const understaffedSlots = computed(() => {
  let total = 0;
  for (const building of state.buildings) {
    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.workerSlots || building.status !== "active") continue;
    total += def.workerSlots - building.assignedWorkers.length;
  }
  return total;
});

function handleOptimizeWorkforce() {
  gameService.optimizeWorkforce();
}

function handleToggleAutoAssign(e: Event) {
  const target = e.target as HTMLInputElement;
  autoAssignEnabled.value = target.checked;
  gameService.setAutoAssignNewColonists(target.checked);
}
</script>

<template>
  <div class="operations-page">
    <GPanel title="Workforce Assignment" accent="amber">
      <div class="workforce-controls">
        <div class="workforce-left">
          <span class="workforce-stat">
            Unassigned: {{ unassignedColonists.length }} | Open slots: {{ understaffedSlots }}
          </span>
          <label class="toggle-label">
            <input type="checkbox" :checked="autoAssignEnabled" @change="handleToggleAutoAssign" />
            Auto-assign new colonists
          </label>
        </div>
        <GButton
          size="sm"
          :disabled="unassignedColonists.length === 0 || understaffedSlots === 0"
          @click="handleOptimizeWorkforce"
        >
          Optimize Workforce
        </GButton>
      </div>

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
            No buildings require workers yet. Build farms, research labs, or other staffed
            buildings.
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

.workforce-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--g-space-md);
  margin-bottom: var(--g-space-md);
  padding: var(--g-space-sm);
  background: rgba(128, 128, 128, 0.1);
  border-radius: var(--g-radius-sm);
}

.workforce-left {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.workforce-stat {
  font-size: 0.85em;
  color: var(--g-color-muted);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  font-size: 0.8em;
  color: var(--g-color-muted);
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  cursor: pointer;
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
