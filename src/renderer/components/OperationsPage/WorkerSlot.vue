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
