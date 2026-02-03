<script setup lang="ts">
import { AirQualityPanel } from "./AirQualityPanel";
import { BuildingsTablePanel } from "./BuildingsTablePanel";
import { ColonistsPanel } from "./ColonistsPanel";
import { ColonyPanel } from "./ColonyPanel";
import { HealthPanel } from "./HealthPanel";
</script>

<template>
  <div class="main-tab">
    <div class="left-column">
      <ColonyPanel />
      <HealthPanel />
      <AirQualityPanel />
    </div>
    <div class="right-column">
      <ColonistsPanel />
      <BuildingsTablePanel />
    </div>
  </div>
</template>

<style scoped>
.main-tab {
  display: flex;
  gap: var(--g-space-md);
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  width: 340px;
  flex-shrink: 0;
}

.right-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

@media (max-width: 768px) {
  .main-tab {
    flex-direction: column;
  }

  .left-column {
    width: 100%;
  }
}
</style>
