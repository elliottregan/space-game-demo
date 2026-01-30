<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import { ColonistDetailPanel, ColonistGraph } from "../ColonistGraph";
import BuildingSection from "./BuildingSection.vue";
import ColonyStatsBar from "./ColonyStatsBar.vue";
import HousingSection from "./HousingSection.vue";
import UnhousedSection from "./UnhousedSection.vue";

const state = gameService.getState();

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

// Colonist relationship graph state
const selectedColonistId = ref<string | null>(null);

const selectedColonist = computed(() => {
  if (!selectedColonistId.value) return null;
  return state.colonists.find((c) => c.id === selectedColonistId.value) ?? null;
});

// Prepare building info for the graph
const buildingsForGraph = computed(() =>
  state.buildings.map((b) => ({
    id: b.id,
    name: state.buildingDefinitions.find((d) => d.id === b.definitionId)?.name ?? b.id,
    active: b.status === "active",
    assignedWorkers: b.assignedWorkers,
  })),
);
</script>

<template>
  <div class="colony-view">
    <ColonyStatsBar />

    <!-- Colonist Relationships Graph -->
    <GPanel
      v-if="state.colonists.length > 1"
      title="Colonist Relationships"
      class="relationship-panel"
    >
      <div class="graph-container">
        <ColonistGraph
          :colonists="state.colonists"
          :relationships="state.coworkerRelationships"
          :buildings="buildingsForGraph"
          :guilds="state.guilds"
          :selected-colonist-id="selectedColonistId"
          @select="selectedColonistId = $event"
        />
        <ColonistDetailPanel
          v-if="selectedColonist"
          :colonist="selectedColonist"
          :colonists="state.colonists"
          :relationships="state.coworkerRelationships"
          :buildings="buildingsForGraph"
        />
      </div>
    </GPanel>

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

.relationship-panel {
  display: flex;
  flex-direction: column;
}

.relationship-panel :deep(.g-panel__body) {
  flex: 1;
  min-height: 0;
  padding: var(--g-space-sm);
  overflow: hidden;
}

.graph-container {
  display: flex;
  gap: var(--g-space-md);
  height: 100%;
}

.graph-container > :first-child {
  flex: 1;
}

@media (max-width: 768px) {
  .graph-container {
    flex-direction: column;
    height: auto;
  }

  .graph-container > :first-child {
    flex: none;
    height: 250px;
  }
}
</style>
