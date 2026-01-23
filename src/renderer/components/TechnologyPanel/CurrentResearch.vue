<script setup lang="ts">
import { GButton, GProgress } from "../../ui";
import type { Technology } from "../../../core/models/Technology";

defineProps<{
  tech: Technology | null;
  progress: number;
  currentProgress: number;
  requiredSols: number;
}>();

defineEmits<{
  cancel: [];
}>();
</script>

<template>
  <div v-if="tech" class="current-research">
    <div class="research-header">
      <span class="research-name">{{ tech.name }}</span>
      <GButton variant="secondary" size="sm" @click="$emit('cancel')">Cancel</GButton>
    </div>
    <GProgress :percent="progress" showLabel>
      {{ Math.floor(currentProgress) }} / {{ requiredSols }} sols
    </GProgress>
  </div>
  <div v-else class="no-research">
    No active research
  </div>
</template>

<style scoped>
.current-research {
  background: oklch(65% 0.15 250 / 0.1);
  border: 1px solid var(--g-color-info);
  border-radius: 4px;
  padding: var(--g-space-md);
  margin-bottom: var(--g-space-md);
}

.research-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-sm);
}

.research-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-info);
}

.no-research {
  color: var(--g-color-text-muted);
  font-style: italic;
  padding: var(--g-space-md);
  text-align: center;
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  margin-bottom: var(--g-space-md);
}
</style>
