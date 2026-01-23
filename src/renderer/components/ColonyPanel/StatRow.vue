<script setup lang="ts">
import { GProgress } from "../../ui";

defineProps<{
  label: string;
  value?: number | string;
  progress?: number;
  variant?: "positive" | "warning" | "negative" | "info" | "default";
  showProgressLabel?: boolean;
}>();
</script>

<template>
  <div class="stat-row">
    <div class="stat">
      <span class="stat-label">{{ label }}</span>
      <span v-if="value !== undefined" class="stat-value" :class="variant">
        {{ value }}
      </span>
      <GProgress
        v-else-if="progress !== undefined"
        :percent="progress"
        :variant="variant"
        :showLabel="showProgressLabel"
      />
    </div>
  </div>
</template>

<style scoped>
.stat-row {
  margin-bottom: var(--g-space-md);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.stat-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  min-width: 80px;
}

.stat-value {
  font-family: var(--g-font-mono);
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-value.info {
  color: var(--g-color-info);
}

.stat-value.positive {
  color: var(--g-color-positive);
}

.stat-value.warning {
  color: var(--g-color-warning);
}

.stat-value.negative {
  color: var(--g-color-negative);
}
</style>
