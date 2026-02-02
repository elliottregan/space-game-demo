<script setup lang="ts">
import { computed, ref } from "vue";
import { BuildingPurpose } from "../../../core/models/Building";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import { ColonistDetailPanel, ColonistGraph } from "../ColonistGraph";
import { RecreationPanel } from "../RecreationPanel";
import BuildableList from "./BuildableList.vue";
import BuildingSection from "./BuildingSection.vue";
import ColonyStatsBar from "./ColonyStatsBar.vue";
import HousingSection from "./HousingSection.vue";

const state = gameService.getState();

const activeBuildings = computed(() =>
  state.buildings.filter((b) => b.status === "active" || b.status === "pending"),
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const buildingsByCategory = computed(() => {
  const categories: Record<string, typeof state.buildings> = {
    housing: [],
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
    }
    // Production and infrastructure buildings are now managed in Operations page
  }

  return categories;
});

// Colonist relationship graph state
const selectedColonistId = ref<string | null>(null);

const selectedColonist = computed(() => {
  if (!selectedColonistId.value) return null;
  return state.colonists.find((c) => c.id === selectedColonistId.value) ?? null;
});

// Get ideological pressure for selected colonist
const selectedColonistPressure = computed(() => {
  if (!selectedColonistId.value) return null;
  return gameService.api.ideology.getIdeologicalPressure(selectedColonistId.value);
});

// Get ideology pressure for all colonists (for graph visualization)
const allIdeologyPressures = computed(() => {
  const pressures = new Map<
    string,
    {
      pressure: { earthLoyalist: number; marsIndependence: number; corporateInterests: number };
      totalWeight: number;
      neighborCount: number;
    }
  >();

  for (const colonist of state.colonists) {
    const pressure = gameService.api.ideology.getIdeologicalPressure(colonist.id);
    if (pressure) {
      pressures.set(colonist.id, {
        pressure: pressure.pressure,
        totalWeight: pressure.totalWeight,
        neighborCount: pressure.neighborCount,
      });
    }
  }

  return pressures;
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
          :ideology-pressures="allIdeologyPressures"
          @select="selectedColonistId = $event"
        />
        <ColonistDetailPanel
          v-if="selectedColonist"
          :key="`${selectedColonist.id}-${state.currentSol}`"
          :colonist="selectedColonist"
          :colonists="state.colonists"
          :relationships="state.coworkerRelationships"
          :buildings="buildingsForGraph"
          :guilds="state.guilds"
          :ideological-pressure="selectedColonistPressure"
        />
      </div>
    </GPanel>

    <GPanel title="Build Housing" accent="amber">
      <BuildableList :purpose="BuildingPurpose.Residential" />
    </GPanel>

    <HousingSection
      :buildings="buildingsByCategory.housing"
      :housing-assignments="state.housingAssignments"
      :building-definitions="state.buildingDefinitions"
      :skill-definitions="state.skillDefinitions"
      :unhoused="state.unhoused"
    />

    <RecreationPanel />

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
