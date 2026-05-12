<template>
  <section class="section">
    <h2>Terrain (persisted)</h2>
    <div class="terrain-row">
      <span>axis1 (Sol↔Sov)</span>
      <span class="value">{{ fmt(terrain.axis1) }}</span>
    </div>
    <div class="terrain-row">
      <span>axis2 (Her↔Trn)</span>
      <span class="value">{{ fmt(terrain.axis2) }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { IdeologyTerrain } from "../../../../core/types.ts";

defineProps<{ terrain: IdeologyTerrain }>();

function fmt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
</script>

<style scoped>
.terrain-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.value {
  color: var(--accent);
}
</style>
