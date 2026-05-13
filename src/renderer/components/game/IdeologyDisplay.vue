<template>
  <section class="section ideology-display">
    <h2>Ideology</h2>
    <div class="plot-wrap">
      <svg
        class="ideology-plot"
        :viewBox="`0 0 ${SIZE} ${SIZE}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Ideology position plot"
      >
        <!-- Axis cross-hairs -->
        <line
          :x1="0"
          :y1="CENTER"
          :x2="SIZE"
          :y2="CENTER"
          stroke="var(--border)"
          stroke-width="0.5"
        />
        <line
          :x1="CENTER"
          :y1="0"
          :x2="CENTER"
          :y2="SIZE"
          stroke="var(--border)"
          stroke-width="0.5"
        />

        <!-- Threshold rings: active (3), dominant (6), gate (8) -->
        <circle
          v-for="threshold in THRESHOLDS"
          :key="threshold"
          :cx="CENTER"
          :cy="CENTER"
          :r="(threshold / MAX) * RADIUS"
          fill="none"
          stroke="var(--text-subtle)"
          stroke-width="0.5"
          stroke-dasharray="2 3"
          opacity="0.7"
        />

        <!-- Pole labels -->
        <text
          :x="CENTER"
          :y="LABEL_INSET"
          text-anchor="middle"
          dominant-baseline="hanging"
          :style="{ fill: 'var(--suit-transformation)' }"
          class="pole-label"
        >
          Transformation
        </text>
        <text
          :x="CENTER"
          :y="SIZE - LABEL_INSET"
          text-anchor="middle"
          dominant-baseline="auto"
          :style="{ fill: 'var(--suit-heritage)' }"
          class="pole-label"
        >
          Heritage
        </text>
        <text
          :x="LABEL_INSET"
          :y="CENTER"
          text-anchor="start"
          dominant-baseline="middle"
          :style="{ fill: 'var(--suit-solidarity)' }"
          class="pole-label"
        >
          Solidarity
        </text>
        <text
          :x="SIZE - LABEL_INSET"
          :y="CENTER"
          text-anchor="end"
          dominant-baseline="middle"
          :style="{ fill: 'var(--suit-sovereignty)' }"
          class="pole-label"
        >
          Sovereignty
        </text>

        <!-- Halo around dot -->
        <circle
          :cx="dotX"
          :cy="dotY"
          :r="DOT_RADIUS + HALO_OFFSET"
          fill="none"
          :stroke="dotColor"
          stroke-width="1.5"
          stroke-opacity="0.4"
        />
        <!-- Position dot -->
        <circle :cx="dotX" :cy="dotY" :r="DOT_RADIUS" :fill="dotColor" />
      </svg>
    </div>
    <div class="demonym-label" :class="{ unaligned: !demonymKey }" :style="demonymLabelStyle">
      {{ demonymLabel }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Demonym, IdeologyVector } from "../../../core/types.ts";
import { demonym, demonymName } from "../../../core/engine/ideology.ts";

const props = defineProps<{
  vector: IdeologyVector;
}>();

// SVG geometry — square canvas in user-space units.
const SIZE = 200;
const CENTER = SIZE / 2;
// Inset reserved at each edge for pole labels.
const LABEL_INSET = 10;
// Breathing room between the pole-label baseline and the outer ring.
const LABEL_GUTTER = 6;
// Usable radius from center to the edge of the plot area.
const RADIUS = CENTER - LABEL_INSET - LABEL_GUTTER;
// Hard clamp on ideology magnitude for plot scaling.
const MAX = 20;
const THRESHOLDS = [3, 6, 8] as const;
const DOT_RADIUS = 4.5;
const HALO_OFFSET = 6;

const DEMONYM_COLOR: Record<NonNullable<Demonym>, string> = {
  collective: "var(--suit-solidarity)",
  dominion: "var(--suit-sovereignty)",
  ascendancy: "var(--suit-transformation)",
  keepers: "var(--suit-heritage)",
};

function clamp(v: number): number {
  return Math.max(-MAX, Math.min(MAX, v));
}

function toCanvas(v: number): number {
  return (clamp(v) / MAX) * RADIUS;
}

const dotX = computed(() => CENTER + toCanvas(props.vector.axis1));
// Flip axis2 so Transformation (positive) sits at the top of the SVG.
const dotY = computed(() => CENTER - toCanvas(props.vector.axis2));

const demonymKey = computed(() => demonym(props.vector));
const demonymLabel = computed(() => demonymName(demonymKey.value));

const dotColor = computed(() =>
  demonymKey.value ? DEMONYM_COLOR[demonymKey.value] : "var(--accent)",
);

const demonymLabelStyle = computed(() => {
  if (!demonymKey.value) return { color: "var(--text-subtle)" };
  return { color: dotColor.value };
});
</script>

<style scoped>
.ideology-display {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.plot-wrap {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}
.ideology-plot {
  width: 100%;
  height: auto;
  max-width: 220px;
  aspect-ratio: 1 / 1;
  display: block;
}
.pole-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.demonym-label {
  margin-top: 6px;
  font-size: 12px;
  font-style: italic;
  text-align: center;
}
.demonym-label.unaligned {
  font-weight: 400;
}
.demonym-label:not(.unaligned) {
  font-weight: 600;
}
</style>
