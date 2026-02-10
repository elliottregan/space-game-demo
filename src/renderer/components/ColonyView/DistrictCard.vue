<script setup lang="ts">
import { computed, ref } from "vue";
import { DISTRICT_BUILDING_SLOTS } from "../../../core/balance/DistrictBalance";
import type { Building, BuildingDefinition } from "../../../facade";
import { computed } from "vue";
import { DISTRICT_GROWTH_TRIGGER } from "../../../core/balance/DistrictBalance";
import { GProgress } from "../../ui";

const props = defineProps<{
  district: {
    id: string;
    name: string;
    foundedAt: number;
    population: number;
    capacity: number;
    buildingCount: number;
    buildingIds: string[];
    growthCap: number | null;
  };
  currentSol: number;
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
}>();

const occupancyPercent = computed(() =>
  props.district.capacity > 0 ? (props.district.population / props.district.capacity) * 100 : 0,
);

const progressVariant = computed(() => {
  if (occupancyPercent.value >= 100) return "negative";
  if (occupancyPercent.value >= DISTRICT_GROWTH_TRIGGER * 100) return "warning";
  return "positive";
});

// oxlint-disable-next-line no-unused-vars
const growthStatus = computed(() => {
  const occupancy =
    props.district.capacity > 0 ? props.district.population / props.district.capacity : 0;
  if (occupancy >= 1) return { label: "At Capacity", variant: "danger" };
  if (props.district.growthCap !== null && props.district.capacity >= props.district.growthCap)
    return { label: "Capped", variant: "muted" };
  if (occupancy >= DISTRICT_GROWTH_TRIGGER) return { label: "Growing", variant: "positive" };
  return { label: "Stable", variant: "muted" };
});

// oxlint-disable-next-line no-unused-vars
const buildingNames = computed(() => {
  const idSet = new Set(props.district.buildingIds);
  const matched = props.buildings.filter((b) => idSet.has(b.id));
  return matched.map((b) => {
    const def = props.buildingDefinitions.find((d) => d.id === b.definitionId);
    return def?.name ?? b.definitionId;
  });
});
</script>

<template>
  <div class="district-card">
    <div class="district-header">
      <span class="district-name">{{ district.name }}</span>
      <span class="district-status" :class="`status--${growthStatus.variant}`">
        {{ growthStatus.label }}
      </span>
    </div>

    <div class="district-pop">
      <span class="pop-label">Population</span>
      <span class="pop-count">{{ district.population }}/{{ district.capacity }}</span>
    </div>
    <GProgress
      :percent="occupancyPercent"
      :variant="progressVariant"
      show-label
      :label="`${Math.round(occupancyPercent)}%`"
    />

    <div class="district-buildings">
      <ul v-if="buildingNames.length > 0" class="building-list">
        <li v-for="(name, i) in buildingNames" :key="i">{{ name }}</li>
      </ul>
      <span v-else class="no-buildings">No buildings</span>
    </div>

    <div class="district-meta">
      <span>Founded: Sol {{ district.foundedAt }}</span>
    </div>
  </div>
</template>

<style scoped>
.district-card {
  padding: var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.district-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.district-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.district-status {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border: 1px solid var(--g-color-border);
}

.status--positive {
  color: var(--g-color-positive);
  border-color: var(--g-color-positive);
}

.status--danger {
  color: var(--g-color-danger);
  border-color: var(--g-color-danger);
}

.status--muted {
  color: var(--g-color-text-muted);
}

.district-pop {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pop-count {
  font-family: var(--g-font-mono);
}

.district-buildings {
  font-size: var(--g-font-size-sm);
}

.building-list {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.4;
  color: var(--g-color-text-muted);
}

.no-buildings {
  color: var(--g-color-text-muted);
  font-style: italic;
}

.district-meta {
  display: flex;
  justify-content: space-between;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}
</style>
