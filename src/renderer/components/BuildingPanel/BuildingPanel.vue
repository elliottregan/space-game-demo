<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import type { BuildingDefinition } from "../../../facade";
import { highlightResources, clearHighlights } from "../../directives/ResourceHighlight";
import { GPanel } from "../../ui";
import CategoryTabs from "./CategoryTabs.vue";
import BuildingCard from "./BuildingCard.vue";
import ConstructionQueue from "./ConstructionQueue.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

const selectedCategory = ref<"all" | "available" | "built">("available");

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
  const allResources = new Set<string>();
  const deltas: Record<string, number> = {};

  for (const [key, value] of Object.entries(def.cost)) {
    if (value > 0) {
      allResources.add(key);
      deltas[key] = -value;
    }
  }

  const requiredResources = Array.from(allResources);
  const currentResources = api.resources.snapshot().current;

  const insufficientResources = Object.keys(def.cost).filter((key) => {
    const required = (def.cost as Record<string, number>)[key] || 0;
    const available = (currentResources as Record<string, number>)[key] || 0;
    return available < required;
  });

  highlightResources(requiredResources, insufficientResources, deltas);
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
  <GPanel title="Buildings">
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
