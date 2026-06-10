<template>
  <Panel class="ideology-display" title="Ideology">
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
          stroke="var(--rule)"
          stroke-width="0.5"
        />
        <line
          :x1="CENTER"
          :y1="0"
          :x2="CENTER"
          :y2="SIZE"
          stroke="var(--rule)"
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
          stroke="var(--ink-subtle)"
          stroke-width="0.5"
          stroke-dasharray="2 3"
          opacity="0.7"
        />

        <!-- Pole markers: one geometric suit form per ideology -->
        <g v-for="id in IDEOLOGIES" :key="id">
          <title>{{ IDEOLOGY_DISPLAY[id].name }}</title>
          <circle
            v-if="id === 'solidarity'"
            :cx="poleAnchor(id).x"
            :cy="poleAnchor(id).y"
            r="4.5"
            :fill="cssColorFor(id)"
          />
          <polygon
            v-else-if="id === 'sovereignty'"
            :points="trianglePoints(poleAnchor(id).x, poleAnchor(id).y)"
            :fill="cssColorFor(id)"
          />
          <rect
            v-else-if="id === 'transformation'"
            :x="poleAnchor(id).x - 4"
            :y="poleAnchor(id).y - 4"
            width="8"
            height="8"
            :fill="cssColorFor(id)"
          />
          <path
            v-else-if="id === 'heritage'"
            :d="semicirclePath(poleAnchor(id).x, poleAnchor(id).y)"
            :fill="cssColorFor(id)"
          />
        </g>

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
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ideology, IdeologyVector } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGY_DISPLAY, IDEOLOGIES } from "../../../core/data/ideologies.ts";
import {
  demonym,
  demonymName,
  IDEOLOGY_AXIS,
  IDEOLOGY_BY_DEMONYM,
} from "../../../core/engine/ideology.ts";
import Panel from "../core/Panel.vue";

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

interface PoleAnchor {
  x: number;
  y: number;
  textAnchor: "middle" | "start" | "end";
  dominantBaseline: "hanging" | "auto" | "middle";
}

// Maps a pole to its SVG-edge position. Note: SVG y grows downward,
// so axis2 sign +1 (positive Transformation) maps to a small y at the top.
function poleAnchor(id: Ideology): PoleAnchor {
  const { axis, sign } = IDEOLOGY_AXIS[id];
  if (axis === "axis2") {
    // sign +1 → top, sign -1 → bottom
    return sign > 0
      ? { x: CENTER, y: LABEL_INSET, textAnchor: "middle", dominantBaseline: "hanging" }
      : { x: CENTER, y: SIZE - LABEL_INSET, textAnchor: "middle", dominantBaseline: "auto" };
  }
  // axis1: sign +1 → right, sign -1 → left
  return sign > 0
    ? { x: SIZE - LABEL_INSET, y: CENTER, textAnchor: "end", dominantBaseline: "middle" }
    : { x: LABEL_INSET, y: CENTER, textAnchor: "start", dominantBaseline: "middle" };
}

/** Equilateral-ish triangle centered on (x, y), apex up, ~9px tall. */
function trianglePoints(x: number, y: number): string {
  return `${x},${y - 4.5} ${x + 4.5},${y + 4.5} ${x - 4.5},${y + 4.5}`;
}

/** Semicircle dome centered on (x, y), flat side down, radius 4.5. */
function semicirclePath(x: number, y: number): string {
  return `M ${x - 4.5} ${y + 2} A 4.5 4.5 0 0 1 ${x + 4.5} ${y + 2} Z`;
}

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

const dotColor = computed(() => {
  const key = demonymKey.value;
  if (!key) return "var(--accent-deep)";
  return cssColorFor(IDEOLOGY_BY_DEMONYM[key]);
});

const demonymLabelStyle = computed(() => {
  if (!demonymKey.value) return { color: "var(--ink-subtle)" };
  return { color: dotColor.value };
});
</script>

<style scoped>
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
.demonym-label {
  margin-top: var(--space-1);
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
