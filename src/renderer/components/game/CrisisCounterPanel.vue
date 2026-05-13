<template>
  <Panel class="crisis-counter" :title="`Crisis · ${crisis.name}`">
    <div class="crisis-score">
      <span class="score-current" :class="{ passing: currentScore >= crisis.difficulty }">
        {{ currentScore }}
      </span>
      <span class="score-sep">/</span>
      <span class="score-target">{{ crisis.difficulty }}</span>
    </div>
    <div class="crisis-bar-track">
      <div class="crisis-bar-fill" :style="{ width: barWidth }" />
    </div>
    <div class="crisis-label">{{ statusLabel }}</div>
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

const barWidth = computed(() => {
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
.crisis-score {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: 1.5rem;
  font-weight: 700;
}

.score-current {
  color: var(--text-muted);
  transition: color 0.2s;
}

.score-current.passing {
  color: var(--accent, #4caf50);
}

.score-sep,
.score-target {
  font-size: 1rem;
  color: var(--text-muted);
}

.crisis-bar-track {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  overflow: hidden;
  margin-bottom: 4px;
}

.crisis-bar-fill {
  height: 100%;
  background: var(--accent, #4caf50);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.crisis-label {
  font-size: 11px;
  color: var(--text-subtle);
}
</style>
