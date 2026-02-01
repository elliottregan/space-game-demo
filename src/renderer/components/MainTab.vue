<script setup lang="ts">
import { AirQualityPanel } from "./AirQualityPanel";
import { ColonyPanel } from "./ColonyPanel";
</script>

<template>
  <div class="main-tab">
    <ColonyPanel />
    <AirQualityPanel />
  </div>
</template>

<style scoped>
.main-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 400px;
}
</style>
