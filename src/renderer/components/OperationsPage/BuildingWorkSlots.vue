<script setup lang="ts">
import { computed } from "vue";
import type {
  Building,
  BuildingDefinition,
  Colonist,
  ColonistRole,
  SkillDefinition,
} from "../../../facade";
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
      full: emptySlots === 0,
    }"
  >
    <div class="building-header">
      <span class="building-name">{{ definition.name }} #{{ building.id.split("_").pop() }}</span>
      <span v-if="skillBonus !== null" class="skill-bonus"
        >+{{ Math.round(skillBonus * 100) }}%</span
      >
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
