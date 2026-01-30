<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist } from "../../../facade";
import { GEntityHeader } from "../../ui";
import ResidentSlot from "./ResidentSlot.vue";

const props = defineProps<{
  building: Building;
  definition: BuildingDefinition;
  residents: Colonist[];
  draggingColonistId: string | null;
}>();

const emit = defineEmits<{
  assign: [colonistId: string, buildingId: string];
  unassign: [colonistId: string];
}>();

const capacity = computed(() => props.definition.capacity || 0);

const emptySlots = computed(() => Math.max(0, capacity.value - props.residents.length));

const isValidDropTarget = computed(() => {
  if (!props.draggingColonistId) return false;
  if (props.building.status !== "active") return false;
  if (emptySlots.value === 0) return false;
  return true;
});

const isDragActive = computed(() => !!props.draggingColonistId);

function onDrop(colonistId: string) {
  emit("assign", colonistId, props.building.id);
}

function onUnassign(colonistId: string) {
  emit("unassign", colonistId);
}
</script>

<template>
  <div
    class="housing-card"
    :class="{
      'valid-target': isValidDropTarget,
      full: emptySlots === 0,
      inactive: building.status !== 'active',
    }"
  >
    <GEntityHeader
      :name="definition.name"
      :instance-id="building.id.split('_').pop() || ''"
      :status="building.status"
      :is-broken="building.broken"
      :condition="building.condition"
      :construction-progress="building.constructionProgress"
      :construction-max="definition.constructionTime || 10"
    >
      <template #progress-label>
        {{ Math.ceil((definition.constructionTime || 10) - building.constructionProgress) }} sols
      </template>
    </GEntityHeader>

    <template v-if="building.status === 'active'">
      <div class="capacity-header">
        <span>Residents</span>
        <span class="capacity-count">{{ residents.length }}/{{ capacity }}</span>
        <span v-if="emptySlots === 0 && isDragActive" class="full-badge">Full</span>
      </div>

      <div class="resident-slots">
        <ResidentSlot
          v-for="resident in residents"
          :key="resident.id"
          :colonist="resident"
          :is-valid-drop="false"
          :is-drag-active="isDragActive"
          @unassign="onUnassign"
        />
        <ResidentSlot
          v-for="i in emptySlots"
          :key="'empty-' + i"
          :is-valid-drop="isValidDropTarget"
          :is-drag-active="isDragActive"
          @drop="onDrop"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.housing-card {
  padding: var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  transition: all var(--g-transition-fast);
}

.housing-card.valid-target {
  border-color: var(--g-color-positive);
  box-shadow: 0 0 8px rgba(67, 160, 71, 0.3);
}

.housing-card.full {
  opacity: 0.7;
}

.housing-card.inactive {
  opacity: 0.5;
}

.capacity-header {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  margin: var(--g-space-sm) 0;
  padding-top: var(--g-space-sm);
  border-top: 1px solid var(--g-color-border);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.capacity-count {
  font-family: var(--g-font-mono);
  margin-left: auto;
}

.full-badge {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
}

.resident-slots {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
</style>
