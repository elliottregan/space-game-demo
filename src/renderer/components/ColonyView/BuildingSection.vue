<script setup lang="ts">
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GPanel } from "../../ui";
import BuildingEntry from "./BuildingEntry.vue";

defineProps<{
  title: string;
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();
</script>

<template>
  <GPanel :title="title">
    <div class="building-list">
      <BuildingEntry
        v-for="building in buildings"
        :key="building.id"
        :building="building"
        :definition="buildingDefinitions.find((d) => d.id === building.definitionId)"
        :colonists="colonists"
        :skill-definitions="skillDefinitions"
      />
    </div>
  </GPanel>
</template>

<style scoped>
.building-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
