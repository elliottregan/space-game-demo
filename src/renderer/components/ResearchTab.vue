<script setup lang="ts">
import { GPanel } from "../ui";
import TechTreeGraph from "./TechTreeGraph.vue";
</script>

<template>
  <div class="research-tab">
    <GPanel title="Technology Tree" class="research-panel">
      <TechTreeGraph />
    </GPanel>
  </div>
</template>

<style scoped>
.research-tab {
  height: calc(100vh - 180px);
  min-height: 500px;
}

.research-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.research-panel :deep(.g-panel__body) {
  flex: 1;
  min-height: 0;
  padding: var(--g-space-sm);
  overflow: hidden;
}

.research-tab :deep(.tech-tree-container) {
  height: 100%;
}
</style>
