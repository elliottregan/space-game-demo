<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <div class="g-card">
    <div v-if="title" class="g-card__header">
      <span class="g-card__title">{{ title }}</span>
      <slot name="header-actions" />
    </div>
    <div class="g-card__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.g-card {
  padding: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
}

.g-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-sm);
}

.g-card__title {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.g-card__body {
  font-family: var(--g-font-mono);
}
</style>
