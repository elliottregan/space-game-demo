<script setup lang="ts">
import type { Colonist, Building, BuildingDefinition, SkillDefinition } from "../../../facade";
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
  padding: 0.5rem;
  background: var(--bg-danger);
  border-radius: 4px;
  margin-bottom: 0.75rem;
  font-size: var(--g-font-size-sm);
  color: var(--color-warning);
}

.unhoused-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
