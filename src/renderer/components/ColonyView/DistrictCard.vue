<script setup lang="ts">
import { computed, ref } from "vue";
import { DISTRICT_BUILDING_SLOTS } from "../../../core/balance/DistrictBalance";
import type { Building, BuildingDefinition } from "../../../facade";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { GCard, GCardGrid } from "../../ui";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildingCard from "../BuildingPanel/BuildingCard.vue";

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

const state = gameService.getState();
const api = gameService.api;

const showBuildPanel = ref(false);

const districtBuildings = computed(() => {
  const idSet = new Set(props.district.buildingIds);
  return props.buildings.filter((b) => idSet.has(b.id));
});

// oxlint-disable-next-line no-unused-vars
const slots = computed(() => {
  const result: Array<{ occupied: true; name: string; buildingId: string } | { occupied: false }> =
    [];

  for (const b of districtBuildings.value) {
    const def = props.buildingDefinitions.find((d) => d.id === b.definitionId);
    result.push({ occupied: true, name: def?.name ?? b.definitionId, buildingId: b.id });
  }

  while (result.length < DISTRICT_BUILDING_SLOTS) {
    result.push({ occupied: false });
  }

  return result;
});

// oxlint-disable-next-line no-unused-vars
const slotsFull = computed(() => districtBuildings.value.length >= DISTRICT_BUILDING_SLOTS);

// oxlint-disable-next-line no-unused-vars
const filteredDefinitions = computed(() => {
  return state.buildingDefinitions.filter(() => true);
});

// oxlint-disable-next-line no-unused-vars
function canBuild(defId: string): boolean {
  return api.buildings.canBuild(defId).allowed;
}

// oxlint-disable-next-line no-unused-vars
function getBuildReason(defId: string): string | undefined {
  const check = api.buildings.canBuild(defId);
  return check.allowed ? undefined : check.reason;
}

// oxlint-disable-next-line no-unused-vars
function build(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
    return;
  }
  if (districtBuildings.value.length + 1 >= DISTRICT_BUILDING_SLOTS) {
    showBuildPanel.value = false;
  }
}

// oxlint-disable-next-line no-unused-vars
function getBuildingCount(defId: string): number {
  return (
    state.buildings.filter((b) => b.definitionId === defId).length +
    state.pendingBuildings.filter((b) => b.definitionId === defId).length
  );
}

// oxlint-disable-next-line no-unused-vars
function getPendingCount(defId: string): number {
  return state.pendingBuildings.filter((b) => b.definitionId === defId).length;
}

// oxlint-disable-next-line no-unused-vars
function isLocked(def: BuildingDefinition): boolean {
  if (!def.requiredTech) return false;
  return !api.technology.isResearched(def.requiredTech);
}

// oxlint-disable-next-line no-unused-vars
function getRequiredTechName(def: BuildingDefinition): string {
  if (!def.requiredTech) return "";
  const tech = api.technology.getById(def.requiredTech);
  return tech?.name || def.requiredTech;
}

// oxlint-disable-next-line no-unused-vars
function onHover(def: BuildingDefinition): void {
  const currentResources = api.resources.snapshot().current as Record<string, number>;
  const info = calculateHighlightInfo(def.cost, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

// oxlint-disable-next-line no-unused-vars
function onLeave(): void {
  clearHighlights();
}

// oxlint-disable-next-line no-unused-vars
function toggleBuildPanel(): void {
  showBuildPanel.value = !showBuildPanel.value;
}
</script>

<template>
  <GCard>
    <div class="district-card">
      <div class="district-header">
        <strong>{{ district.name }}</strong>
        <span class="slot-count">
          {{ district.buildingIds.length }}/{{ DISTRICT_BUILDING_SLOTS }}
        </span>
      </div>

      <div class="building-slots">
        <div
          v-for="(slot, i) in slots"
          :key="i"
          class="slot"
          :class="{
            'slot--occupied': slot.occupied,
            'slot--empty': !slot.occupied,
          }"
          @click="!slot.occupied && toggleBuildPanel()"
        >
          <template v-if="slot.occupied">
            {{ slot.name }}
          </template>
          <template v-else> + </template>
        </div>
      </div>

      <div v-if="showBuildPanel && !slotsFull" class="build-panel">
        <GCardGrid>
          <BuildingCard
            v-for="def in filteredDefinitions"
            :key="def.id"
            :definition="def"
            :count="getBuildingCount(def.id)"
            :pending-count="getPendingCount(def.id)"
            :locked="isLocked(def)"
            :can-build="canBuild(def.id)"
            :build-reason="getBuildReason(def.id)"
            :required-tech-name="getRequiredTechName(def)"
            @build="build(def.id)"
            @hover="onHover(def)"
            @leave="onLeave"
          />
        </GCardGrid>
      </div>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-info);
}

.slot-count {
  font-family: var(--g-font-mono, monospace);
  font-size: 0.8em;
  color: var(--color-muted);
}

.building-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.slot {
  width: 80px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  border-radius: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot--occupied {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--g-color-text, #ccc);
  padding: 0 4px;
}

.slot--empty {
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: var(--color-muted);
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
}

.slot--empty:hover {
  border-color: var(--color-info);
  color: var(--color-info);
  background: rgba(255, 255, 255, 0.03);
}

.build-panel {
  padding-top: var(--g-space-sm);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
