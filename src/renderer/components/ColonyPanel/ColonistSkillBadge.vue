<script setup lang="ts">
import type { SkillDefinition } from "../../../facade";

defineProps<{
  skill: SkillDefinition;
  isActive: boolean;
}>();
</script>

<template>
  <span
    class="skill-badge"
    :class="{ active: isActive }"
    :title="`${skill.name}: ${skill.description} (${isActive ? '+' + (skill.efficiencyBonus * 100) + '% efficiency' : 'not active for current role'})`"
  >
    {{ skill.name }}
  </span>
</template>

<style scoped>
.skill-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: var(--g-font-size-xs);
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-surface);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}

.skill-badge.active {
  background: rgba(67, 160, 71, 0.15);
  color: var(--g-color-positive);
  border-color: var(--g-color-positive);
}
</style>
