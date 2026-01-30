<script setup lang="ts">
import { ref } from "vue";
import type { Colonist, SkillDefinition } from "../../../facade";
import { GSection } from "../../ui";
import ColonistDragCard from "../OperationsPage/ColonistDragCard.vue";

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
    class="unhoused-pool"
    :class="{ 'drag-over': isDragOver, 'has-unhoused': colonists.length > 0 }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <GSection title="Unhoused Colonists" :variant="colonists.length > 0 ? 'danger' : undefined">
      <template #header-actions>
        <span class="colonist-count" :class="{ danger: colonists.length > 0 }">{{
          colonists.length
        }}</span>
      </template>
      <div v-if="colonists.length === 0" class="empty-state">
        All colonists are housed. Drag here to remove from housing.
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
.unhoused-pool {
  min-width: 280px;
  max-width: 320px;
  transition: all var(--g-transition-fast);
}

.unhoused-pool.drag-over {
  background: rgba(0, 188, 212, 0.1);
}

.unhoused-pool.has-unhoused :deep(.g-section) {
  border-color: var(--g-color-danger);
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

.colonist-count {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  background: var(--g-color-bg-base);
  padding: 2px 8px;
  border-radius: 2px;
}

.colonist-count.danger {
  color: var(--g-color-danger);
  background: rgba(198, 40, 40, 0.2);
}
</style>
