<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GEntityHeader, GCardGrid } from "../../ui";
import ColonistRow from "./ColonistRow.vue";

const props = defineProps<{
  building: Building;
  definition?: BuildingDefinition;
  residents: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const capacity = computed(() => props.definition?.capacity || 0);

</script>

<template>
  <div class="habitat-entry" :class="{ broken: building.broken }">
    <GEntityHeader
      :name="definition?.name || building.definitionId"
      :instance-id="building.id.split('_').pop() || ''"
      :status="building.status"
      :is-broken="building.broken"
      :condition="building.condition"
      :construction-progress="building.constructionProgress"
      :construction-max="definition?.constructionTime || 10"
    >
      <template #progress-label>
        {{ Math.ceil((definition?.constructionTime || 10) - building.constructionProgress) }} sols
      </template>
    </GEntityHeader>

    <div class="residents-header" v-if="building.status === 'active'">
      Residents: {{ residents.length }}/{{ capacity }}
    </div>

    <GCardGrid v-if="building.status === 'active' && residents.length > 0" class="residents-list">
      <ColonistRow
        v-for="colonist in residents"
        :key="colonist.id"
        :colonist="colonist"
        :skill-definitions="skillDefinitions"
        show-workplace
      />
    </GCardGrid>

    <div
      v-if="building.status === 'active' && residents.length === 0"
      class="no-residents"
    >
      No residents assigned
    </div>
  </div>
</template>

<style scoped>
.habitat-entry {
  padding: var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  font-family: var(--g-font-mono);
}

.habitat-entry.broken {
  border-color: var(--g-color-negative);
}

.residents-header {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
  padding-top: var(--g-space-sm);
  border-top: 1px solid var(--g-color-border);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.residents-list {
  margin-top: var(--g-space-sm);
}

.no-residents {
  font-style: italic;
  color: var(--g-color-text-muted);
  padding: var(--g-space-sm) 0;
}
</style>
