<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import GProgress from "../primitives/GProgress.vue";

export type MetricVariant = "default" | "positive" | "negative" | "warning";

const props = withDefaults(
  defineProps<{
    label: string;
    value: number; // 0-1
    icon?: Component;
    variant?: MetricVariant;
    thresholds?: { warning?: number; critical?: number }; // values below these trigger variant
  }>(),
  {
    variant: undefined,
    thresholds: undefined,
  },
);

const percent = computed(() => Math.round(props.value * 100));

const computedVariant = computed<MetricVariant>(() => {
  if (props.variant) return props.variant;
  if (!props.thresholds) return "default";

  const { warning = 0.5, critical = 0.25 } = props.thresholds;
  if (props.value >= warning) return "positive";
  if (props.value >= critical) return "warning";
  return "negative";
});
</script>

<template>
  <div class="metric-bar">
    <div class="metric-header">
      <component :is="icon" v-if="icon" :size="16" class="metric-icon" />
      <span class="metric-label">{{ label }}</span>
      <span class="metric-value" :class="`metric-value--${computedVariant}`"> {{ percent }}% </span>
    </div>
    <GProgress :percent="percent" :variant="computedVariant" />
  </div>
</template>

<style scoped>
.metric-bar {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.metric-icon {
  color: var(--g-color-info);
}

.metric-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.metric-value {
  margin-left: auto;
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.metric-value--default {
  color: var(--g-color-text);
}

.metric-value--positive {
  color: var(--g-color-positive);
}

.metric-value--warning {
  color: var(--g-color-warning);
}

.metric-value--negative {
  color: var(--g-color-negative);
}
</style>
