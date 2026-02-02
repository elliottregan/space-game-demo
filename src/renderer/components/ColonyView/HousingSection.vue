<script setup lang="ts">
import { computed, ref } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { BuildingPurpose } from "../../../core/models/Building";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { GButton, GEmptyState, GPanel } from "../../ui";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildableHousingCard from "./BuildableHousingCard.vue";
import HousingBuildingCard from "./HousingBuildingCard.vue";
import UnhousedPool from "./UnhousedPool.vue";

const props = defineProps<{
  buildings: Building[];
  housingAssignments: Record<string, Colonist[]>;
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
  unhoused: Colonist[];
}>();

const selectedColonistId = ref<string | null>(null);
const draggingColonistId = ref<string | null>(null);

const api = gameService.api;

const residentialDefinitions = computed(() => {
  return props.buildingDefinitions.filter((def) => {
    if (def.purpose !== BuildingPurpose.Residential) return false;
    if (def.requiredTech && !api.technology.isResearched(def.requiredTech)) return false;
    return true;
  });
});

function canBuild(defId: string): boolean {
  return api.buildings.canBuild(defId).allowed;
}

function getBuildReason(defId: string): string | undefined {
  const check = api.buildings.canBuild(defId);
  return check.allowed ? undefined : check.reason;
}

function buildBuilding(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

function getPendingCount(defId: string): number {
  return gameService.getState().pendingBuildings.filter((b) => b.definitionId === defId).length;
}

function onBuildingHover(def: { cost: Record<string, number> }): void {
  const currentResources = api.resources.snapshot().current as Record<string, number>;
  const info = calculateHighlightInfo(def.cost, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

function onBuildingLeave(): void {
  clearHighlights();
}

const availableBeds = computed(() => {
  let total = 0;
  for (const building of props.buildings) {
    if (building.status !== "active") continue;
    const def = props.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.capacity) continue;
    const residents = props.housingAssignments[building.id]?.length || 0;
    total += def.capacity - residents;
  }
  return total;
});

function handleOptimizeHousing() {
  gameService.optimizeHousing();
}

function getDefinition(
  building: Building,
  definitions: BuildingDefinition[],
): BuildingDefinition | undefined {
  return definitions.find((d) => d.id === building.definitionId);
}

function onSelectColonist(colonistId: string | null) {
  selectedColonistId.value = colonistId;
}

function onDragStart(colonistId: string) {
  draggingColonistId.value = colonistId;
  selectedColonistId.value = colonistId;
}

function onDragEnd() {
  draggingColonistId.value = null;
}

function onAssignToHousing(colonistId: string, buildingId: string) {
  gameService.api.colony.assignToHousing(colonistId, buildingId);
  draggingColonistId.value = null;
  selectedColonistId.value = null;
}

function onUnassignFromHousing(colonistId: string) {
  gameService.api.colony.unassignFromHousing(colonistId);
  draggingColonistId.value = null;
}
</script>

<template>
  <GPanel title="Housing">
    <div class="build-housing-section">
      <div class="section-label">Build New Housing</div>
      <div class="buildable-list">
        <BuildableHousingCard
          v-for="def in residentialDefinitions"
          :key="def.id"
          :definition="def"
          :can-build="canBuild(def.id)"
          :build-reason="getBuildReason(def.id)"
          :pending-count="getPendingCount(def.id)"
          @build="buildBuilding(def.id)"
          @hover="onBuildingHover(def)"
          @leave="onBuildingLeave"
        />
      </div>
    </div>

    <div class="housing-controls">
      <span class="housing-stat">
        Unhoused: {{ unhoused.length }} | Available beds: {{ availableBeds }}
      </span>
      <GButton
        size="sm"
        :disabled="unhoused.length === 0 || availableBeds === 0"
        @click="handleOptimizeHousing"
      >
        Optimize Housing
      </GButton>
    </div>

    <div class="housing-layout">
      <UnhousedPool
        :colonists="unhoused"
        :skill-definitions="skillDefinitions"
        :selected-colonist-id="selectedColonistId"
        @select="onSelectColonist"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @drop="onUnassignFromHousing"
      />

      <div class="housing-buildings">
        <GEmptyState
          v-if="buildings.length === 0"
          message="No habitats built. Colonists need housing!"
        />
        <HousingBuildingCard
          v-for="building in buildings"
          :key="building.id"
          :building="building"
          :definition="getDefinition(building, buildingDefinitions)!"
          :residents="housingAssignments[building.id] || []"
          :dragging-colonist-id="draggingColonistId"
          @assign="onAssignToHousing"
          @unassign="onUnassignFromHousing"
        />
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.housing-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--g-space-md);
  margin-bottom: var(--g-space-md);
  padding: var(--g-space-sm);
  background: rgba(128, 128, 128, 0.1);
  border-radius: var(--g-radius-sm);
}

.housing-stat {
  font-size: 0.85em;
  color: var(--g-color-muted);
}

.housing-layout {
  display: flex;
  gap: var(--g-space-lg);
}

.housing-buildings {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

@media (max-width: 768px) {
  .housing-layout {
    flex-direction: column;
  }

  .housing-layout > :first-child {
    max-width: none;
  }
}

.build-housing-section {
  margin-bottom: var(--g-space-md);
  padding-bottom: var(--g-space-md);
  border-bottom: 1px solid var(--g-color-border);
}

.section-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-sm);
}

.buildable-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
</style>
