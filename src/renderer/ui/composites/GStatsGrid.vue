<script setup lang="ts">
import type { Component } from "vue";

export interface GridStat {
  key: string;
  icon: Component;
  count: number;
  label: string;
}

defineProps<{
  title: string;
  stats: GridStat[];
}>();
</script>

<template>
  <div class="stats-grid-section">
    <h3>{{ title }}</h3>
    <div class="stats-grid">
      <div v-for="stat in stats" :key="stat.key" class="stats-item">
        <span class="stat-icon"><component :is="stat.icon" :size="16" /></span>
        <span class="stat-count">{{ stat.count }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid-section {
  margin-top: var(--g-space-md);
  padding-top: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.stats-grid-section h3 {
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-sm);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--g-space-xs);
}

.stats-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-sm);
  font-size: var(--g-font-size-sm);
}

.stat-icon {
  font-size: 1rem;
}

.stat-count {
  font-family: var(--g-font-mono);
  font-weight: bold;
  min-width: 20px;
}

.stat-label {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
}
</style>
