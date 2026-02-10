<script setup lang="ts">
import type { Building, BuildingDefinition } from "../../../facade";
import { computed } from "vue";
import { GCard } from "../../ui";

const props = defineProps<{
  district: {
    id: string;
    name: string;
    buildingCount: number;
    buildingIds: string[];
  };
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
}>();

const districtBuildings = computed(() => {
  const idSet = new Set(props.district.buildingIds);
  return props.buildings.filter((b) => idSet.has(b.id));
});

// oxlint-disable-next-line no-unused-vars
const buildingNames = computed(() =>
  districtBuildings.value.map((b) => {
    const def = props.buildingDefinitions.find((d) => d.id === b.definitionId);
    return def?.name ?? b.definitionId;
  }),
);
</script>

<template>
  <GCard>
    <div class="district-card">
      <div class="district-header">
        <strong>{{ district.name }}</strong>
      </div>
      <ul v-if="buildingNames.length > 0" class="building-list">
        <li v-for="(name, i) in buildingNames" :key="i">{{ name }}</li>
      </ul>
      <div v-else class="empty">No buildings</div>
    </div>
  </GCard>
</template>

<style scoped>
.district-card {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.district-header {
  color: var(--color-info);
}

.building-list {
  margin: 0;
  padding-left: 1.2em;
  font-size: 0.85em;
  line-height: 1.4;
}

.empty {
  color: var(--color-muted);
  font-size: 0.85em;
}
</style>
