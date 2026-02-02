<script setup lang="ts">
import { computed } from "vue";
import { BuildingPurpose } from "../../../core/models/Building";
import type { BuildingDefinition } from "../../../facade";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildableHousingCard from "./BuildableHousingCard.vue";

const props = defineProps<{
  purpose: BuildingPurpose;
}>();

const state = gameService.getState();
const api = gameService.api;

const filteredDefinitions = computed(() => {
  return state.buildingDefinitions.filter((def) => {
    if (def.purpose !== props.purpose) return false;
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

function build(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

function getPendingCount(defId: string): number {
  return state.pendingBuildings.filter((b) => b.definitionId === defId).length;
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
  <div class="buildable-list">
    <BuildableHousingCard
      v-for="def in filteredDefinitions"
      :key="def.id"
      :definition="def"
      :can-build="canBuild(def.id)"
      :build-reason="getBuildReason(def.id)"
      :pending-count="getPendingCount(def.id)"
      @build="build(def.id)"
      @hover="onHover(def)"
      @leave="onLeave"
    />
  </div>
</template>

<style scoped>
.buildable-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
</style>
