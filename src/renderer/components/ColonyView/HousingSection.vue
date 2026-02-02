<script setup lang="ts">
import { computed, ref } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { gameService } from "../../services/GameService";
import { GButton, GEmptyState, GPanel } from "../../ui";
import HousingBuildingCard from "./HousingBuildingCard.vue";
import UnhousedPool from "./UnhousedPool.vue";

const props = defineProps<{
  buildings: Building[];
  housingAssignments: Record<string, Colonist[]>;
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
  unhoused: Colonist[];
}>();

const selectedColonistId = ref<string | null>(null);
const draggingColonistId = ref<string | null>(null);

const availableBeds = computed(() => {
  let total = 0;
  for (const building of props.buildings) {
    if (building.status !== "active") continue;
    const def = props.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.capacity) continue;
    const residents = props.housingAssignments[building.id]?.length || 0;
    total += def.capacity - residents;
  }
  return total;
});

function handleOptimizeHousing() {
  gameService.optimizeHousing();
}

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
    <div class="housing-controls">
      <span class="housing-stat">
        Unhoused: {{ unhoused.length }} | Available beds: {{ availableBeds }}
      </span>
      <GButton
        size="sm"
        :disabled="unhoused.length === 0 || availableBeds === 0"
        @click="handleOptimizeHousing"
      >
        Optimize Housing
      </GButton>
    </div>

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
.housing-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--g-space-md);
  margin-bottom: var(--g-space-md);
  padding: var(--g-space-sm);
  background: rgba(128, 128, 128, 0.1);
  border-radius: var(--g-radius-sm);
}

.housing-stat {
  font-size: 0.85em;
  color: var(--g-color-muted);
}

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
