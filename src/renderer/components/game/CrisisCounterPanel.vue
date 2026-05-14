<template>
  <Panel class="crisis-counter" :title="`Crisis · ${crisis.name}`">
    <div class="meter-section">
      <div class="meter-label">
        <span class="meter-name">Turns until Crisis</span>
        <span class="meter-value" :class="countdownClass">{{ countdownValue }}</span>
      </div>
      <div class="meter-track">
        <div class="meter-fill" :class="countdownClass" :style="{ width: turnsBarWidth }" />
      </div>
    </div>

    <div class="meter-section">
      <div class="meter-label">
        <span class="meter-name">Score</span>
        <span class="meter-value" :class="{ passing: currentScore >= crisis.difficulty }">
          {{ currentScore }} / {{ crisis.difficulty }}
        </span>
      </div>
      <div class="meter-track">
        <div
          class="meter-fill"
          :class="{ passing: currentScore >= crisis.difficulty }"
          :style="{ width: scoreBarWidth }"
        />
      </div>
      <div class="meter-hint">{{ statusLabel }}</div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Crisis, KeystoneProject, ProjectUnlock } from "../../../core/types.ts";
import Panel from "../core/Panel.vue";

const props = defineProps<{
  crisis: Crisis;
  unlocks: ProjectUnlock[];
  projects: KeystoneProject[];
  turn: number;
  maxTurns: number;
}>();

const currentScore = computed(() =>
  props.unlocks.reduce((sum, u) => {
    const p = props.projects.find((p) => p.id === u.projectId);
    return sum + (p?.value ?? 0);
  }, 0),
);

const scoreBarWidth = computed(() => {
  const pct = Math.min(1, currentScore.value / props.crisis.difficulty) * 100;
  return `${pct}%`;
});

const statusLabel = computed(() => {
  if (currentScore.value >= props.crisis.difficulty) return "On track to pass";
  const gap = props.crisis.difficulty - currentScore.value;
  return `${gap} more needed`;
});

// turns-left semantics: Crisis fires when turn > maxTurns. While playing turn N
// of M, the player still gets to play turns N, N+1, …, M before Crisis hits,
// which is (M - N + 1) turns. Clamps at 0 once the Crisis phase has begun.
const turnsLeft = computed(() => Math.max(0, props.maxTurns - props.turn + 1));

const turnsBarWidth = computed(() => {
  const pct = (turnsLeft.value / props.maxTurns) * 100;
  return `${pct}%`;
});

const countdownValue = computed(() => {
  if (turnsLeft.value === 0) return "now";
  if (turnsLeft.value === 1) return "1 turn";
  return `${turnsLeft.value} turns`;
});

const countdownClass = computed(() => ({
  edge: turnsLeft.value <= 1,
  near: turnsLeft.value > 1 && turnsLeft.value <= Math.ceil(props.maxTurns * 0.34),
}));
</script>

<style scoped>
.meter-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.meter-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}

.meter-name {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.meter-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  transition: color 0.2s;
}
.meter-value.passing {
  color: var(--accent);
}
.meter-value.near {
  color: var(--status-warning);
}
.meter-value.edge {
  color: var(--status-negative);
}

.meter-track {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--text-muted);
  transition:
    width 0.3s ease,
    background-color 0.2s ease;
}
.meter-fill.passing {
  background: var(--accent);
}
.meter-fill.near {
  background: var(--status-warning);
}
.meter-fill.edge {
  background: var(--status-negative);
}

.meter-hint {
  font-size: 11px;
  color: var(--text-subtle);
}
</style>
