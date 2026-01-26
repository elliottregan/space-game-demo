<script setup lang="ts">
import { GProgress } from "../../ui";
import type { PendingBuilding } from "../../../facade";

const props = defineProps<{
  pendingBuildings: PendingBuilding[];
  getBuildingName: (definitionId: string) => string;
  getConstructionTime: (definitionId: string) => number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getConstructionPercent(building: PendingBuilding): number {
  const time = props.getConstructionTime(building.definitionId);
  if (!time) return 0;
  return (building.constructionProgress / time) * 100;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getRemainingBuildTime(building: PendingBuilding): number {
  const time = props.getConstructionTime(building.definitionId);
  if (!time) return 0;
  return Math.ceil(time - building.constructionProgress);
}
</script>

<template>
  <div v-if="pendingBuildings.length > 0" class="construction-queue">
    <h3>Under Construction</h3>
    <div
      v-for="building in pendingBuildings"
      :key="building.id"
      class="construction-item"
    >
      <span class="construction-name">
        {{ getBuildingName(building.definitionId) }}
      </span>
      <GProgress
        :percent="getConstructionPercent(building)"
        variant="warning"
        showLabel
      >
        {{ getRemainingBuildTime(building) }} sols
      </GProgress>
    </div>
  </div>
</template>

<style scoped>
.construction-queue {
  margin-top: var(--g-space-lg);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.construction-queue h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-accent-amber);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-sm);
}

.construction-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  margin-bottom: var(--g-space-xs);
}

.construction-name {
  font-size: var(--g-font-size-sm);
  min-width: 120px;
}
</style>
