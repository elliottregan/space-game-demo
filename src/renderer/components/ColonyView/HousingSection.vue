<script setup lang="ts">
import { ref } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { gameService } from "../../services/GameService";
import { GEmptyState, GPanel } from "../../ui";
import HousingBuildingCard from "./HousingBuildingCard.vue";
import UnhousedPool from "./UnhousedPool.vue";

defineProps<{
  buildings: Building[];
  housingAssignments: Record<string, Colonist[]>;
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
  unhoused: Colonist[];
}>();

const selectedColonistId = ref<string | null>(null);
const draggingColonistId = ref<string | null>(null);

function getDefinition(
  building: Building,
  definitions: BuildingDefinition[],
): BuildingDefinition | undefined {
  return definitions.find((d) => d.id === building.definitionId);
}

function onSelectColonist(colonistId: string | null) {
  selectedColonistId.value = colonistId;
}

function onDragStart(colonistId: string) {
  draggingColonistId.value = colonistId;
  selectedColonistId.value = colonistId;
}

function onDragEnd() {
  draggingColonistId.value = null;
}

function onAssignToHousing(colonistId: string, buildingId: string) {
  gameService.api.colony.assignToHousing(colonistId, buildingId);
  draggingColonistId.value = null;
  selectedColonistId.value = null;
}

function onUnassignFromHousing(colonistId: string) {
  gameService.api.colony.unassignFromHousing(colonistId);
  draggingColonistId.value = null;
}
</script>

<template>
  <GPanel title="Housing">
    <div class="housing-layout">
      <UnhousedPool
        :colonists="unhoused"
        :skill-definitions="skillDefinitions"
        :selected-colonist-id="selectedColonistId"
        @select="onSelectColonist"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @drop="onUnassignFromHousing"
      />

      <div class="housing-buildings">
        <GEmptyState
          v-if="buildings.length === 0"
          message="No habitats built. Colonists need housing!"
        />
        <HousingBuildingCard
          v-for="building in buildings"
          :key="building.id"
          :building="building"
          :definition="getDefinition(building, buildingDefinitions)!"
          :residents="housingAssignments[building.id] || []"
          :dragging-colonist-id="draggingColonistId"
          @assign="onAssignToHousing"
          @unassign="onUnassignFromHousing"
        />
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.housing-layout {
  display: flex;
  gap: var(--g-space-lg);
}

.housing-buildings {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

@media (max-width: 768px) {
  .housing-layout {
    flex-direction: column;
  }

  .housing-layout > :first-child {
    max-width: none;
  }
}
</style>
