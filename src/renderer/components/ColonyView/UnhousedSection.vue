<script setup lang="ts">
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GPanel } from "../../ui";
import ColonistRow from "./ColonistRow.vue";

defineProps<{
  colonists: Colonist[];
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  skillDefinitions: SkillDefinition[];
}>();
</script>

<template>
  <GPanel title="Unhoused" variant="danger">
    <div class="warning-message">
      These colonists have no housing assignment. Build more habitats!
    </div>
    <div class="unhoused-list">
      <ColonistRow
        v-for="colonist in colonists"
        :key="colonist.id"
        :colonist="colonist"
        :skill-definitions="skillDefinitions"
        show-workplace
      />
    </div>
  </GPanel>
</template>

<style scoped>
.warning-message {
  padding: var(--g-space-sm);
  background: rgba(198, 40, 40, 0.2);
  margin-bottom: var(--g-space-md);
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  color: var(--g-color-warning);
}

.unhoused-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
