<script setup lang="ts">
import { computed } from "vue";
import { LS_QUALITY_COMFORTABLE } from "../../../core/balance/LifeSupportBalance";
import { BuildingId } from "../../../core/models/Building";
import { gameService } from "../../services/GameService";

interface ColonyNeed {
  id: string;
  icon: string;
  label: string;
  reason: string;
  building: string;
  buildingId: BuildingId;
  priority: number;
}

const state = computed(() => gameService.getState());

const needs = computed<ColonyNeed[]>(() => {
  const result: ColonyNeed[] = [];

  // Priority 1: Housing - unhoused colonists
  const unhousedCount = state.value.unhoused.length;
  if (unhousedCount > 0) {
    result.push({
      id: "housing",
      icon: "🏠",
      label: "Housing",
      reason: `${unhousedCount} unhoused`,
      building: "Habitat",
      buildingId: BuildingId.HABITAT,
      priority: 1,
    });
  }

  // Priority 2: Life support - quality below comfortable threshold
  const lifeSupportQuality = state.value.lifeSupportQuality;
  if (lifeSupportQuality < LS_QUALITY_COMFORTABLE) {
    result.push({
      id: "lifeSupport",
      icon: "🌬️",
      label: "Life Support",
      reason: `${Math.round(lifeSupportQuality * 100)}% (low)`,
      building: "Habitat",
      buildingId: BuildingId.HABITAT,
      priority: 2,
    });
  }

  // Priority 3: Food - production <= consumption
  const foodProd = state.value.production.food ?? 0;
  const foodCons = state.value.consumption.food ?? 0;
  if (foodProd <= foodCons) {
    result.push({
      id: "food",
      icon: "🌾",
      label: "Food",
      reason: foodProd === 0 ? "No production" : "Production low",
      building: "Basic Farm",
      buildingId: BuildingId.BASIC_FARM,
      priority: 3,
    });
  }

  // Priority 4: Water - production <= consumption
  const waterProd = state.value.production.water ?? 0;
  const waterCons = state.value.consumption.water ?? 0;
  if (waterProd <= waterCons) {
    result.push({
      id: "water",
      icon: "💧",
      label: "Water",
      reason: waterProd === 0 ? "No production" : "Production low",
      building: "Water Extractor",
      buildingId: BuildingId.WATER_EXTRACTOR,
      priority: 4,
    });
  }

  // Sort by priority
  return result.sort((a, b) => a.priority - b.priority);
});

const hasNeeds = computed(() => needs.value.length > 0);
</script>

<template>
  <aside class="needs-panel">
    <header class="panel-header">
      <h3>Needs</h3>
    </header>

    <div class="panel-content">
      <!-- Needs list -->
      <template v-if="hasNeeds">
        <div v-for="need in needs" :key="need.id" class="need-item">
          <div class="need-header">
            <span class="need-icon">{{ need.icon }}</span>
            <span class="need-label">{{ need.label }}</span>
          </div>
          <div class="need-reason">{{ need.reason }}</div>
          <div class="need-action">→ Build {{ need.building }}</div>
        </div>
      </template>

      <!-- All good state -->
      <div v-else class="all-good">
        <div class="all-good-icon">✓</div>
        <div class="all-good-label">Colony stable</div>
        <div class="all-good-sublabel">No immediate needs</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.needs-panel {
  width: 200px;
  flex-shrink: 0;
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: var(--g-space-sm) var(--g-space-md);
  border-bottom: 1px solid var(--g-color-border);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--g-font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text-muted);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--g-space-sm);
}

.need-item {
  padding: var(--g-space-sm);
  border-left: 3px solid var(--color-warning);
  background: var(--g-color-bg-base);
  margin-bottom: var(--g-space-sm);
}

.need-item:last-child {
  margin-bottom: 0;
}

.need-header {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-xs);
}

.need-icon {
  font-size: var(--g-font-size-base);
}

.need-label {
  font-weight: 600;
  font-size: var(--g-font-size-sm);
}

.need-reason {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.need-action {
  font-size: var(--g-font-size-xs);
  font-family: var(--g-font-mono);
  color: var(--color-info);
}

.all-good {
  text-align: center;
  padding: var(--g-space-lg) var(--g-space-md);
}

.all-good-icon {
  font-size: 2rem;
  color: var(--color-positive);
  margin-bottom: var(--g-space-sm);
}

.all-good-label {
  font-weight: 600;
  font-size: var(--g-font-size-sm);
  margin-bottom: var(--g-space-xs);
}

.all-good-sublabel {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}
</style>
