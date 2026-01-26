<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "default" | "info" | "positive" | "negative" | "warning" | "muted";
    size?: "sm" | "md";
  }>(),
  {
    variant: "default",
    size: "sm",
  },
);
</script>

<template>
  <span class="g-badge" :class="[`g-badge--${variant}`, `g-badge--${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.g-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--g-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

/* Sizes */
.g-badge--sm {
  padding: 2px 6px;
  font-size: var(--g-font-size-xs);
}

.g-badge--md {
  padding: 4px 8px;
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-badge--default {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
}

.g-badge--info {
  background: var(--g-color-info);
  color: white;
}

.g-badge--positive {
  background: var(--g-color-positive);
  color: white;
}

.g-badge--negative {
  background: var(--g-color-negative);
  color: white;
}

.g-badge--warning {
  background: var(--g-color-warning);
  color: white;
}

.g-badge--muted {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}
</style>
