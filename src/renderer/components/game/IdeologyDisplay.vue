<template>
  <section class="section ideology-display">
    <h2>Ideology · {{ demonymLabel }}</h2>
    <AxisBar
      left-label="Solidarity"
      :value="vector.axis1"
      :terrain-offset="terrain.axis1"
      positive-color="var(--suit-sovereignty)"
      negative-color="var(--suit-solidarity)"
    />
    <AxisBar
      left-label="Heritage"
      :value="vector.axis2"
      :terrain-offset="terrain.axis2"
      positive-color="var(--suit-transformation)"
      negative-color="var(--suit-heritage)"
    />
    <div class="axis-legend">
      <span>◁ Sovereignty · Transformation ▷</span>
      <span>±3 active · ±6 dominant · ±8 gate</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import AxisBar from "../core/AxisBar.vue";
import type { IdeologyVector, IdeologyTerrain } from "../../../core/types.ts";

defineProps<{
  vector: IdeologyVector;
  terrain: IdeologyTerrain;
  demonymLabel: string;
}>();
</script>

<style scoped>
.axis-legend {
  font-size: 10px;
  color: var(--text-subtle);
  display: flex;
  justify-content: space-between;
}
</style>
