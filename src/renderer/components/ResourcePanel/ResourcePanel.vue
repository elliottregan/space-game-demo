<script setup lang="ts">
import { computed } from "vue";
import { highlightState } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { GPanel, ResourceBadge } from "../../ui";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries (for future extensibility)
// biome-ignore lint/correctness/noUnusedVariables: reserved for future API usage
const api = gameService.api;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const resources = computed(
  () =>
    [
      { key: "food", name: "Food" },
      { key: "oxygen", name: "Oxygen" },
      { key: "water", name: "Water" },
      { key: "power", name: "Power" },
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
</script>

<template>
  <GPanel title="Resources" accent="red">
    <div class="resource-list">
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
        <span v-if="hasDelta(resource.key)" class="projected-value" :class="{
          'projected-positive': getDelta(resource.key) > 0,
          'projected-negative': getDelta(resource.key) < 0,
          'projected-danger': (getProjectedValue(resource.key) ?? 0) < 0
        }">
          → {{ formatNumber(getProjectedValue(resource.key) ?? 0) }}
        </span>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.resource-list {
  display: flex;
  flex-direction: column;
}

.resource-list .resource-item + .resource-item {
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.resource-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
}

.projected-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  opacity: 0.9;
  margin-left: auto;
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
</style>
