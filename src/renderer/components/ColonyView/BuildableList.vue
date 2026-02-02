<script setup lang="ts">
import { computed } from "vue";
import { BuildingPurpose } from "../../../core/models/Building";
import type { BuildingDefinition } from "../../../facade";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { GCardGrid } from "../../ui";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildingCard from "../BuildingPanel/BuildingCard.vue";

const props = defineProps<{
  purpose: BuildingPurpose;
}>();

const state = gameService.getState();
const api = gameService.api;

const filteredDefinitions = computed(() => {
  return state.buildingDefinitions.filter((def) => {
    if (def.purpose !== props.purpose) return false;
    // Don't filter by tech - show locked buildings too
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

function build(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

function getBuildingCount(defId: string): number {
  return (
    state.buildings.filter((b) => b.definitionId === defId).length +
    state.pendingBuildings.filter((b) => b.definitionId === defId).length
  );
}

function getPendingCount(defId: string): number {
  return state.pendingBuildings.filter((b) => b.definitionId === defId).length;
}

function isLocked(def: BuildingDefinition): boolean {
  if (!def.requiredTech) return false;
  return !api.technology.isResearched(def.requiredTech);
}

function getRequiredTechName(def: BuildingDefinition): string {
  if (!def.requiredTech) return "";
  const tech = api.technology.getById(def.requiredTech);
  return tech?.name || def.requiredTech;
}

function onHover(def: BuildingDefinition): void {
  const currentResources = api.resources.snapshot().current as Record<string, number>;
  const info = calculateHighlightInfo(def.cost, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

function onLeave(): void {
  clearHighlights();
}
</script>

<template>
  <GCardGrid>
    <BuildingCard
      v-for="def in filteredDefinitions"
      :key="def.id"
      :definition="def"
      :count="getBuildingCount(def.id)"
      :pending-count="getPendingCount(def.id)"
      :locked="isLocked(def)"
      :can-build="canBuild(def.id)"
      :build-reason="getBuildReason(def.id)"
      :required-tech-name="getRequiredTechName(def)"
      @build="build(def.id)"
      @hover="onHover(def)"
      @leave="onLeave"
    />
  </GCardGrid>
</template>
