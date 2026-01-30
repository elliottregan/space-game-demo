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

@media (max-width: 768px) {
  .operations-layout {
    flex-direction: column;
  }

  .colonist-pool {
    max-width: none;
  }
}
</style>
