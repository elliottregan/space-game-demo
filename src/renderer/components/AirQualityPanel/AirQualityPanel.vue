<script setup lang="ts">
import { computed } from "vue";
import { Wind } from "lucide-vue-next";
import {
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  BASE_OXYGEN_PER_COLONIST,
} from "../../../core/balance/AirQualityBalance";
import { gameService } from "../../services/GameService";
import { GPanel, GProgress } from "../../ui";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const airQualityPercent = computed(() => Math.round(state.airQuality * 100));

// biome-ignore lint/correctness/noUnusedVariables: used in template
const airQualityVariant = computed(() => {
  if (state.airQuality >= AIR_QUALITY_COMFORTABLE) return "positive";
  if (state.airQuality >= AIR_QUALITY_CRITICAL) return "warning";
  return "negative";
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasEffects = computed(() => {
  return (
    state.airQualityHealthEffect !== 0 ||
    state.airQualityMoraleEffect !== 0 ||
    state.airQualityEfficiency < 1
  );
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const efficiencyPercent = computed(() => Math.round(state.airQualityEfficiency * 100));

// Building oxygen contributions grouped by type
// biome-ignore lint/correctness/noUnusedVariables: used in template
const buildingContributions = computed(() => {
  const contributions: { name: string; count: number; contribution: number }[] = [];
  const buildingCounts = new Map<string, { name: string; count: number; contribution: number }>();

  for (const building of state.buildings) {
    if (building.status !== "active") continue;

    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def || !def.oxygenContribution) continue;

    const existing = buildingCounts.get(def.id);
    if (existing) {
      existing.count++;
      existing.contribution += def.oxygenContribution;
    } else {
      buildingCounts.set(def.id, {
        name: def.name,
        count: 1,
        contribution: def.oxygenContribution,
      });
    }
  }

  for (const entry of buildingCounts.values()) {
    contributions.push(entry);
  }

  // Sort by contribution (producers first, then consumers)
  return contributions.sort((a, b) => b.contribution - a.contribution);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonistConsumption = computed(() => ({
  count: state.population,
  consumption: state.population * BASE_OXYGEN_PER_COLONIST,
}));
</script>

<template>
  <GPanel title="Life Support" accent="cyan">
    <div class="oxygen-content">
      <div class="air-quality-section">
        <div class="air-quality-header">
          <Wind :size="16" class="oxygen-icon" />
          <span class="air-quality-label">Air Quality</span>
          <span class="air-quality-value" :class="`text-${airQualityVariant}`">
            {{ airQualityPercent }}%
          </span>
        </div>
        <GProgress :percent="airQualityPercent" :variant="airQualityVariant" />
      </div>

      <div class="oxygen-stats">
        <div class="stat">
          <span class="stat-label">Production</span>
          <span class="stat-value positive"
            >+{{ state.airQualityProduction }} O<sub>2</sub>/sol</span
          >
        </div>
        <div class="stat">
          <span class="stat-label">Consumption</span>
          <span class="stat-value negative"
            >-{{ state.airQualityConsumption }} O<sub>2</sub>/sol</span
          >
        </div>
      </div>

      <div class="breakdown-section">
        <div class="breakdown-title">Breakdown</div>
        <div class="breakdown-list">
          <div
            v-for="building in buildingContributions"
            :key="building.name"
            class="breakdown-item"
          >
            <span class="breakdown-name">
              {{ building.name }}
              <span class="breakdown-count">x{{ building.count }}</span>
            </span>
            <span
              class="breakdown-value"
              :class="building.contribution > 0 ? 'positive' : 'negative'"
            >
              {{ building.contribution > 0 ? "+" : "" }}{{ building.contribution }}
            </span>
          </div>
          <div class="breakdown-item colonist-row">
            <span class="breakdown-name">
              Colonists
              <span class="breakdown-count">x{{ colonistConsumption.count }}</span>
            </span>
            <span class="breakdown-value negative"> -{{ colonistConsumption.consumption }} </span>
          </div>
        </div>
      </div>

      <div v-if="hasEffects" class="effects-section">
        <div class="effects-title">Low Oxygen Effects</div>
        <div class="effects-list">
          <div v-if="state.airQualityHealthEffect !== 0" class="effect">
            <span>Health</span>
            <span class="effect-value negative"
              >{{ state.airQualityHealthEffect.toFixed(1) }}/sol</span
            >
          </div>
          <div v-if="state.airQualityMoraleEffect !== 0" class="effect">
            <span>Morale</span>
            <span class="effect-value negative"
              >{{ state.airQualityMoraleEffect.toFixed(1) }}/sol</span
            >
          </div>
          <div v-if="state.airQualityEfficiency < 1" class="effect">
            <span>Efficiency</span>
            <span class="effect-value negative">{{ efficiencyPercent }}%</span>
          </div>
        </div>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.oxygen-content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.air-quality-section {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.air-quality-header {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.oxygen-icon {
  color: var(--g-color-info);
}

.air-quality-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.air-quality-value {
  margin-left: auto;
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.text-positive {
  color: var(--g-color-positive);
}

.text-warning {
  color: var(--g-color-warning);
}

.text-negative {
  color: var(--g-color-negative);
}

.oxygen-stats {
  display: flex;
  gap: var(--g-space-md);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.stat-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.stat-value.positive {
  color: var(--g-color-positive);
}

.stat-value.negative {
  color: var(--g-color-negative);
}

.effects-section {
  background: rgba(198, 40, 40, 0.1);
  border: 1px solid var(--g-color-negative);
  padding: var(--g-space-sm);
}

.effects-title {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-negative);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

.effects-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.effect {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.effect-value {
  font-family: var(--g-font-mono);
}

.effect-value.negative {
  color: var(--g-color-negative);
}

.breakdown-section {
  border-top: 1px solid var(--g-color-border);
  padding-top: var(--g-space-md);
}

.breakdown-title {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-sm);
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--g-font-size-sm);
}

.breakdown-name {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.breakdown-count {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
}

.breakdown-value {
  font-family: var(--g-font-mono);
}

.breakdown-value.positive {
  color: var(--g-color-positive);
}

.breakdown-value.negative {
  color: var(--g-color-negative);
}

.colonist-row {
  border-top: 1px dashed var(--g-color-border);
  padding-top: var(--g-space-xs);
  margin-top: var(--g-space-xs);
}
</style>
