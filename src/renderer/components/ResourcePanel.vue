<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";
import { highlightState } from "../directives/ResourceHighlight";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const resources = computed(
  () =>
    [
      { key: "food", name: "Food", icon: "🌾", color: "#4ade80" },
      { key: "oxygen", name: "Oxygen", icon: "💨", color: "#60a5fa" },
      { key: "water", name: "Water", icon: "💧", color: "#38bdf8" },
      { key: "power", name: "Power", icon: "⚡", color: "#fbbf24" },
      { key: "materials", name: "Materials", icon: "🔧", color: "#a78bfa" },
    ] as const,
);

const currentDeltas = computed(() => {
  if (!highlightState.active) return {};
  return { ...highlightState.deltas };
});

const currentRateDeltas = computed(() => {
  if (!highlightState.active) return {};
  return { ...highlightState.rateDeltas };
});

function getNetFlow(key: string): number {
  return (state.netFlow as Record<string, number | undefined>)[key] || 0;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatFlow(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}${n.toFixed(1)}/sol`;
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

// biome-ignore lint/correctness/noUnusedVariables: used in template
function hasRateDelta(key: string): boolean {
  return currentRateDeltas.value[key] !== undefined;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getRateDelta(key: string): number {
  return currentRateDeltas.value[key] || 0;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getProjectedRate(key: string): number {
  const current = getNetFlow(key);
  const delta = currentRateDeltas.value[key] || 0;
  return current + delta;
}
</script>

<template>
  <div class="panel resource-panel">
    <h2>Resources</h2>
    <div class="resource-list">
      <div
        v-for="resource in resources"
        :key="resource.key"
        v-resource-glow.pulse="resource.key"
        class="resource-item"
        :style="{ '--resource-glow-color': resource.color }"
      >
        <div class="resource-icon">{{ resource.icon }}</div>
        <div class="resource-info">
          <div class="resource-name">{{ resource.name }}</div>
          <div class="resource-amount" :style="{ color: resource.color }">
            {{ formatNumber((state.resources as Record<string, number>)[resource.key]) }}
            <span v-if="hasDelta(resource.key)" class="projected-value" :class="{
              'projected-positive': getDelta(resource.key) > 0,
              'projected-negative': getDelta(resource.key) < 0,
              'projected-danger': (getProjectedValue(resource.key) ?? 0) < 0
            }">
              → {{ formatNumber(getProjectedValue(resource.key) ?? 0) }}
            </span>
          </div>
        </div>
        <div
          class="resource-flow"
          :class="{
            positive: hasRateDelta(resource.key) ? getProjectedRate(resource.key) > 0 : getNetFlow(resource.key) > 0,
            negative: hasRateDelta(resource.key) ? getProjectedRate(resource.key) < 0 : getNetFlow(resource.key) < 0,
            neutral: hasRateDelta(resource.key) ? getProjectedRate(resource.key) === 0 : getNetFlow(resource.key) === 0
          }"
        >
          <template v-if="hasRateDelta(resource.key)">
            <span class="projected-rate">{{ formatFlow(getProjectedRate(resource.key)) }}</span>
            <span class="rate-arrow">←</span>
            <span class="old-rate">{{ formatFlow(getNetFlow(resource.key)) }}</span>
          </template>
          <template v-else>
            {{ formatFlow(getNetFlow(resource.key)) }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-panel {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.resource-icon {
  font-size: 1.5rem;
  width: 40px;
  text-align: center;
}

.resource-info {
  flex: 1;
}

.resource-name {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
}

.resource-amount {
  font-size: 1.25rem;
  font-weight: bold;
}

.resource-flow {
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.resource-flow.positive {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.resource-flow.negative {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.resource-flow.neutral {
  color: #888;
  background: rgba(136, 136, 136, 0.1);
}

.projected-value {
  font-size: 0.9em;
  opacity: 0.9;
  margin-left: 0.25rem;
  transition: all 0.2s ease;
  color: inherit;
}

.projected-value.projected-negative {
  color: var(--color-negative) !important;
}

.projected-value.projected-positive {
  color: var(--color-positive) !important;
}

.projected-value.projected-danger {
  color: var(--color-danger) !important;
  font-weight: bold;
  background: var(--bg-danger);
  padding: 0 0.25rem;
  border-radius: 2px;
}

.projected-rate {
  font-weight: bold;
}

.rate-arrow {
  margin: 0 0.25rem;
  opacity: 0.7;
}

.old-rate {
  opacity: 0.6;
  font-size: 0.8em;
}
</style>
