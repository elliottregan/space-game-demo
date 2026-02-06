<script setup lang="ts">
import { computed } from "vue";
import { highlightState } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { ResourceBadge } from "../../ui";
import { getHealthVariant, getStatusVariant } from "../../utils/displayThresholds";
import {
  LS_QUALITY_COMFORTABLE,
  LS_QUALITY_CRISIS,
} from "../../../core/balance/LifeSupportBalance";
import EarthCrisisIndicator from "./EarthCrisisIndicator.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries (for future extensibility)
// biome-ignore lint/correctness/noUnusedVariables: reserved for future API usage
const api = gameService.api;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const healthVariant = computed(() => getHealthVariant(state.health));

// biome-ignore lint/correctness/noUnusedVariables: used in template
const lifeSupportVariant = computed(() =>
  getStatusVariant(state.lifeSupportQuality, LS_QUALITY_COMFORTABLE, LS_QUALITY_CRISIS),
);

// Stockpiled resources (power is shown in BaseTab, not here)
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

    <div class="separator" />

    <!-- Colony Health -->
    <div class="status-item">
      <span class="status-label">Health</span>
      <div class="status-bar">
        <div
          class="status-fill"
          :class="`status-fill--${healthVariant}`"
          :style="{ width: `${state.health}%` }"
        />
      </div>
      <span class="status-value" :class="healthVariant">{{ Math.round(state.health) }}%</span>
    </div>

    <!-- Life Support -->
    <div class="status-item">
      <span class="status-label">Life Support</span>
      <div class="status-bar">
        <div
          class="status-fill"
          :class="`status-fill--${lifeSupportVariant}`"
          :style="{ width: `${Math.round(state.lifeSupportQuality * 100)}%` }"
        />
      </div>
      <span class="status-value" :class="lifeSupportVariant"
        >{{ Math.round(state.lifeSupportQuality * 100) }}%</span
      >
    </div>

    <!-- Earth Crisis Indicator -->
    <EarthCrisisIndicator
      :severity="state.earthCrisis.severity"
      :pointOfNoReturn="state.earthCrisis.pointOfNoReturn"
    />
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

.separator {
  width: 1px;
  align-self: stretch;
  background: var(--g-color-border);
  margin: 0 var(--g-space-xs);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.status-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-bar {
  width: 48px;
  height: 6px;
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  overflow: hidden;
}

.status-fill {
  height: 100%;
  transition: width var(--g-transition-normal);
}

.status-fill--positive {
  background: var(--g-color-positive);
}

.status-fill--warning {
  background: var(--g-color-warning);
}

.status-fill--negative {
  background: var(--g-color-negative);
}

.status-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.status-value.positive {
  color: var(--g-color-positive);
}

.status-value.warning {
  color: var(--g-color-warning);
}

.status-value.negative {
  color: var(--g-color-negative);
}
</style>
