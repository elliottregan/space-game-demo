<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import type { BuildingDefinition } from "../../../facade";
import { highlightResources, clearHighlights } from "../../directives/ResourceHighlight";
import { calculateHighlightInfo } from "../../utils/formatters";
import { GPanel } from "../../ui";
import CategoryTabs from "./CategoryTabs.vue";
import BuildingCard from "./BuildingCard.vue";
import ConstructionQueue from "./ConstructionQueue.vue";
import BuildingMaintenance from "./BuildingMaintenance.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

const selectedCategory = ref<"all" | "available" | "built" | "recreation">("available");

// Computed properties use reactive state for proper Vue reactivity
const availableBuildings = computed(() => {
  return state.buildingDefinitions.filter((def) => {
    if (def.requiredTech) {
      return api.technology.isResearched(def.requiredTech);
    }
    return true;
  });
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const filteredBuildings = computed(() => {
  switch (selectedCategory.value) {
    case "available":
      return availableBuildings.value;
    case "built":
      return state.buildingDefinitions.filter(
        (def) =>
          state.buildings.some((b) => b.definitionId === def.id) ||
          state.pendingBuildings.some((b) => b.definitionId === def.id),
      );
    case "recreation":
      return availableBuildings.value.filter((def) => def.moraleBoost !== undefined);
    default:
      return state.buildingDefinitions;
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeBuildings = computed(() => state.buildings);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const pendingBuildings = computed(() => state.pendingBuildings);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canBuild(defId: string): boolean {
  return api.buildings.canBuild(defId).allowed;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildReason(defId: string): string | undefined {
  const check = api.buildings.canBuild(defId);
  return check.allowed ? undefined : check.reason;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function buildBuilding(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildingCount(defId: string): number {
  return (
    state.buildings.filter((b) => b.definitionId === defId).length +
    state.pendingBuildings.filter((b) => b.definitionId === defId).length
  );
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPendingCount(defId: string): number {
  return state.pendingBuildings.filter((b) => b.definitionId === defId).length;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isLocked(def: BuildingDefinition): boolean {
  if (!def.requiredTech) return false;
  return !api.technology.isResearched(def.requiredTech);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getRequiredTechName(def: BuildingDefinition): string {
  if (!def.requiredTech) return "";
  const tech = api.technology.getById(def.requiredTech);
  return tech?.name || def.requiredTech;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onBuildingHover(def: BuildingDefinition): void {
  const currentResources = api.resources.snapshot().current as Record<string, number>;
  const info = calculateHighlightInfo(def.cost, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onBuildingLeave(): void {
  clearHighlights();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildingName(definitionId: string): string {
  return api.buildings.getDefinition(definitionId)?.name || definitionId;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getConstructionTime(definitionId: string): number {
  return api.buildings.getDefinition(definitionId)?.constructionTime || 0;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getMaintenanceCost(buildingId: string) {
  return api.buildings.getMaintenanceCost(buildingId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canPerformMaintenance(buildingId: string): boolean {
  return api.buildings.canPerformMaintenance(buildingId).allowed;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function performMaintenance(buildingId: string): void {
  const result = api.buildings.performMaintenance(buildingId);
  if (!result.success) {
    console.warn(`Maintenance failed: ${result.error.type}`, result.error);
  }
}
</script>

<template>
  <GPanel title="Buildings" accent="amber">
    <CategoryTabs
      :selected-category="selectedCategory"
      :active-count="activeBuildings.length"
      @update:selected-category="selectedCategory = $event"
    />

    <div class="building-list">
      <BuildingCard
        v-for="def in filteredBuildings"
        :key="def.id"
        :definition="def"
        :count="getBuildingCount(def.id)"
        :pending-count="getPendingCount(def.id)"
        :locked="isLocked(def)"
        :can-build="canBuild(def.id)"
        :build-reason="getBuildReason(def.id)"
        :required-tech-name="getRequiredTechName(def)"
        @build="buildBuilding(def.id)"
        @hover="onBuildingHover(def)"
        @leave="onBuildingLeave"
      />
    </div>

    <ConstructionQueue
      :pending-buildings="pendingBuildings"
      :get-building-name="getBuildingName"
      :get-construction-time="getConstructionTime"
    />

    <BuildingMaintenance
      :buildings="activeBuildings"
      :get-definition="(defId) => api.buildings.getDefinition(defId)"
      :get-maintenance-cost="getMaintenanceCost"
      :can-perform-maintenance="canPerformMaintenance"
      @maintain="performMaintenance"
    />
  </GPanel>
</template>

<style scoped>
.building-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--g-space-md);
  max-height: 100%;
  overflow-y: auto;
}
</style>
