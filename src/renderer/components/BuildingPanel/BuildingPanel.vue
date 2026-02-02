<script setup lang="ts">
import { computed, ref } from "vue";
import { BuildingPurpose } from "../../../core/models/Building";
import type { BuildingDefinition } from "../../../facade";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { GCardGrid, GPanel } from "../../ui";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildingCard from "./BuildingCard.vue";
import CategoryTabs from "./CategoryTabs.vue";
import ConstructionQueue from "./ConstructionQueue.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

const selectedCategory = ref<BuildingPurpose>(BuildingPurpose.Industrial);

// Computed properties use reactive state for proper Vue reactivity
const availableBuildings = computed(() => {
  return state.buildingDefinitions.filter((def) => {
    // Filter out victory buildings
    if (def.isVictoryBuilding) return false;
    if (def.requiredTech) {
      return api.technology.isResearched(def.requiredTech);
    }
    return true;
  });
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const filteredBuildings = computed(() => {
  return availableBuildings.value.filter(
    (def) => (def.purpose || BuildingPurpose.Industrial) === selectedCategory.value,
  );
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const countsByPurpose = computed(() => {
  const counts: Record<BuildingPurpose, number> = {
    [BuildingPurpose.Residential]: 0,
    [BuildingPurpose.Industrial]: 0,
    [BuildingPurpose.Social]: 0,
  };
  for (const def of availableBuildings.value) {
    const purpose = def.purpose || BuildingPurpose.Industrial;
    counts[purpose]++;
  }
  return counts;
});

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
</script>

<template>
  <GPanel title="Buildings" accent="amber">
    <CategoryTabs
      :selected-category="selectedCategory"
      :counts="countsByPurpose"
      @update:selected-category="selectedCategory = $event"
    />

    <GCardGrid class="building-list">
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
    </GCardGrid>

    <ConstructionQueue
      :pending-buildings="pendingBuildings"
      :get-building-name="getBuildingName"
      :get-construction-time="getConstructionTime"
    />
  </GPanel>
</template>

<style scoped>
.building-list {
  max-height: 100%;
  overflow-y: auto;
}
</style>
