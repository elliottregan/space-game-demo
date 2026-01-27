<script setup lang="ts">
import GProgress from "../primitives/GProgress.vue";
import type { Stat } from "../types";

defineProps<{
  stats: Stat[];
}>();
</script>

<template>
  <div class="g-stats-bar">
    <div v-for="stat in stats" :key="stat.label" class="g-stats-bar__stat">
      <span class="g-stats-bar__label">{{ stat.label }}</span>
      <span v-if="stat.value !== undefined" class="g-stats-bar__value" :class="stat.variant">
        {{ stat.prefix }}{{ stat.value }}
      </span>
      <GProgress
        v-else-if="stat.progress !== undefined"
        :percent="stat.progress"
        :variant="stat.variant"
        showLabel
      />
    </div>
  </div>
</template>

<style scoped>
.g-stats-bar {
  display: flex;
  gap: var(--g-space-xl);
  align-items: center;
  flex-wrap: wrap;
  font-family: var(--g-font-mono);
}

.g-stats-bar__stat {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  min-width: 100px;
}

.g-stats-bar__label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.g-stats-bar__value {
  font-size: var(--g-font-size-lg);
  font-weight: bold;
}

.g-stats-bar__value.positive {
  color: var(--g-color-positive);
}

.g-stats-bar__value.negative {
  color: var(--g-color-negative);
}

.g-stats-bar__value.warning {
  color: var(--g-color-warning);
}

.g-stats-bar__value.info {
  color: var(--g-color-info);
}
</style>
