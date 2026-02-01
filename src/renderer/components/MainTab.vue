<script setup lang="ts">
import { AirQualityPanel } from "./AirQualityPanel";
import { BuildingPanel } from "./BuildingPanel";
import { ColonyPanel } from "./ColonyPanel";
</script>

<template>
  <div class="main-tab">
    <div class="main-tab-left">
      <ColonyPanel />
      <AirQualityPanel />
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
