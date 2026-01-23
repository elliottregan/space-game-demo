<script setup lang="ts">
defineProps<{
  title: string;
  completed?: boolean;
}>();
</script>

<template>
  <div class="tech-section">
    <h3>{{ title }}</h3>
    <div class="tech-list" :class="{ completed }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tech-section {
  margin-bottom: var(--g-space-md);
}

.tech-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
  padding-bottom: var(--g-space-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.tech-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.tech-list.completed {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
}
</style>
