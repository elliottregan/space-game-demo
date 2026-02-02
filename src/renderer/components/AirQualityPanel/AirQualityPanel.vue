<script setup lang="ts">
import { computed } from "vue";
import { Wind } from "lucide-vue-next";
import {
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  BASE_AIR_PER_COLONIST,
} from "../../../core/balance/AirQualityBalance";
import { gameService } from "../../services/GameService";
import { GBreakdownList, GMetricBar, GPanel } from "../../ui";
import type { BreakdownItem } from "../../ui";

const state = gameService.getState();

const airQualityThresholds = { warning: AIR_QUALITY_COMFORTABLE, critical: AIR_QUALITY_CRITICAL };

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
const breakdownItems = computed<BreakdownItem[]>(() => {
  const buildingCounts = new Map<string, { name: string; count: number; contribution: number }>();

  for (const building of state.buildings) {
    if (building.status !== "active") continue;

    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def || !def.airContribution) continue;

    const existing = buildingCounts.get(def.id);
    if (existing) {
      existing.count++;
      existing.contribution += def.airContribution;
    } else {
      buildingCounts.set(def.id, {
        name: def.name,
        count: 1,
        contribution: def.airContribution,
      });
    }
  }

  // Sort by contribution (producers first, then consumers)
  const sorted = [...buildingCounts.values()].sort((a, b) => b.contribution - a.contribution);

  const items: BreakdownItem[] = sorted.map((entry) => ({
    key: entry.name,
    name: entry.name,
    count: entry.count,
    value: entry.contribution,
  }));

  // Add colonist consumption as separator row
  items.push({
    key: "colonists",
    name: "Colonists",
    count: state.population,
    value: -(state.population * BASE_AIR_PER_COLONIST),
    separator: true,
  });

  return items;
});
</script>

<template>
  <GPanel title="Life Support" accent="cyan">
    <div class="oxygen-content">
      <GMetricBar
        label="Air Quality"
        :value="state.airQuality"
        :icon="Wind"
        :thresholds="airQualityThresholds"
      />

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

      <GBreakdownList title="Breakdown" :items="breakdownItems" />

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
</style>
