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
      <span class="expand-icon">{{ isExpanded ? "▼" : "▶" }}</span>
      <span class="role-name">{{ ROLE_DISPLAY_NAMES[role] }}</span>
      <span class="role-stats"
        >({{ buildings.length }} buildings, {{ stats.filled }}/{{ stats.total }} workers)</span
      >
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
