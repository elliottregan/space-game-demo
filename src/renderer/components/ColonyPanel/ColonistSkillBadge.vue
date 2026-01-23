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
  border-radius: 3px;
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg-elevated);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}

.skill-badge.active {
  background: color-mix(in srgb, var(--color-positive) 20%, transparent);
  color: var(--color-positive);
  border-color: var(--color-positive);
}
</style>
