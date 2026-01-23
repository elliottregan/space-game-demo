<script setup lang="ts">
export interface SelectOption {
  value: string | number;
  label: string;
}

withDefaults(
  defineProps<{
    modelValue?: string | number;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    size?: "sm" | "md";
  }>(),
  {
    placeholder: "",
    disabled: false,
    size: "md",
  },
);

defineEmits<{
  "update:modelValue": [value: string | number];
}>();
</script>

<template>
  <div class="g-select-wrapper" :class="`g-select-wrapper--${size}`">
    <select
      class="g-select"
      :class="`g-select--${size}`"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
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
  background: var(--g-color-bg);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  cursor: pointer;
  appearance: none;
  padding-right: calc(var(--g-space-md) + 1em);
  transition:
    border-color var(--g-transition-fast),
    box-shadow var(--g-transition-fast);
}

.g-select:focus {
  outline: none;
  border-color: var(--g-color-border-focus);
  box-shadow: var(--g-glow-subtle);
}

.g-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
</style>
