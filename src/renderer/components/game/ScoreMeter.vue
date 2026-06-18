<template>
  <Panel title="Score">
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
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-muted);
}
.meter-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  transition: color 0.2s;
}
.meter-value.passing {
  color: var(--status-positive);
}
.meter-track {
  height: 8px;
  background: var(--mat-strong);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: var(--ink-muted);
  transition:
    width 0.3s ease,
    background-color 0.2s ease;
}
.meter-fill.passing {
  background: var(--status-positive);
}
.meter-hint {
  font-size: 11px;
  color: var(--ink-subtle);
}
</style>
