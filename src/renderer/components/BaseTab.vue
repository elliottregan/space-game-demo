<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../services/GameService";
import type { GridPosition, DepositType, PowerState } from "../../core/models/Grid";
import type { Colonist } from "../../core/models/Colonist";
import { BuildingPurpose } from "../../core/models/Building";
import BaseGrid from "./BaseGrid/BaseGrid.vue";
import BuildingContextMenu from "./BaseGrid/BuildingContextMenu.vue";
import BuildingStatsCard from "./BaseGrid/BuildingStatsCard.vue";
import BuildingIconDefs from "./BaseGrid/BuildingIconDefs.vue";
import ColonyNeedsPanel from "./BaseGrid/ColonyNeedsPanel.vue";
import type { OccupantSlot } from "./BaseGrid/renderBaseGrid";
import { getDominantFaction } from "../utils/ideologyDisplay";

const state = computed(() => gameService.getState());

// Create lookup maps for colonists
const colonistMap = computed(() => new Map(state.value.colonists.map((c) => [c.id, c])));

// Grid data from state with occupant information
const gridBuildings = computed(() =>
  state.value.gridBuildings.map((b) => {
    // Find building definition
    const def = state.value.buildingDefinitions.find((d) => d.id === b.defId);
    // Find building instance (for assignedWorkers)
    const building = state.value.buildings.find((bld) => bld.id === b.id);

    let occupants: OccupantSlot[] | undefined;

    if (def && b.status !== "pending") {
      // Residential buildings - show housing occupancy
      if (def.purpose === BuildingPurpose.Residential && def.capacity) {
        const residents = state.value.colonists.filter((c) => c.housingId === b.id);
        occupants = [];

        // Add filled slots for current residents
        for (const resident of residents) {
          occupants.push({
            filled: true,
            faction: getDominantFaction(resident.ideology),
          });
        }

        // Add empty slots for remaining capacity
        const emptySlots = def.capacity - residents.length;
        for (let i = 0; i < emptySlots; i++) {
          occupants.push({ filled: false });
        }
      }
      // Work buildings - show worker slots
      else if (def.workerSlots && def.workerSlots > 0 && building) {
        occupants = [];

        // Add filled slots for assigned workers
        for (const workerId of building.assignedWorkers) {
          const worker = colonistMap.value.get(workerId);
          occupants.push({
            filled: true,
            faction: getDominantFaction(worker?.ideology),
          });
        }

        // Add empty slots for remaining capacity
        const emptySlots = def.workerSlots - building.assignedWorkers.length;
        for (let i = 0; i < emptySlots; i++) {
          occupants.push({ filled: false });
        }
      }
      // Social buildings - show capacity if defined
      else if (def.purpose === BuildingPurpose.Social && def.capacity) {
        const visitors = state.value.colonists.filter((c) => c.socialBuildingIds?.includes(b.id));
        occupants = [];

        // Add filled slots for visitors
        for (const visitor of visitors) {
          occupants.push({
            filled: true,
            faction: getDominantFaction(visitor.ideology),
          });
        }

        // Add empty slots for remaining capacity
        const emptySlots = Math.max(0, def.capacity - visitors.length);
        for (let i = 0; i < emptySlots; i++) {
          occupants.push({ filled: false });
        }
      }
    }

    return {
      id: b.id,
      defId: b.defId,
      name: b.name,
      position: b.position as GridPosition,
      powerState: b.powerState as PowerState,
      batteryLevel: b.batteryLevel,
      status: b.status,
      constructionProgress: b.constructionProgress,
      powerSourceId: b.powerSourceId,
      clusterId: b.clusterId,
      depotRange: b.depotRange,
      occupants,
    };
  }),
);

const gridDeposits = computed(() =>
  state.value.gridDeposits.map((d) => ({
    position: d.position as GridPosition,
    type: d.type as DepositType,
  })),
);

const powerStats = computed(() => state.value.powerStats);

// Selection state
const selectedPosition = ref<GridPosition | null>(null);
const selectedBuildingId = ref<string | null>(null);

// Context menu state
const contextMenuPosition = ref<GridPosition | null>(null);
const contextMenuScreenPos = ref({ x: 0, y: 0 });

// Building placement preview
const pendingBuildingDefId = ref<string | null>(null);

// Get available buildings for context menu
const availableBuildings = computed(() => {
  return state.value.buildingDefinitions.filter((def) => {
    const canBuild = gameService.canBuild(def.id);
    return canBuild;
  });
});

// Get selected building data (check both active and pending buildings)
const selectedBuilding = computed(() => {
  if (!selectedBuildingId.value) return null;
  return (
    state.value.buildings.find((b) => b.id === selectedBuildingId.value) ??
    state.value.pendingBuildings.find((b) => b.id === selectedBuildingId.value) ??
    null
  );
});

const selectedBuildingDef = computed(() => {
  if (!selectedBuilding.value) return null;
  return (
    state.value.buildingDefinitions.find((d) => d.id === selectedBuilding.value?.definitionId) ??
    null
  );
});

const selectedBuildingGridData = computed(() => {
  if (!selectedBuildingId.value) return null;
  return state.value.gridBuildings.find((b) => b.id === selectedBuildingId.value) ?? null;
});

