<script setup lang="ts">
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GEmptyState, GPanel } from "../../ui";
import HabitatEntry from "./HabitatEntry.vue";

defineProps<{
  buildings: Building[];
  housingAssignments: Record<string, Colonist[]>;
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
}>();
</script>

<template>
  <GPanel title="Housing">
    <div class="housing-list">
      <HabitatEntry
        v-for="building in buildings"
        :key="building.id"
        :building="building"
        :definition="buildingDefinitions.find((d) => d.id === building.definitionId)"
        :residents="housingAssignments[building.id] || []"
        :skill-definitions="skillDefinitions"
      />
      <GEmptyState
        v-if="buildings.length === 0"
        message="No habitats built. Colonists need housing!"
      />
    </div>
  </GPanel>
</template>

<style scoped>
.housing-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
