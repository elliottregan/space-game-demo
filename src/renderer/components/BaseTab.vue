<script setup lang="ts">
// BaseTab placeholder - the grid-based base view has been replaced by the district system.
// This route is kept as a stub until a new district-based base view is implemented.
</script>

<template>
  <div class="base-tab">
    <header class="base-header">
      <h2>Base Overview</h2>
      <p class="placeholder-text">
        The base grid has been replaced by the district system. See the colony view for district
        management.
      </p>
    </header>
  </div>
</template>

<style scoped>
.base-tab {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  height: 100%;
  position: relative;
}

.base-header {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.base-header h2 {
  margin: 0;
  font-size: var(--g-font-size-lg);
}

.placeholder-text {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
}
</style>
