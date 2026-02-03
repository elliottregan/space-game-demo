<!-- src/renderer/components/BaseGrid/BuildingStatsCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle } from "lucide-vue-next";
import type { Building, BuildingDefinition } from "../../../core/models/Building";
import type { Colonist, ColonistIdeology } from "../../../core/models/Colonist";
import { type GridPosition, PowerState } from "../../../core/models/Grid";
import GPanel from "../../ui/primitives/GPanel.vue";
import GProgress from "../../ui/primitives/GProgress.vue";
import GButton from "../../ui/primitives/GButton.vue";
import {
  getDominantFactionInfo,
  FACTION_CSS_VARS,
  FACTION_SHORT_NAMES,
} from "../../utils/ideologyDisplay";
import { gameService } from "../../services/GameService";

interface Props {
  building: Building;
  definition: BuildingDefinition;
  position: GridPosition;
  powerState: PowerState;
  batteryLevel: number;
  distanceToPower: number;
  constructionProgress?: number; // 0-1 for pending buildings
  colonists: Colonist[]; // All colonists for lookup
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  demolish: [buildingId: string];
  cancel: [buildingId: string];
  unassignWorker: [colonistId: string];
}>();

const isPending = computed(() => props.building.status === "pending");
const constructionPercent = computed(() => Math.round((props.constructionProgress ?? 0) * 100));

// Get workers assigned to this building
const assignedWorkers = computed(() => {
  return props.building.assignedWorkers
    .map((id) => props.colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => c !== undefined);
});

// Get residents living in this building (for residential buildings)
const residents = computed(() => {
  if (props.definition.purpose !== "residential") return [];
  return props.colonists.filter((c) => c.housingId === props.building.id);
});

// Determine dominant ideology for a colonist using unified ideology display model
function getDominantIdeology(ideology?: ColonistIdeology): { name: string; color: string } | null {
  const info = getDominantFactionInfo(ideology);
  if (!info) return null;
  return { name: info.name, color: info.color };
}

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

const isConnected = computed(() => {
  if (!props.building?.id) return true; // No building selected
  return gameService.isConnectedToHabitat(props.building.id);
});
</script>

<template>
  <GPanel class="stats-card" :title="definition.name">
    <template #header-actions>
      <button class="close-btn" @click="emit('close')">x</button>
    </template>

    <div class="card-content">
      <p class="description">{{ definition.description }}</p>

      <!-- Connectivity warning for disconnected buildings -->
      <div v-if="!isConnected" class="connectivity-warning">
        <AlertTriangle :size="16" />
        <span>Not connected to habitat</span>
      </div>

      <!-- Construction progress for pending buildings -->
      <div v-if="isPending" class="stats-section construction-section">
        <h4>Construction</h4>
        <div class="construction-progress">
          <GProgress :percent="constructionPercent" variant="info" />
          <span class="construction-percent">{{ constructionPercent }}%</span>
        </div>
        <p class="construction-note">Building under construction</p>
      </div>

      <div class="stats-section">
        <h4>Location</h4>
        <div class="stat-row">
          <span class="stat-label">Position</span>
          <span class="stat-value">({{ position.x }}, {{ position.y }})</span>
        </div>
      </div>

      <div v-if="!isPending" class="stats-section">
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
        <div v-if="assignedWorkers.length" class="colonist-list">
          <div v-for="worker in assignedWorkers" :key="worker.id" class="colonist-item">
            <span class="colonist-name">{{ worker.name }}</span>
            <span
              v-if="getDominantIdeology(worker.ideology)"
              class="ideology-badge"
              :style="{ backgroundColor: getDominantIdeology(worker.ideology)?.color }"
            >
              {{ getDominantIdeology(worker.ideology)?.name }}
            </span>
            <span v-else class="ideology-badge neutral">Neutral</span>
            <button
              class="unassign-btn"
              title="Unassign worker"
              @click="emit('unassignWorker', worker.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div v-if="residents.length" class="stats-section">
        <h4>Residents</h4>
        <div class="colonist-list">
          <div v-for="resident in residents" :key="resident.id" class="colonist-item">
            <span class="colonist-name">{{ resident.name }}</span>
            <span
              v-if="getDominantIdeology(resident.ideology)"
              class="ideology-badge"
              :style="{ backgroundColor: getDominantIdeology(resident.ideology)?.color }"
            >
              {{ getDominantIdeology(resident.ideology)?.name }}
            </span>
            <span v-else class="ideology-badge neutral">Neutral</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <GButton
        v-if="isPending"
        variant="warning"
        class="action-btn"
        @click="emit('cancel', building.id)"
      >
        Cancel Construction
      </GButton>
      <GButton v-else variant="danger" class="action-btn" @click="emit('demolish', building.id)">
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

.action-btn {
  width: 100%;
}

.construction-section {
  background: rgba(33, 150, 243, 0.1);
  padding: var(--g-space-sm);
  margin: 0 calc(-1 * var(--g-space-md)) var(--g-space-md);
  border-top: 1px solid var(--g-color-info);
  border-bottom: 1px solid var(--g-color-info);
}

.construction-progress {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.construction-percent {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-info);
  min-width: 36px;
  text-align: right;
}

.construction-note {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-info);
  margin: var(--g-space-xs) 0 0 0;
}

.colonist-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  margin-top: var(--g-space-xs);
}

.colonist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--g-space-xs);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--g-radius-sm);
  font-size: var(--g-font-size-sm);
}

.colonist-name {
  color: var(--g-color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ideology-badge {
  padding: 2px 6px;
  border-radius: var(--g-radius-sm);
  font-size: var(--g-font-size-xs);
  font-weight: 500;
  color: white;
  flex-shrink: 0;
  margin-left: var(--g-space-xs);
}

.ideology-badge.neutral {
  background-color: var(--g-color-text-muted);
}

.unassign-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
  margin-left: var(--g-space-xs);
  cursor: pointer;
  opacity: 0.6;
  transition:
    opacity 0.15s,
    color 0.15s;
}

.unassign-btn:hover {
  opacity: 1;
  color: var(--g-color-negative);
}

.connectivity-warning {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-sm);
  margin-bottom: var(--g-space-md);
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid var(--g-color-warning);
  border-radius: var(--g-radius-sm);
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
}
</style>
