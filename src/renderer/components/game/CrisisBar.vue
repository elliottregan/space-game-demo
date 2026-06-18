<template>
  <div class="crisis-bar">
    <span class="crisis-label">Crisis · {{ crisis.name }}</span>
    <!-- Board-game "doom track": the yellow fill grows toward the Crisis as turns
         elapse, and a square counter rides its leading edge. -->
    <div class="crisis-track">
      <div class="crisis-fill" :style="{ width: consumedWidth }" />
      <div class="crisis-counter" :class="countdownClass" :style="{ left: counterLeft }" />
    </div>
    <span class="crisis-flag" aria-hidden="true" />
    <span class="crisis-value" :class="countdownClass">{{ countdownLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Crisis } from "../../../core/types.ts";

const props = defineProps<{
  crisis: Crisis;
  turn: number;
  maxTurns: number;
}>();

// turns-left semantics: Crisis fires when turn > maxTurns. While playing turn N
// of M, the player still gets to play turns N, N+1, …, M before Crisis hits,
// which is (M - N + 1) turns. Clamps at 0 once the Crisis phase has begun.
const turnsLeft = computed(() => Math.max(0, props.maxTurns - props.turn + 1));

// Fraction of the track consumed: 0% at the opening turn, 100% at the Crisis.
const consumedPct = computed(() =>
  Math.min(100, Math.max(0, ((props.maxTurns - turnsLeft.value) / props.maxTurns) * 100)),
);
const consumedWidth = computed(() => `${consumedPct.value}%`);
// Keep the counter fully on the track: its center can't pass within half its
// own width (15px of the 30px square) of either end.
const counterLeft = computed(() => `clamp(15px, ${consumedPct.value}%, calc(100% - 15px))`);

const countdownValue = computed(() => {
  if (turnsLeft.value === 0) return "now";
  if (turnsLeft.value === 1) return "1 turn";
  return `${turnsLeft.value} turns`;
});

// At the cap show a bare "now"; otherwise "<n turns> left".
const countdownLabel = computed(() =>
  turnsLeft.value === 0 ? "now" : `${countdownValue.value} left`,
);

const countdownClass = computed(() => ({
  edge: turnsLeft.value <= 1,
  near: turnsLeft.value > 1 && turnsLeft.value <= Math.ceil(props.maxTurns * 0.34),
}));
</script>

<style scoped>
.crisis-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.crisis-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-muted);
  white-space: nowrap;
}
/* Fixed-width track keeps the meter compact (short) and chunky (thick). */
.crisis-track {
  position: relative;
  flex: 0 0 340px;
  height: 26px;
  background: var(--mat-strong);
}
.crisis-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--accent);
  transition: width 0.3s ease;
}
/* Flat square counter — Bauhaus, no border-radius — riding the fill edge. */
.crisis-counter {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  background: var(--ink);
  border: 3px solid var(--paper);
  box-sizing: border-box;
  transition:
    left 0.3s ease,
    background-color 0.2s ease;
}
.crisis-counter.edge {
  background: var(--status-negative);
}
/* Geometric Crisis marker at the track's end. */
.crisis-flag {
  width: 0;
  height: 0;
  border-left: 14px solid var(--status-negative);
  border-top: 13px solid transparent;
  border-bottom: 13px solid transparent;
}
.crisis-value {
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  color: var(--ink);
  transition: color 0.2s;
}
.crisis-value.near {
  color: var(--status-warning);
}
.crisis-value.edge {
  color: var(--status-negative);
}
</style>
