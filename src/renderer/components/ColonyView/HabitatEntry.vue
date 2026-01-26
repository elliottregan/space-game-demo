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
  padding: 0.75rem;
  background: var(--g-color-bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--g-color-border);
}

.habitat-entry.broken {
  border-color: var(--color-danger);
}

.habitat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.habitat-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.habitat-name {
  font-weight: bold;
}

.habitat-id {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.habitat-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.condition {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.construction-progress {
  margin-bottom: 0.5rem;
}

.residents-header {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--g-color-border);
}

.residents-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.no-residents {
  font-style: italic;
  color: var(--g-color-text-muted);
  padding: 0.5rem 0;
}
</style>
