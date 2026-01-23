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
  border-radius: 2px;
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
  background: var(--g-color-bg-elevated);
  color: var(--g-color-text);
}

.g-badge--info {
  background: oklch(65% 0.15 250 / 0.2);
  color: var(--g-color-info);
}

.g-badge--positive {
  background: oklch(70% 0.17 145 / 0.2);
  color: var(--g-color-positive);
}

.g-badge--negative {
  background: oklch(60% 0.2 25 / 0.2);
  color: var(--g-color-negative);
}

.g-badge--warning {
  background: oklch(75% 0.15 70 / 0.2);
  color: var(--g-color-warning);
}

.g-badge--muted {
  background: oklch(50% 0.02 250 / 0.2);
  color: var(--g-color-text-muted);
}
</style>
