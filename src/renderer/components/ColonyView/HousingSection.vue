<script setup lang="ts">
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GPanel } from "../../ui";
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
      <div v-if="buildings.length === 0" class="no-housing">
        No habitats built. Colonists need housing!
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.housing-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-housing {
  padding: 1rem;
  text-align: center;
  color: var(--color-warning);
  font-style: italic;
}
</style>
