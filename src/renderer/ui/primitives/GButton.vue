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
  }
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
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background var(--g-transition-fast),
    border-color var(--g-transition-fast),
    box-shadow var(--g-transition-fast);
}

.g-button:focus-visible {
  outline: none;
  box-shadow: var(--g-glow-focus);
}

.g-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.g-button--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.g-button--md {
  padding: var(--g-space-sm) var(--g-space-md);
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-button--primary {
  background: var(--g-color-info);
  color: oklch(10% 0.02 250);
  border-color: var(--g-color-info);
}

.g-button--primary:hover:not(:disabled) {
  background: oklch(70% 0.15 250);
  box-shadow: var(--g-glow-subtle);
}

.g-button--secondary {
  background: transparent;
  color: var(--g-color-text);
  border-color: var(--g-color-border);
}

.g-button--secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
  box-shadow: var(--g-glow-subtle);
}

.g-button--danger {
  background: transparent;
  color: var(--g-color-negative);
  border-color: var(--g-color-negative);
}

.g-button--danger:hover:not(:disabled) {
  background: oklch(60% 0.2 25 / 0.15);
  box-shadow: 0 0 8px oklch(60% 0.2 25 / 0.3);
}

.g-button--ghost {
  background: transparent;
  color: var(--g-color-text-muted);
  border-color: transparent;
}

.g-button--ghost:hover:not(:disabled) {
  color: var(--g-color-text);
  background: var(--g-color-bg-elevated);
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
  border: 2px solid var(--g-color-text-muted);
  border-top-color: var(--g-color-info);
  border-radius: 50%;
  animation: g-spin 0.6s linear infinite;
}

@keyframes g-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
