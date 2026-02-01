<script setup lang="ts">
import { computed } from "vue";
import { Zap } from "lucide-vue-next";
import {
  POWER_GRID_COMFORTABLE,
  POWER_GRID_CRITICAL,
} from "../../../core/balance/PowerGridBalance";
import { gameService } from "../../services/GameService";
import { GBreakdownList, GMetricBar, GPanel } from "../../ui";
import type { BreakdownItem } from "../../ui";

const state = gameService.getState();

const powerGridThresholds = { warning: POWER_GRID_COMFORTABLE, critical: POWER_GRID_CRITICAL };

// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasEffects = computed(() => {
  return state.powerGridEfficiency < 1;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const efficiencyPercent = computed(() => Math.round(state.powerGridEfficiency * 100));

// Building power contributions grouped by type
// biome-ignore lint/correctness/noUnusedVariables: used in template
const breakdownItems = computed<BreakdownItem[]>(() => {
  const buildingCounts = new Map<
    string,
    { name: string; count: number; production: number; consumption: number }
  >();

  for (const building of state.buildings) {
    if (building.status !== "active") continue;

    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def) continue;
    if (!def.powerProduction && !def.powerConsumption) continue;

    const existing = buildingCounts.get(def.id);
    if (existing) {
      existing.count++;
      existing.production += def.powerProduction ?? 0;
      existing.consumption += def.powerConsumption ?? 0;
    } else {
      buildingCounts.set(def.id, {
        name: def.name,
        count: 1,
        production: def.powerProduction ?? 0,
        consumption: def.powerConsumption ?? 0,
      });
    }
  }

  // Sort by net contribution (producers first, then consumers)
  const sorted = [...buildingCounts.values()].sort((a, b) => {
    const netA = a.production - a.consumption;
    const netB = b.production - b.consumption;
    return netB - netA;
  });

  const items: BreakdownItem[] = sorted.map((entry) => ({
    key: entry.name,
    name: entry.name,
    count: entry.count,
    value: entry.production > 0 ? entry.production : -entry.consumption,
  }));

  return items;
});
</script>

<template>
  <GPanel title="Power Grid" accent="yellow">
    <div class="power-content">
      <GMetricBar
        label="Grid Capacity"
        :value="state.powerGrid"
        :icon="Zap"
        :thresholds="powerGridThresholds"
      />

      <div class="power-stats">
        <div class="stat">
          <span class="stat-label">Production</span>
          <span class="stat-value positive">+{{ state.powerGridProduction }} kW</span>
        </div>
        <div class="stat">
          <span class="stat-label">Consumption</span>
          <span class="stat-value negative">-{{ state.powerGridConsumption }} kW</span>
        </div>
      </div>

      <GBreakdownList title="Breakdown" :items="breakdownItems" />

      <div v-if="hasEffects" class="effects-section">
        <div class="effects-title">Low Power Effects</div>
        <div class="effects-list">
          <div v-if="state.powerGridEfficiency < 1" class="effect">
            <span>Building Efficiency</span>
            <span class="effect-value negative">{{ efficiencyPercent }}%</span>
          </div>
        </div>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.power-content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.power-stats {
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
