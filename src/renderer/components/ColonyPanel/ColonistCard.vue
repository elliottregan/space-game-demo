<script setup lang="ts">
import type { Colonist, SkillDefinition } from "../../../facade";
import { ROLE_DISPLAY_NAMES, MASTERY_DISPLAY_NAMES } from "../../../core/models/Colonist";
import ColonistSkillBadge from "./ColonistSkillBadge.vue";
import { computed } from "vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isSkillActive(skill: SkillDefinition): boolean {
  return skill.affinity.includes(props.colonist.role);
}
</script>

<template>
  <div class="colonist-card">
    <div class="colonist-header">
      <span class="colonist-name">{{ colonist.name }}</span>
      <span class="colonist-role">{{ ROLE_DISPLAY_NAMES[colonist.role] }}</span>
    </div>
    <div class="colonist-mastery">{{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }}</div>
    <div class="colonist-skills" v-if="colonistSkills.length > 0">
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
.colonist-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.colonist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.colonist-name {
  font-weight: bold;
  font-size: var(--g-font-size-sm);
}

.colonist-role {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.colonist-mastery {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.colonist-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
