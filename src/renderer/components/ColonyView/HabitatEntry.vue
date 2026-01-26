<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GBadge, GProgress } from "../../ui";
import ColonistRow from "./ColonistRow.vue";

const props = defineProps<{
  building: Building;
  definition?: BuildingDefinition;
  residents: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const capacity = computed(() => props.definition?.capacity || 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusVariant = computed(() => {
  if (props.building.broken) return "danger";
  if (props.building.status === "pending") return "warning";
  return "success";
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusLabel = computed(() => {
  if (props.building.broken) return "Broken";
  if (props.building.status === "pending") return "Building";
  return "Active";
});
</script>

<template>
  <div class="habitat-entry" :class="{ broken: building.broken }">
    <div class="habitat-header">
      <div class="habitat-title">
        <span class="habitat-name">{{ definition?.name || building.definitionId }}</span>
        <span class="habitat-id">#{{ building.id.split("_").pop() }}</span>
      </div>
      <div class="habitat-status">
        <GBadge :variant="statusVariant">{{ statusLabel }}</GBadge>
        <span class="condition" v-if="building.status === 'active'">
          {{ Math.round(building.condition) }}%
        </span>
      </div>
    </div>

    <div class="construction-progress" v-if="building.status === 'pending'">
      <GProgress
        :value="building.constructionProgress"
        :max="definition?.constructionTime || 10"
        variant="warning"
        show-label
      />
    </div>

    <div class="residents-header" v-if="building.status === 'active'">
      Residents: {{ residents.length }}/{{ capacity }}
    </div>

    <div class="residents-list" v-if="building.status === 'active' && residents.length > 0">
      <ColonistRow
        v-for="colonist in residents"
        :key="colonist.id"
        :colonist="colonist"
        :skill-definitions="skillDefinitions"
        show-workplace
      />
    </div>

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

.habitat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-sm);
}

.habitat-title {
  display: flex;
  align-items: baseline;
  gap: var(--g-space-sm);
}

.habitat-name {
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.habitat-id {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.habitat-status {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.condition {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.construction-progress {
  margin-bottom: var(--g-space-sm);
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
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.no-residents {
  font-style: italic;
  color: var(--g-color-text-muted);
  padding: var(--g-space-sm) 0;
}
</style>
