<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    disabled?: boolean;
    size?: "sm" | "md";
  }>(),
  {
    modelValue: "",
    placeholder: "",
    disabled: false,
    size: "md",
  },
);

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <input
    type="text"
    class="g-input"
    :class="`g-input--${size}`"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.g-input {
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  transition: border-color var(--g-transition-fast);
  width: 100%;
  box-sizing: border-box;
}

.g-input::placeholder {
  color: var(--g-color-text-muted);
}

.g-input:focus {
  outline: none;
  border-color: var(--g-color-border-focus);
}

.g-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--g-color-bg-surface);
}

/* Sizes */
.g-input--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
}

.g-input--md {
  padding: var(--g-space-sm) var(--g-space-md);
  font-size: var(--g-font-size-sm);
}
</style>
