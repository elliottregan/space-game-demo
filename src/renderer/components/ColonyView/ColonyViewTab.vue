<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import { ColonistDetailPanel, ColonistGraph } from "../ColonistGraph";
import { RecreationPanel } from "../RecreationPanel";
import BuildingSection from "./BuildingSection.vue";
import ColonyStatsBar from "./ColonyStatsBar.vue";
import DistrictSection from "./DistrictSection.vue";

const state = gameService.getState();

const activeBuildings = computed(() =>
  state.buildings.filter((b) => b.status === "active" || b.status === "pending"),
);

// oxlint-disable-next-line no-unused-vars
const researchBuildings = computed(() => {
  return activeBuildings.value.filter((b) => {
    const def = state.buildingDefinitions.find((d) => d.id === b.definitionId);
    return def?.workerRole === "research";
  });
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
      pressure: { solidarity: number; sovereignty: number; transformation: number };
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

    <DistrictSection />

    <RecreationPanel />

    <BuildingSection
      v-if="researchBuildings.length > 0"
      title="Research"
      :buildings="researchBuildings"
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
