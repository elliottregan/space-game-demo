<script setup lang="ts">
import { computed } from "vue";
import { Coffee, Zap, Droplets } from "lucide-vue-next";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

interface RecBuilding {
  name: string;
  count: number;
  moraleBoost: number;
  totalBoost: number;
  power: number;
  water: number;
}

// Get active recreational buildings (those with moraleBoost)
const recreationBuildings = computed<RecBuilding[]>(() => {
  const buildingCounts = new Map<string, RecBuilding>();

  for (const building of state.buildings) {
    if (building.status !== "active") continue;

    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.moraleBoost) continue;

    const existing = buildingCounts.get(def.id);
    if (existing) {
      existing.count++;
      existing.totalBoost += def.moraleBoost;
      existing.power += def.consumption?.power ?? 0;
      existing.water += def.consumption?.water ?? 0;
    } else {
      buildingCounts.set(def.id, {
        name: def.name,
        count: 1,
        moraleBoost: def.moraleBoost,
        totalBoost: def.moraleBoost,
        power: def.consumption?.power ?? 0,
        water: def.consumption?.water ?? 0,
      });
    }
  }

  return [...buildingCounts.values()].sort((a, b) => b.totalBoost - a.totalBoost);
});

const totalMoraleBoost = computed(() => state.moraleBoost);

const totalConsumption = computed(() => {
  let power = 0;
  let water = 0;

  for (const building of recreationBuildings.value) {
    power += building.power;
    water += building.water;
  }

  return { power, water };
});
</script>

<template>
  <GPanel title="Third Places" accent="cyan">
    <div class="recreation-content">
      <div class="stats-row">
        <div class="stat">
          <Coffee :size="16" class="stat-icon positive" />
          <span class="stat-label">Morale</span>
          <span class="stat-value positive">+{{ totalMoraleBoost }}</span>
        </div>
        <div v-if="totalConsumption.power > 0" class="stat">
          <Zap :size="16" class="stat-icon negative" />
          <span class="stat-label">Power</span>
          <span class="stat-value negative">-{{ totalConsumption.power }}</span>
        </div>
        <div v-if="totalConsumption.water > 0" class="stat">
          <Droplets :size="16" class="stat-icon negative" />
          <span class="stat-label">Water</span>
          <span class="stat-value negative">-{{ totalConsumption.water }}</span>
        </div>
      </div>

      <div v-if="recreationBuildings.length > 0" class="buildings-list">
        <div v-for="building in recreationBuildings" :key="building.name" class="building-item">
          <span class="building-name">
            {{ building.name }}
            <span v-if="building.count > 1" class="building-count">x{{ building.count }}</span>
          </span>
          <div class="building-stats">
            <span class="building-boost">+{{ building.totalBoost }}</span>
            <span v-if="building.power > 0" class="building-consumption"
              >-{{ building.power }} pwr</span
            >
            <span v-if="building.water > 0" class="building-consumption"
              >-{{ building.water }} H₂O</span
            >
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        No recreational buildings yet. Build cafes, gardens, or other social spaces to boost colony
        morale.
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.recreation-content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.stats-row {
  display: flex;
  gap: var(--g-space-md);
  padding: var(--g-space-sm);
  background: rgba(128, 128, 128, 0.1);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.stat-icon.positive {
  color: var(--g-color-positive);
}

.stat-icon.negative {
  color: var(--g-color-negative);
}

.stat-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.stat-value {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.stat-value.positive {
  color: var(--g-color-positive);
}

.stat-value.negative {
  color: var(--g-color-negative);
}

.buildings-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.building-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-sm);
}

.building-name {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.building-count {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
}

.building-stats {
  display: flex;
  gap: var(--g-space-sm);
  font-family: var(--g-font-mono);
}

.building-boost {
  color: var(--g-color-positive);
}

.building-consumption {
  color: var(--g-color-negative);
  font-size: var(--g-font-size-xs);
}

.empty-state {
  padding: var(--g-space-md);
  text-align: center;
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  font-style: italic;
}
</style>
