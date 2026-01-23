<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    percent: number;
    variant?: "default" | "positive" | "negative" | "warning";
    showLabel?: boolean;
    label?: string;
  }>(),
  {
    variant: "default",
    showLabel: false,
  },
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const clampedPercent = computed(() => Math.max(0, Math.min(100, props.percent)));

// biome-ignore lint/correctness/noUnusedVariables: used in template
const displayLabel = computed(() => {
  if (props.label) return props.label;
  return `${Math.round(props.percent)}%`;
});
</script>

<template>
  <div class="g-progress" :class="`g-progress--${variant}`">
    <div class="g-progress__track">
      <div class="g-progress__fill" :style="{ width: `${clampedPercent}%` }" />
    </div>
    <span v-if="showLabel" class="g-progress__label">
      <slot>{{ displayLabel }}</slot>
    </span>
  </div>
</template>

<style scoped>
.g-progress {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.g-progress__track {
  flex: 1;
  height: 4px;
  background: var(--g-color-bg-elevated);
  overflow: hidden;
}

.g-progress__fill {
  height: 100%;
  transition: width var(--g-transition-normal);
}

.g-progress__label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  min-width: 3em;
  text-align: right;
}

/* Variants */
.g-progress--default .g-progress__fill {
  background: var(--g-color-info);
  box-shadow: inset 0 0 4px oklch(65% 0.15 250 / 0.5);
}

.g-progress--positive .g-progress__fill {
  background: var(--g-color-positive);
  box-shadow: inset 0 0 4px oklch(70% 0.17 145 / 0.5);
}

.g-progress--negative .g-progress__fill {
  background: var(--g-color-negative);
  box-shadow: inset 0 0 4px oklch(60% 0.2 25 / 0.5);
}

.g-progress--warning .g-progress__fill {
  background: var(--g-color-warning);
  box-shadow: inset 0 0 4px oklch(75% 0.15 70 / 0.5);
}
</style>
