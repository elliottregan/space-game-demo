<template>
  <div class="axis-row">
    <div class="axis-label"><span class="left">{{ leftLabel }}</span></div>
    <div class="axis-bar">
      <div class="center-line"></div>
      <div class="threshold" :style="{ left: percent(-3) + '%' }"></div>
      <div class="threshold" :style="{ left: percent(-8) + '%' }"></div>
      <div class="threshold" :style="{ left: percent(3) + '%' }"></div>
      <div class="threshold" :style="{ left: percent(8) + '%' }"></div>
      <div
        v-if="terrainOffset !== 0"
        class="terrain-mark"
        :style="{ left: percent(terrainOffset) + '%' }"
        title="Terrain offset"
      ></div>
      <div class="bar-fill" :style="fillStyle"></div>
    </div>
    <div class="axis-value">{{ formatted }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  leftLabel: string;
  value: number;
  terrainOffset: number;
  /** Color for the positive (right-side) fill. */
  positiveColor: string;
  /** Color for the negative (left-side) fill. */
  negativeColor: string;
}>();

const MAX = 20;

function percent(v: number): number {
  const clamped = Math.max(-MAX, Math.min(MAX, v));
  return 50 + (clamped / MAX) * 50;
}

const formatted = computed(() => (props.value > 0 ? `+${props.value}` : String(props.value)));

const fillStyle = computed(() => {
  const clamped = Math.max(-MAX, Math.min(MAX, props.value));
  if (clamped === 0) return { display: "none" };
  const width = (Math.abs(clamped) / MAX) * 50;
  if (clamped < 0) return { right: "50%", width: `${width}%`, background: props.negativeColor };
  return { left: "50%", width: `${width}%`, background: props.positiveColor };
});
</script>
