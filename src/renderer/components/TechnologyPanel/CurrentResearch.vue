<script setup lang="ts">
import { GButton, GProgress, GEmptyState } from "../../ui";
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
  <GEmptyState v-else message="No active research" variant="boxed" />
</template>

<style scoped>
.current-research {
  background: rgba(0, 131, 143, 0.1);
  border: 1px solid var(--g-accent-cyan);
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
  color: var(--g-accent-cyan);
}</style>
