<script setup lang="ts">
import GProgress from "../primitives/GProgress.vue";

withDefaults(
  defineProps<{
    label: string;
    percent: number;
    sublabel?: string;
    variant?: "default" | "positive" | "negative" | "warning";
  }>(),
  {
    variant: "default",
  },
);
</script>

<template>
  <div class="g-progress-item">
    <span class="g-progress-item__label">{{ label }}</span>
    <GProgress :percent="percent" :variant="variant" showLabel>
      <slot name="sublabel">{{ sublabel }}</slot>
    </GProgress>
    <div v-if="$slots.actions" class="g-progress-item__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.g-progress-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.g-progress-item__label {
  font-size: var(--g-font-size-sm);
  min-width: 120px;
  flex-shrink: 0;
}

.g-progress-item__actions {
  flex-shrink: 0;
}
</style>
