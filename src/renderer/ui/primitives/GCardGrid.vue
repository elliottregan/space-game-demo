<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: string;
  }>(),
  {
    columns: "repeat(auto-fill, minmax(250px, 1fr))",
  },
);
</script>

<template>
  <div class="g-card-grid" :style="{ gridTemplateColumns: columns }">
    <slot />
  </div>
</template>

<style scoped>
.g-card-grid {
  display: grid;
  gap: var(--g-space-md);
}
</style>
