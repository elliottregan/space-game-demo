<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md";
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: "secondary",
    size: "md",
    disabled: false,
    loading: false,
  },
);
</script>

<template>
  <button
    class="g-button"
    :class="[`g-button--${variant}`, `g-button--${size}`, { 'g-button--loading': loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="g-button__spinner" />
    <slot />
  </button>
</template>

<style scoped>
.g-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    filter var(--g-transition-fast),
    border-color var(--g-transition-fast);
}

.g-button:focus-visible {
  outline: 2px solid var(--g-color-border-focus);
  outline-offset: 2px;
}

.g-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.g-button--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
}

.g-button--md {
  padding: var(--g-space-sm) var(--g-space-md);
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-button--primary {
  background: var(--g-accent-red);
  color: white;
  border-color: var(--g-accent-red);
}

.g-button--primary:hover:not(:disabled) {
  filter: brightness(0.9);
}

.g-button--secondary {
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border-color: var(--g-color-border);
}

.g-button--secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
  background: var(--g-color-bg-surface);
}

.g-button--danger {
  background: var(--g-color-negative);
  color: white;
  border-color: var(--g-color-negative);
}

.g-button--danger:hover:not(:disabled) {
  filter: brightness(0.9);
}

.g-button--ghost {
  background: transparent;
  color: var(--g-color-text-muted);
  border-color: transparent;
}

.g-button--ghost:hover:not(:disabled) {
  color: var(--g-color-text);
  background: var(--g-color-bg-surface);
}

/* Loading state */
.g-button--loading {
  position: relative;
  color: transparent;
}

.g-button__spinner {
  position: absolute;
  width: 1em;
  height: 1em;
  border: 2px solid var(--g-color-border);
  border-top-color: var(--g-color-text);
  animation: g-spin 0.6s linear infinite;
}

@keyframes g-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
