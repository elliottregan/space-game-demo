<script setup lang="ts">
withDefaults(
  defineProps<{
    message: string;
    variant?: "inline" | "boxed";
  }>(),
  {
    variant: "inline",
  },
);
</script>

<template>
  <div class="g-empty-state" :class="`g-empty-state--${variant}`">
    {{ message }}
  </div>
</template>

<style scoped>
.g-empty-state {
  font-style: italic;
  color: var(--g-color-text-muted);
}

/* Inline variant: simple muted text, no background */
.g-empty-state--inline {
  font-size: var(--g-font-size-sm);
}

/* Boxed variant: with background, padding, centered */
.g-empty-state--boxed {
  padding: var(--g-space-md);
  text-align: center;
  background: var(--g-color-bg-surface);
}
</style>
