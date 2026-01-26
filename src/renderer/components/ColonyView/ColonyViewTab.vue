<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../../services/GameService";
import ColonyStatsBar from "./ColonyStatsBar.vue";
import BuildingSection from "./BuildingSection.vue";
import HousingSection from "./HousingSection.vue";
import UnhousedSection from "./UnhousedSection.vue";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeBuildings = computed(() =>
  state.buildings.filter((b) => b.status === "active" || b.status === "pending"),
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const buildingsByCategory = computed(() => {
  const categories: Record<string, typeof state.buildings> = {
    housing: [],
    production: [],
    infrastructure: [],
    recreation: [],
    research: [],
  };

  for (const building of activeBuildings.value) {
    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def) continue;

    if (def.capacity) {
      categories.housing.push(building);
    } else if (def.moraleBoost) {
      categories.recreation.push(building);
    } else if (def.workerRole === "research") {
      categories.research.push(building);
    } else if (def.production?.food || def.production?.water || def.production?.oxygen) {
      categories.production.push(building);
    } else {
      categories.infrastructure.push(building);
    }
  }

  return categories;
});
</script>

<template>
  <div class="colony-view">
    <ColonyStatsBar />

    <HousingSection
      :buildings="buildingsByCategory.housing"
      :housing-assignments="state.housingAssignments"
      :building-definitions="state.buildingDefinitions"
      :skill-definitions="state.skillDefinitions"
    />

    <UnhousedSection
      v-if="state.unhoused.length > 0"
      :colonists="state.unhoused"
      :buildings="state.buildings"
      :building-definitions="state.buildingDefinitions"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.production.length > 0"
      title="Production"
      :buildings="buildingsByCategory.production"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.infrastructure.length > 0"
      title="Infrastructure"
      :buildings="buildingsByCategory.infrastructure"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.recreation.length > 0"
      title="Recreation"
      :buildings="buildingsByCategory.recreation"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />

    <BuildingSection
      v-if="buildingsByCategory.research.length > 0"
      title="Research"
      :buildings="buildingsByCategory.research"
      :building-definitions="state.buildingDefinitions"
      :colonists="state.colonists"
      :skill-definitions="state.skillDefinitions"
    />
  </div>
</template>

<style scoped>
.colony-view {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
