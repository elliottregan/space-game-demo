<script setup lang="ts">
import { computed } from "vue";
import { ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
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
}
</style>
