<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";

// State will be used in later tasks for grid visualization
// oxlint-disable-next-line no-unused-vars
const state = computed(() => gameService.getState());
</script>

<template>
  <div class="base-tab">
    <header class="base-header">
      <h2>Base Grid</h2>
      <div class="power-summary">
        <span>Power: Coming soon</span>
      </div>
    </header>

    <div class="grid-container">
      <p class="placeholder">Grid visualization coming soon...</p>
    </div>
  </div>
</template>

<style scoped>
.base-tab {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  height: 100%;
}

.base-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.base-header h2 {
  margin: 0;
  font-size: var(--g-font-size-lg);
}

.power-summary {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.grid-container {
  flex: 1;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  color: var(--g-color-text-muted);
  font-style: italic;
}
</style>
