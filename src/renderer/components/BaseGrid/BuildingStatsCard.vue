<!-- src/renderer/components/BaseGrid/BuildingStatsCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition } from "../../../core/models/Building";
import { type GridPosition, PowerState } from "../../../core/models/Grid";
import GPanel from "../../ui/primitives/GPanel.vue";
import GProgress from "../../ui/primitives/GProgress.vue";
import GButton from "../../ui/primitives/GButton.vue";

interface Props {
  building: Building;
  definition: BuildingDefinition;
  position: GridPosition;
  powerState: PowerState;
  batteryLevel: number;
  distanceToPower: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  demolish: [buildingId: string];
}>();

const powerStateLabel = computed(() => {
  switch (props.powerState) {
    case PowerState.POWERED:
      return "Powered";
    case PowerState.ON_BATTERY:
      return "On Battery";
    case PowerState.LOW_BATTERY:
      return "Low Battery";
    case PowerState.UNPOWERED:
      return "Unpowered";
    default:
      return "Unknown";
  }
});

const powerStateColor = computed(() => {
  switch (props.powerState) {
    case PowerState.POWERED:
      return "var(--g-color-positive)";
    case PowerState.ON_BATTERY:
      return "var(--g-color-warning)";
    case PowerState.LOW_BATTERY:
      return "var(--g-color-negative)";
    case PowerState.UNPOWERED:
      return "var(--g-color-text-muted)";
    default:
      return "var(--g-color-text-muted)";
  }
});

const batteryPercent = computed(() => Math.round(props.batteryLevel * 100));

const productionEntries = computed(() => {
  if (!props.definition.production) return [];
  return Object.entries(props.definition.production).filter(([, v]) => v !== 0);
});

const consumptionEntries = computed(() => {
  if (!props.definition.consumption) return [];
  return Object.entries(props.definition.consumption).filter(([, v]) => v !== 0);
});

const batteryVariant = computed(() => {
  if (props.batteryLevel < 0.33) return "negative";
  if (props.batteryLevel < 0.66) return "warning";
  return "default";
});
</script>

<template>
  <GPanel class="stats-card" :title="definition.name">
    <template #header-actions>
      <button class="close-btn" @click="emit('close')">x</button>
    </template>

    <div class="card-content">
      <p class="description">{{ definition.description }}</p>

      <div class="stats-section">
        <h4>Location</h4>
        <div class="stat-row">
          <span class="stat-label">Position</span>
          <span class="stat-value">({{ position.x }}, {{ position.y }})</span>
        </div>
      </div>

      <div class="stats-section">
        <h4>Power</h4>
        <div class="stat-row">
          <span class="stat-label">Status</span>
          <span class="stat-value" :style="{ color: powerStateColor }">
            {{ powerStateLabel }}
          </span>
        </div>
        <div v-if="definition.powerConsumption" class="stat-row">
          <span class="stat-label">Consumption</span>
          <span class="stat-value">{{ definition.powerConsumption }}/sol</span>
        </div>
        <div v-if="definition.powerProduction" class="stat-row">
          <span class="stat-label">Production</span>
          <span class="stat-value positive">+{{ definition.powerProduction }}/sol</span>
        </div>
        <div v-if="powerState !== PowerState.POWERED" class="battery-section">
          <span class="stat-label">Battery</span>
          <GProgress :percent="batteryPercent" :variant="batteryVariant" />
          <span class="battery-percent">{{ batteryPercent }}%</span>
        </div>
        <div v-if="distanceToPower < Infinity" class="stat-row">
          <span class="stat-label">Distance to Power</span>
          <span class="stat-value">{{ distanceToPower }} cells</span>
        </div>
      </div>

      <div v-if="productionEntries.length || consumptionEntries.length" class="stats-section">
        <h4>Resources</h4>
        <div v-if="productionEntries.length" class="stat-row">
          <span class="stat-label">Production</span>
          <span class="stat-value positive">
            <span v-for="([key, val], idx) in productionEntries" :key="key">
              {{ idx > 0 ? ", " : "" }}+{{ val }} {{ key }}
            </span>
          </span>
        </div>
        <div v-if="consumptionEntries.length" class="stat-row">
          <span class="stat-label">Consumption</span>
          <span class="stat-value negative">
            <span v-for="([key, val], idx) in consumptionEntries" :key="key">
              {{ idx > 0 ? ", " : "" }}-{{ Math.abs(val) }} {{ key }}
            </span>
          </span>
        </div>
      </div>

      <div v-if="definition.workerSlots" class="stats-section">
        <h4>Workers</h4>
        <div class="stat-row">
          <span class="stat-label">Assigned</span>
          <span class="stat-value"
            >{{ building.assignedWorkers.length }} / {{ definition.workerSlots }}</span
          >
        </div>
      </div>
    </div>

    <template #footer>
      <GButton variant="danger" class="demolish-btn" @click="emit('demolish', building.id)">
        Demolish
      </GButton>
    </template>
  </GPanel>
</template>

<style scoped>
.stats-card {
  width: 280px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.close-btn:hover {
  opacity: 0.8;
}

.description {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  margin: 0 0 var(--g-space-md) 0;
}

.stats-section {
  margin-bottom: var(--g-space-md);
}

.stats-section h4 {
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  color: var(--g-color-text-muted);
  margin: 0 0 var(--g-space-xs) 0;
  letter-spacing: 0.05em;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
  padding: var(--g-space-xs) 0;
}

.stat-label {
  color: var(--g-color-text-muted);
}

.stat-value {
  font-family: var(--g-font-mono);
}

.stat-value.positive {
  color: var(--g-color-positive);
}

.stat-value.negative {
  color: var(--g-color-negative);
}

.battery-section {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-xs) 0;
}

.battery-section .stat-label {
  flex-shrink: 0;
}

.battery-percent {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  min-width: 36px;
  text-align: right;
}

.demolish-btn {
  width: 100%;
}
</style>