// Event handlers
function handleCellClick(position: GridPosition, hasBuilding: boolean) {
  if (position.x < 0 || position.y < 0) {
    // Clicked outside grid - clear selection
    closeContextMenu();
    selectedPosition.value = null;
    selectedBuildingId.value = null;
    return;
  }

  selectedPosition.value = position;

  if (hasBuilding) {
    // Find and select the building
    const building = state.value.gridBuildings.find(
      (b) => b.position.x === position.x && b.position.y === position.y,
    );
    if (building) {
      selectedBuildingId.value = building.id;
      closeContextMenu();
    }
  } else {
    // Show context menu for empty cell
    selectedBuildingId.value = null;
    showContextMenu(position);
  }
}

// oxlint-disable-next-line no-unused-vars
function handleCellHover(_position: GridPosition | null) {
  // Could show tooltip in future
}

function showContextMenu(position: GridPosition) {
  contextMenuPosition.value = position;
  // Position menu near center-right of screen for now
  contextMenuScreenPos.value = {
    x: window.innerWidth / 2 + 100,
    y: window.innerHeight / 2 - 100,
  };
}

function closeContextMenu() {
  contextMenuPosition.value = null;
  pendingBuildingDefId.value = null;
}

function handleBuildingPreview(buildingDefId: string | null) {
  pendingBuildingDefId.value = buildingDefId;
}

function handleBuildingSelect(buildingDefId: string) {
  if (!contextMenuPosition.value) return;

  // Build the building at the selected grid position
  const building = gameService.startBuildingAtPosition(buildingDefId, contextMenuPosition.value);
  if (building) {
    console.log("Built", buildingDefId, "at", contextMenuPosition.value);
  }
  closeContextMenu();
}

function handleDemolish(buildingId: string) {
  gameService.startRecycling(buildingId);
  selectedBuildingId.value = null;
}

function handleCancelConstruction(buildingId: string) {
  gameService.cancelConstruction(buildingId);
  selectedBuildingId.value = null;
}

function handleUnassignWorker(colonistId: string) {
  gameService.api.colony.unassignFromBuilding(colonistId);
}

function closeStatsCard() {
  selectedBuildingId.value = null;
}

// Placement hints for context menu (mock for now - will connect in Task 18)
const placementHints = computed(() => ({
  hasPower: false,
  powerCapacityAvailable: 0,
  deposit: undefined as DepositType | undefined,
  isOccupied: false,
}));
</script>

<template>
  <div class="base-tab">
    <!-- SVG icon definitions for D3 to reference -->
    <BuildingIconDefs />

    <header class="base-header">
      <h2>Base Grid</h2>
      <div class="power-summary">
        <span class="power-stat powered">{{ powerStats.poweredCount }} powered</span>
        <span v-if="powerStats.onBatteryCount > 0" class="power-stat battery">
          {{ powerStats.onBatteryCount }} on battery
        </span>
        <span v-if="powerStats.unpoweredCount > 0" class="power-stat unpowered">
          {{ powerStats.unpoweredCount }} unpowered
        </span>
      </div>
    </header>

    <div class="base-content">
      <ColonyNeedsPanel />

      <div class="grid-container">
        <BaseGrid
          :buildings="gridBuildings"
          :deposits="gridDeposits"
          :selected-position="selectedPosition"
          :selected-building-def-id="pendingBuildingDefId"
          :selected-building-id="selectedBuildingId ?? undefined"
          @cell-click="handleCellClick"
          @cell-hover="handleCellHover"
        />
      </div>
    </div>

    <!-- Context menu for empty cells -->
    <BuildingContextMenu
      v-if="contextMenuPosition"
      :position="contextMenuPosition"
      :hints="placementHints"
      :available-buildings="availableBuildings"
      :screen-x="contextMenuScreenPos.x"
      :screen-y="contextMenuScreenPos.y"
      @select="handleBuildingSelect"
      @preview="handleBuildingPreview"
      @close="closeContextMenu"
    />

    <!-- Stats card for selected building -->
    <div
      v-if="selectedBuilding && selectedBuildingDef && selectedBuildingGridData"
      class="stats-overlay"
    >
      <BuildingStatsCard
        :building="selectedBuilding"
        :definition="selectedBuildingDef"
        :position="selectedBuildingGridData.position"
        :power-state="selectedBuildingGridData.powerState"
        :battery-level="selectedBuildingGridData.batteryLevel"
        :construction-progress="selectedBuildingGridData.constructionProgress"
        :distance-to-power="0"
        :colonists="state.colonists as Colonist[]"
        @close="closeStatsCard"
        @demolish="handleDemolish"
        @cancel="handleCancelConstruction"
        @unassign-worker="handleUnassignWorker"
      />
    </div>
  </div>
</template>

<style scoped>
.base-tab {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  height: 100%;
  position: relative;
}

.base-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.base-header h2 {
  margin: 0;
  font-size: var(--g-font-size-lg);
}

.power-summary {
  display: flex;
  gap: var(--g-space-md);
}

.power-stat {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.power-stat.powered {
  color: var(--g-color-positive);
}

.power-stat.battery {
  color: var(--g-color-warning);
}

.power-stat.unpowered {
  color: var(--g-color-negative);
}

.base-content {
  display: flex;
  flex: 1;
  gap: var(--g-space-md);
  overflow: hidden;
}

.grid-container {
  flex: 1;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  overflow: hidden;
}

.stats-overlay {
  position: absolute;
  top: 80px;
  right: var(--g-space-md);
  z-index: 100;
}
</style>
