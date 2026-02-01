<script setup lang="ts">
import { computed } from "vue";
import { highlightState } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { ResourceBadge } from "../../ui";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries (for future extensibility)
// biome-ignore lint/correctness/noUnusedVariables: reserved for future API usage
const api = gameService.api;

// Stockpiled resources (power is now a grid metric, not stockpiled)
// biome-ignore lint/correctness/noUnusedVariables: used in template
const resources = computed(
  () =>
    [
      { key: "food", name: "Food" },
      { key: "water", name: "Water" },
      { key: "materials", name: "Materials" },
    ] as const,
);

const currentDeltas = computed(() => {
  if (!highlightState.active) return {};
  return { ...highlightState.deltas };
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getNetFlow(key: string): number {
  return (state.netFlow as Record<string, number | undefined>)[key] || 0;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getProjectedValue(key: string): number | null {
  const delta = currentDeltas.value[key];
  if (delta === undefined) {
    return null;
  }
  const current = (state.resources as Record<string, number>)[key] || 0;
  return current + delta;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function hasDelta(key: string): boolean {
  return currentDeltas.value[key] !== undefined;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getDelta(key: string): number {
  return currentDeltas.value[key] || 0;
}

// Power grid helpers
// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPowerGridPercent(): number {
  return Math.round(state.powerGrid * 100);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPowerGridClass(): string {
  if (state.powerGridIsCritical) return "power-critical";
  if (!state.powerGridIsComfortable) return "power-strained";
  return "power-comfortable";
}
</script>

<template>
  <div class="resource-bar">
    <!-- Stockpiled resources -->
    <div
      v-for="resource in resources"
      :key="resource.key"
      v-resource-glow.pulse="resource.key"
      class="resource-item"
    >
      <ResourceBadge
        :resource="resource.key"
        :amount="(state.resources as Record<string, number>)[resource.key]"
        :rate="getNetFlow(resource.key)"
      />
      <span
        v-if="hasDelta(resource.key)"
        class="projected-value"
        :class="{
          'projected-positive': getDelta(resource.key) > 0,
          'projected-negative': getDelta(resource.key) < 0,
          'projected-danger': (getProjectedValue(resource.key) ?? 0) < 0,
        }"
      >
        → {{ formatNumber(getProjectedValue(resource.key) ?? 0) }}
      </span>
    </div>

    <!-- Power Grid (not stockpiled - shown as grid strain) -->
    <div class="resource-item power-grid-item" :class="getPowerGridClass()">
      <span class="power-icon">⚡</span>
      <span class="power-label">Power</span>
      <span class="power-value">{{ getPowerGridPercent() }}%</span>
      <span class="power-flow"
        >({{ state.powerGridProduction }}/{{ state.powerGridConsumption }})</span
      >
    </div>
  </div>
</template>

<style scoped>
.resource-bar {
  display: flex;
  gap: var(--g-space-md);
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-elevated);
  border: var(--g-border-width) solid var(--g-color-border);
  border-radius: var(--g-radius-md);
  margin-bottom: var(--g-space-md);
}

.resource-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.projected-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  opacity: 0.9;
  transition: all var(--g-transition-fast);
  color: inherit;
}

.projected-value.projected-negative {
  color: var(--g-color-negative);
}

.projected-value.projected-positive {
  color: var(--g-color-positive);
}

.projected-value.projected-danger {
  color: var(--g-color-negative);
  font-weight: bold;
  background: rgba(198, 40, 40, 0.1);
  padding: 0 var(--g-space-xs);
}

/* Power Grid styles */
.power-grid-item {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  padding: var(--g-space-xs) var(--g-space-sm);
  border-radius: var(--g-radius-sm);
  border: 1px solid var(--g-color-border);
}

.power-icon {
  font-size: 1.1em;
}

.power-label {
  color: var(--g-color-text-muted);
  margin-right: var(--g-space-xs);
}

.power-value {
  font-weight: bold;
}

.power-flow {
  color: var(--g-color-text-muted);
  font-size: 0.9em;
}

.power-comfortable {
  background: rgba(76, 175, 80, 0.1);
  border-color: var(--g-color-positive);
}

.power-comfortable .power-value {
  color: var(--g-color-positive);
}

.power-strained {
  background: rgba(255, 193, 7, 0.1);
  border-color: var(--g-color-warning);
}

.power-strained .power-value {
  color: var(--g-color-warning);
}

.power-critical {
  background: rgba(198, 40, 40, 0.1);
  border-color: var(--g-color-negative);
}

.power-critical .power-value {
  color: var(--g-color-negative);
}
</style>
