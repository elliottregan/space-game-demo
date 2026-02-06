<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle, Clock, Pause, Recycle, AlertTriangle } from "lucide-vue-next";
import type { BuildingStatus } from "../../../core/models/Building";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

// Build building data with all relevant details
const buildingData = computed(() => {
  const allBuildings = [...state.buildings, ...state.pendingBuildings];

  return allBuildings
    .map((b) => {
      const def = state.buildingDefinitions.find((d) => d.id === b.definitionId);
      if (!def) return null;

      // Calculate net production for key resources
      const production = def.production ?? {};
      const consumption = def.consumption ?? {};

      // Format production/consumption string
      const flows: string[] = [];
      const resources = ["food", "water", "power", "materials"] as const;
      for (const res of resources) {
        const prod = production[res] ?? 0;
        const cons = consumption[res] ?? 0;
        const net = prod - cons;
        if (net !== 0) {
          const prefix = net > 0 ? "+" : "";
          const abbrev = res === "materials" ? "mat" : res.slice(0, 3);
          flows.push(`${prefix}${net} ${abbrev}`);
        }
      }

      // Worker info
      const workerInfo = def.workerSlots ? `${b.assignedWorkers.length}/${def.workerSlots}` : "-";

      // Housing info
      const housingInfo = def.capacity ? `${getOccupancy(b.id)}/${def.capacity}` : null;

      return {
        id: b.id,
        name: def.name,
        status: b.status,
        purpose: def.purpose ?? "industrial",
        workers: workerInfo,
        hasWorkerSlots: !!def.workerSlots,
        isUnderstaffed: def.workerSlots ? b.assignedWorkers.length < def.workerSlots : false,
        housing: housingInfo,
        flows: flows.join(", ") || "-",
        mode: b.mode,
        broken: b.broken,
        lifeSupportCapacity: def.lifeSupportCapacity ?? 0,
        lifeSupportLoad: def.lifeSupportLoad ?? 0,
        moraleBoost: def.moraleBoost ?? 0,
        constructionProgress:
          b.status === "pending"
            ? Math.round((b.constructionProgress / def.constructionTime) * 100)
            : null,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => {
      // Sort by status (active first), then by name
      const statusOrder: Record<BuildingStatus, number> = {
        active: 0,
        idle: 1,
        pending: 2,
        disabled: 3,
        recycling: 4,
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name);
    });
});

function getOccupancy(buildingId: string): number {
  const colonists = state.colonists.filter((c) => c.housingId === buildingId);
  return colonists.length;
}

// oxlint-disable-next-line no-unused-vars
function getStatusIcon(status: BuildingStatus, broken: boolean) {
  if (broken) return AlertTriangle;
  switch (status) {
    case "active":
      return CheckCircle;
    case "pending":
      return Clock;
    case "disabled":
      return Pause;
    case "recycling":
      return Recycle;
    case "idle":
      return Pause;
    default:
      return CheckCircle;
  }
}

// oxlint-disable-next-line no-unused-vars
function getStatusColor(status: BuildingStatus, broken: boolean): string {
  if (broken) return "var(--color-danger)";
  switch (status) {
    case "active":
      return "var(--color-positive)";
    case "pending":
      return "var(--color-info)";
    case "disabled":
      return "var(--color-muted)";
    case "recycling":
      return "var(--color-warning)";
    case "idle":
      return "var(--color-warning)";
    default:
      return "var(--g-color-text)";
  }
}

// oxlint-disable-next-line no-unused-vars
function getStatusLabel(status: BuildingStatus, broken: boolean, progress: number | null): string {
  if (broken) return "Broken";
  if (status === "pending" && progress !== null) return `${progress}%`;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// oxlint-disable-next-line no-unused-vars
function getPurposeColor(purpose: string): string {
  switch (purpose) {
    case "residential":
      return "var(--color-info)";
    case "industrial":
      return "var(--color-warning)";
    case "social":
      return "var(--color-positive)";
    default:
      return "var(--g-color-text-muted)";
  }
}

// oxlint-disable-next-line no-unused-vars
function getModeLabel(mode: string): string {
  switch (mode) {
    case "conservation":
      return "Eco";
    case "normal":
      return "Norm";
    case "overdrive":
      return "Over";
    default:
      return mode;
  }
}

// oxlint-disable-next-line no-unused-vars
function getModeColor(mode: string): string {
  switch (mode) {
    case "conservation":
      return "var(--color-info)";
    case "normal":
      return "var(--g-color-text-muted)";
    case "overdrive":
      return "var(--color-warning)";
    default:
      return "var(--g-color-text)";
  }
}
</script>

<template>
  <GPanel title="Buildings" accent="amber">
    <div class="building-table">
      <div class="table-header">
        <span class="col-name">Name</span>
        <span class="col-status">Status</span>
        <span class="col-purpose">Type</span>
        <span class="col-workers">Workers</span>
        <span class="col-flows">Resources</span>
        <span class="col-mode">Mode</span>
      </div>
      <div v-for="building in buildingData" :key="building.id" class="building-row">
        <span class="col-name" :title="building.name">{{ building.name }}</span>
        <span
          class="col-status"
          :style="{ color: getStatusColor(building.status, building.broken) }"
          :title="building.broken ? 'Building needs repair' : building.status"
        >
          <component
            :is="getStatusIcon(building.status, building.broken)"
            :size="12"
            class="status-icon"
          />
          {{ getStatusLabel(building.status, building.broken, building.constructionProgress) }}
        </span>
        <span class="col-purpose" :style="{ color: getPurposeColor(building.purpose) }">
          {{ building.purpose.slice(0, 3).toUpperCase() }}
        </span>
        <span
          class="col-workers"
          :class="{ understaffed: building.isUnderstaffed }"
          :title="building.housing ? `Housing: ${building.housing}` : undefined"
        >
          {{ building.housing ?? building.workers }}
        </span>
        <span class="col-flows" :title="building.flows">
          {{ building.flows }}
        </span>
        <span class="col-mode" :style="{ color: getModeColor(building.mode) }">
          {{ getModeLabel(building.mode) }}
        </span>
      </div>
      <div v-if="buildingData.length === 0" class="empty-state">
        No buildings yet. Construct buildings from the Operations tab.
      </div>
    </div>
    <p class="table-hint">Workers shows assigned/slots. Resources shows net production per sol.</p>
  </GPanel>
</template>

<style scoped>
.building-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.table-header {
  display: flex;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--g-color-border);
  position: sticky;
  top: 0;
  background: var(--g-color-bg-base);
  z-index: 1;
}

.building-row {
  display: flex;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg-elevated);
}

.building-row:hover {
  background: var(--g-color-bg-surface);
}

.col-name {
  flex: 1;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-status {
  width: 70px;
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.status-icon {
  flex-shrink: 0;
}

.col-purpose {
  width: 50px;
  text-align: center;
  font-weight: bold;
}

.col-workers {
  width: 60px;
  text-align: center;
  color: var(--g-color-text-muted);
}

.col-workers.understaffed {
  color: var(--color-warning);
}

.col-flows {
  width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--g-color-text-muted);
}

.col-mode {
  width: 50px;
  text-align: center;
}

.empty-state {
  padding: var(--g-space-lg);
  text-align: center;
  color: var(--g-color-text-muted);
  font-style: italic;
}

.table-hint {
  margin-top: var(--g-space-sm);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}
</style>
