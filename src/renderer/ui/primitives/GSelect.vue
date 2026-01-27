<script setup lang="ts">
export interface SelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

withDefaults(
  defineProps<{
    modelValue?: string | number;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    size?: "sm" | "md";
    variant?: "primary" | "secondary" | "ghost";
  }>(),
  {
    placeholder: "",
    disabled: false,
    size: "md",
    variant: "secondary",
  },
);

defineEmits<{
  "update:modelValue": [value: string | number];
}>();
</script>

<template>
  <div class="g-select-wrapper" :class="[`g-select-wrapper--${size}`, `g-select-wrapper--${variant}`]">
    <select
      class="g-select"
      :class="[`g-select--${size}`, `g-select--${variant}`]"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <span class="g-select__arrow">&#9662;</span>
  </div>
</template>

<style scoped>
.g-select-wrapper {
  position: relative;
  display: inline-block;
}

.g-select {
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  cursor: pointer;
  appearance: none;
  padding-right: calc(var(--g-space-md) + 1em);
  transition: border-color var(--g-transition-fast);
}

.g-select:focus {
  outline: none;
  border-color: var(--g-color-border-focus);
}

.g-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--g-color-bg-surface);
}

.g-select__arrow {
  position: absolute;
  right: var(--g-space-sm);
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--g-color-text-muted);
  font-size: 0.75em;
}

/* Sizes */
.g-select--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  padding-right: calc(var(--g-space-sm) + 1.5em);
  font-size: var(--g-font-size-xs);
}

.g-select--md {
  padding: var(--g-space-sm) var(--g-space-md);
  padding-right: calc(var(--g-space-md) + 1.5em);
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-select--primary {
  background: var(--g-accent-red);
  color: white;
  border-color: var(--g-accent-red);
}

.g-select--primary:hover:not(:disabled) {
  filter: brightness(0.9);
}

.g-select-wrapper--primary .g-select__arrow {
  color: white;
}

.g-select--secondary {
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border-color: var(--g-color-border);
}

.g-select--secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
  background: var(--g-color-bg-surface);
}

.g-select--ghost {
  background: transparent;
  color: var(--g-color-text-muted);
  border-color: transparent;
}

.g-select--ghost:hover:not(:disabled) {
  color: var(--g-color-text);
  background: var(--g-color-bg-surface);
}
</style>
