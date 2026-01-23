<script setup lang="ts">
import ResourcePanel from "./ResourcePanel.vue";
import { ColonyPanel } from "./ColonyPanel";
import { BuildingPanel } from "./BuildingPanel";
</script>

<template>
  <div class="main-tab">
    <div class="main-tab-left">
      <ResourcePanel />
      <ColonyPanel />
    </div>
    <div class="main-tab-right">
      <BuildingPanel />
    </div>
  </div>
</template>

<style scoped>
.main-tab {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 1rem;
}

.main-tab-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.main-tab-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .main-tab {
    grid-template-columns: 1fr;
  }
}
</style>
