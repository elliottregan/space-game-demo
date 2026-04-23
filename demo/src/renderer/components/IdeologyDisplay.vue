<template>
  <section class="section ideology-display">
    <h2>Ideology · {{ demonymLabel }}</h2>
    <div class="axis-row">
      <div class="axis-label"><span class="left">Solidarity</span></div>
      <div class="axis-bar">
        <div class="center-line"></div>
        <div class="threshold" :style="{ left: percent(-3) + '%' }"></div>
        <div class="threshold" :style="{ left: percent(-8) + '%' }"></div>
        <div class="threshold" :style="{ left: percent(3) + '%' }"></div>
        <div class="threshold" :style="{ left: percent(8) + '%' }"></div>
        <div
          v-if="terrain.axis1 !== 0"
          class="terrain-mark"
          :style="{ left: percent(terrain.axis1) + '%' }"
          title="Terrain offset"
        ></div>
        <div class="bar-fill" :style="axis1Fill"></div>
      </div>
      <div class="axis-value">{{ fmt(vector.axis1) }}</div>
    </div>

    <div class="axis-row">
      <div class="axis-label"><span class="left">Heritage</span></div>
      <div class="axis-bar">
        <div class="center-line"></div>
        <div class="threshold" :style="{ left: percent(-3) + '%' }"></div>
        <div class="threshold" :style="{ left: percent(-8) + '%' }"></div>
        <div class="threshold" :style="{ left: percent(3) + '%' }"></div>
        <div class="threshold" :style="{ left: percent(8) + '%' }"></div>
        <div
          v-if="terrain.axis2 !== 0"
          class="terrain-mark"
          :style="{ left: percent(terrain.axis2) + '%' }"
          title="Terrain offset"
        ></div>
        <div class="bar-fill" :style="axis2Fill"></div>
      </div>
      <div class="axis-value">{{ fmt(vector.axis2) }}</div>
    </div>

    <div
      style="font-size: 10px; color: var(--fg-muted); display: flex; justify-content: space-between"
    >
      <span>◁ Sovereignty ▷ Transformation</span>
      <span>Thresholds: ±3 active, ±6 dominant, ±8 gate</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { IdeologyVector, IdeologyTerrain } from "../../core/types.ts";

const props = defineProps<{
  vector: IdeologyVector;
  terrain: IdeologyTerrain;
  demonymLabel: string;
}>();

const MAX = 20;

function percent(value: number): number {
  const clamped = Math.max(-MAX, Math.min(MAX, value));
  return 50 + (clamped / MAX) * 50;
}

function fmt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function fillStyle(value: number, posColor: string, negColor: string) {
  // negative fills left, positive fills right, both from center.
  const clamped = Math.max(-MAX, Math.min(MAX, value));
  if (clamped === 0) return { display: "none" };
  const width = (Math.abs(clamped) / MAX) * 50;
  if (clamped < 0) {
    return { right: "50%", width: `${width}%`, background: negColor };
  }
  return { left: "50%", width: `${width}%`, background: posColor };
}

const axis1Fill = computed(() =>
  // axis1: negative=Sol (blue, left), positive=Sov (red, right)
  fillStyle(props.vector.axis1, "var(--sov)", "var(--sol)"),
);
const axis2Fill = computed(() =>
  // axis2: negative=Her (purple, left), positive=Trn (green, right)
  fillStyle(props.vector.axis2, "var(--trn)", "var(--her)"),
);
</script>
