<script setup lang="ts">
import { computed, ref } from "vue";
import { X, Recycle, Flag } from "lucide-vue-next";
import IdeologyRadar from "../IdeologyRadar/IdeologyRadar.vue";
import {
  DISTRICT_BUILDING_SLOTS,
  DISTRICT_GROWTH_TRIGGER,
} from "../../../core/balance/DistrictBalance";
import { ColonistRole, ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import { AXIS_HEX_COLORS, type AxisId } from "../../utils/ideologyDisplay";
import { BuildingPurpose } from "../../../core/models/Building";
import type { Building, BuildingDefinition } from "../../../facade";
import type { NPCFaction } from "../../../core/models/NPCInfluence";
import type { ResourceDelta } from "../../../core/models/Resources";
import { clearHighlights, highlightResources } from "../../directives/ResourceHighlight";
import { gameService } from "../../services/GameService";
import { GBadge, GButton, GCardGrid, GProgress, GSelect, GTabGroup } from "../../ui";
import type { Tab } from "../../ui";
import { calculateHighlightInfo } from "../../utils/formatters";
import BuildingCard from "../BuildingPanel/BuildingCard.vue";

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
    resourceProduction: Record<string, number>;
    resourceConsumption: Record<string, number>;
    power: { production: number; consumption: number; balance: number };
    workforce: { employed: number; idle: number; byRole: Record<string, number> };
    ideology: Record<string, number>;
    ideologyAxes: { solidarity: number; sovereignty: number; transformation: number };
  };
  currentSol: number;
  buildings: Building[];
  buildingDefinitions: BuildingDefinition[];
}>();

const state = gameService.getState();
const api = gameService.api;

const showBuildPanel = ref(false);
const selectedSlotId = ref<string | null>(null);
const buildCategory = ref<string>("all");

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
const resourceFlows = computed(() => {
  const flows: Array<{ key: string; label: string; net: number }> = [];
  const allKeys = new Set([
    ...Object.keys(props.district.resourceProduction),
    ...Object.keys(props.district.resourceConsumption),
  ]);
  for (const key of allKeys) {
    const prod = props.district.resourceProduction[key] ?? 0;
    const cons = props.district.resourceConsumption[key] ?? 0;
    const net = prod - cons;
    if (net !== 0) {
      flows.push({ key, label: key.charAt(0).toUpperCase() + key.slice(1), net });
    }
  }
  return flows;
});

// oxlint-disable-next-line no-unused-vars
const hasPower = computed(
  () => props.district.power.production > 0 || props.district.power.consumption > 0,
);

// oxlint-disable-next-line no-unused-vars
const roleEntries = computed(() => {
  const entries: Array<{ label: string; count: number }> = [];
  for (const [role, count] of Object.entries(props.district.workforce.byRole)) {
    const displayName = ROLE_DISPLAY_NAMES[role as ColonistRole] ?? role;
    entries.push({ label: displayName, count });
  }
  return entries;
});

const AXIS_DISPLAY_NAMES: Record<string, string> = {
  solidarity: "Solidarity",
  sovereignty: "Sovereignty",
  transformation: "Transformation",
  neutral: "Neutral",
};

// oxlint-disable-next-line no-unused-vars
const axisEntries = computed(() => {
  const entries: Array<{ id: string; label: string; count: number; color: string }> = [];
  for (const [axis, count] of Object.entries(props.district.ideology)) {
    if (count > 0) {
      entries.push({
        id: axis,
        label: AXIS_DISPLAY_NAMES[axis] ?? axis,
        count,
        color: AXIS_HEX_COLORS[axis as AxisId] ?? "var(--g-color-text-muted)",
      });
    }
  }
  return entries;
});

const hasIdeologyValues = computed(() => {
  const { solidarity, sovereignty, transformation } = props.district.ideologyAxes;
  return solidarity !== 0 || sovereignty !== 0 || transformation !== 0;
});

// oxlint-disable-next-line no-unused-vars
function formatNet(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

const districtBuildings = computed(() => {
  const idSet = new Set(props.district.buildingIds);
  return props.buildings.filter((b) => idSet.has(b.id));
});

type OccupiedSlot = {
  occupied: true;
  name: string;
  buildingId: string;
  status: string;
  definitionId: string;
  sponsorBaseId?: string;
};
type EmptySlot = { occupied: false };

// oxlint-disable-next-line no-unused-vars
const slots = computed<Array<OccupiedSlot | EmptySlot>>(() => {
  const result: Array<OccupiedSlot | EmptySlot> = [];

  for (const b of districtBuildings.value) {
    const def = props.buildingDefinitions.find((d) => d.id === b.definitionId);
    result.push({
      occupied: true,
      name: def?.name ?? b.definitionId,
      buildingId: b.id,
      status: b.status,
      definitionId: b.definitionId,
      sponsorBaseId: b.sponsorFactionBaseId,
    });
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
  return state.buildingDefinitions.filter((def) => {
    if (def.isVictoryBuilding) return false;
    if (buildCategory.value === "all") return true;
    return def.purpose === buildCategory.value;
  });
});

// oxlint-disable-next-line no-unused-vars
const categoryTabs = computed<Tab[]>(() => {
  const defs = state.buildingDefinitions.filter((d) => !d.isVictoryBuilding);
  const industrialCount = defs.filter((d) => d.purpose === BuildingPurpose.Industrial).length;
  const socialCount = defs.filter((d) => d.purpose === BuildingPurpose.Social).length;
  return [
    { id: "all", label: "All", badge: defs.length },
    { id: BuildingPurpose.Industrial, label: "Industrial", badge: industrialCount },
    { id: BuildingPurpose.Social, label: "Social", badge: socialCount },
  ];
});

// oxlint-disable-next-line no-unused-vars
const selectedBuilding = computed(() => {
  if (!selectedSlotId.value) return null;
  const building = props.buildings.find((b) => b.id === selectedSlotId.value);
  if (!building) return null;
  const def = props.buildingDefinitions.find((d) => d.id === building.definitionId);
  if (!def) return null;
  return { building, definition: def };
});

// oxlint-disable-next-line no-unused-vars
const selectedRecycleValue = computed<ResourceDelta | undefined>(() => {
  if (!selectedSlotId.value) return undefined;
  return api.buildings.getRecycleValue(selectedSlotId.value);
});

// oxlint-disable-next-line no-unused-vars
const canRecycleSelected = computed(() => {
  if (!selectedSlotId.value) return false;
  return api.buildings.canRecycle(selectedSlotId.value).allowed;
});

const FACTION_COLORS: Record<string, string> = {
  earth_loyalists: "var(--color-info)",
  mars_independence: "var(--color-positive)",
  corporate_interests: "var(--color-warning)",
};

// oxlint-disable-next-line no-unused-vars
const sponsorOptions = computed(() => {
  const none = { value: "", label: "No Sponsor" };
  const factionOpts = state.ideology.factions.map((f) => ({
    value: f.baseId,
    label: f.name,
  }));
  return [none, ...factionOpts];
});

// oxlint-disable-next-line no-unused-vars
const selectedSponsor = computed(() => {
  if (!selectedSlotId.value) return "";
  const building = props.buildings.find((b) => b.id === selectedSlotId.value);
  return building?.sponsorFactionBaseId ?? "";
});

// oxlint-disable-next-line no-unused-vars
const selectedSponsorName = computed(() => {
  const baseId = selectedSponsor.value;
  if (!baseId) return null;
  const faction = state.ideology.factions.find((f) => f.baseId === baseId);
  return faction?.name ?? null;
});

// oxlint-disable-next-line no-unused-vars
const selectedSponsorColor = computed(() => {
  const baseId = selectedSponsor.value;
  return baseId ? (FACTION_COLORS[baseId] ?? "var(--g-color-text-muted)") : "";
});

// oxlint-disable-next-line no-unused-vars
const canSponsorSelected = computed(() => {
  if (!selectedBuilding.value) return false;
  return selectedBuilding.value.building.status === "active";
});

// oxlint-disable-next-line no-unused-vars
function setSponsor(value: string | number): void {
  if (!selectedSlotId.value) return;
  if (value === "" || value === undefined) {
    api.buildings.unsponsorBuilding(selectedSlotId.value);
  } else {
    api.buildings.sponsorBuilding(selectedSlotId.value, value as NPCFaction);
  }
}

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
  const result = api.buildings.build(defId, props.district.id);
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
  selectedSlotId.value = null;
  buildCategory.value = "all";
}

// oxlint-disable-next-line no-unused-vars
function closeBuildPanel(): void {
  showBuildPanel.value = false;
}

// oxlint-disable-next-line no-unused-vars
function selectSlot(buildingId: string): void {
  selectedSlotId.value = selectedSlotId.value === buildingId ? null : buildingId;
  showBuildPanel.value = false;
}

// oxlint-disable-next-line no-unused-vars
function recycleSelected(): void {
  if (!selectedSlotId.value) return;
  api.buildings.recycle(selectedSlotId.value);
  selectedSlotId.value = null;
}

// oxlint-disable-next-line no-unused-vars
function getSlotTitle(slot: OccupiedSlot): string {
  return `${slot.name} (${slot.status})`;
}

// oxlint-disable-next-line no-unused-vars
function formatRecycleValue(delta: ResourceDelta): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(delta)) {
    if (value && value > 0) {
      parts.push(`+${value} ${key}`);
    }
  }
  return parts.join(", ");
}

// --- Tab state ---
const activeTab = ref<string>("buildings");

// oxlint-disable-next-line no-unused-vars
const mainTabs = computed<Tab[]>(() => [
  { id: "buildings", label: "Buildings" },
  { id: "grants", label: "Grants" },
]);

// --- Grants ---
// oxlint-disable-next-line no-unused-vars
const availableGrants = computed(() => state.grants.available);

// oxlint-disable-next-line no-unused-vars
const activeGrants = computed(() =>
  state.grants.active.filter((g) => g.districtId === props.district.id),
);

// oxlint-disable-next-line no-unused-vars
function canAssignGrant(grantId: number): boolean {
  return api.grants.canAssignGrant(grantId, props.district.id).canAssign;
}

// oxlint-disable-next-line no-unused-vars
function assignGrant(grantId: number): void {
  api.grants.assignGrant(grantId, props.district.id);
}

// oxlint-disable-next-line no-unused-vars
function refreshGrants(): void {
  api.grants.refreshPanel();
}

// oxlint-disable-next-line no-unused-vars
function formatGrantCost(cost: { food?: number; water?: number; materials?: number }): string {
  const parts = Object.entries(cost)
    .filter(([, v]) => v && v > 0)
    .map(([k, v]) => `${v} ${k}`);
  return parts.length ? parts.join(", ") : "Free";
}

// oxlint-disable-next-line no-unused-vars
function grantProgress(grant: (typeof state.grants.active)[number]): number {
  if (!grant.totalDuration || grant.totalDuration === 0) return 100;
  return Math.round(((grant.totalDuration - grant.remainingSols) / grant.totalDuration) * 100);
}
</script>

<template>
  <div class="district-card">
    <div class="district-header">
      <span class="district-name">
        {{ district.name }}
      </span>
      <span class="district-status" :class="`status--${growthStatus.variant}`">
        {{ growthStatus.label }}
      </span>
    </div>
    <span class="founded-date">Sol {{ district.foundedAt }}</span>

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

    <div v-if="resourceFlows.length > 0" class="district-section">
      <span class="section-label">Resources</span>
      <div class="resource-flows">
        <span
          v-for="flow in resourceFlows"
          :key="flow.key"
          class="resource-flow"
          :class="flow.net > 0 ? 'flow--positive' : 'flow--negative'"
        >
          {{ flow.label }} {{ formatNet(flow.net) }}
        </span>
      </div>
    </div>

    <div v-if="hasPower" class="district-section">
      <span class="section-label">Power</span>
      <span
        class="power-value"
        :class="district.power.balance >= 0 ? 'flow--positive' : 'flow--negative'"
      >
        {{ formatNet(district.power.balance) }} kW
      </span>
      <span class="power-detail"
        >(+{{ district.power.production }} / -{{ district.power.consumption }})</span
      >
    </div>

    <div v-if="district.population > 0" class="district-section">
      <span class="section-label">Workforce</span>
      <span class="workforce-summary">
        {{ district.workforce.employed }} working / {{ district.workforce.idle }} idle
      </span>
      <div v-if="roleEntries.length > 0" class="role-badges">
        <span v-for="entry in roleEntries" :key="entry.label" class="role-badge">
          {{ entry.label }}: {{ entry.count }}
        </span>
      </div>
    </div>

    <div v-if="axisEntries.length > 0 || hasIdeologyValues" class="district-section">
      <span class="section-label">Ideology</span>
      <div v-if="axisEntries.length > 0" class="faction-badges">
        <span
          v-for="entry in axisEntries"
          :key="entry.id"
          class="faction-badge"
          :style="{ borderColor: entry.color, color: entry.color }"
        >
          {{ entry.label }}: {{ entry.count }}
        </span>
      </div>
      <div v-if="hasIdeologyValues" class="ideology-radar-container">
        <IdeologyRadar :values="district.ideologyAxes" :size="240" show-labels />
      </div>
    </div>

    <GTabGroup v-model="activeTab" :tabs="mainTabs" />

    <div v-if="activeTab === 'buildings'" class="district-buildings">
      <div class="buildings-header">
        <span class="buildings-label">Buildings</span>
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
            'slot--selected': slot.occupied && slot.buildingId === selectedSlotId,
            'slot--pending': slot.occupied && slot.status === 'pending',
            'slot--recycling': slot.occupied && slot.status === 'recycling',
          }"
          :title="slot.occupied ? getSlotTitle(slot) : undefined"
          :style="
            slot.occupied && slot.sponsorBaseId
              ? { borderLeftColor: FACTION_COLORS[slot.sponsorBaseId], borderLeftWidth: '3px' }
              : undefined
          "
          @click="slot.occupied && selectSlot(slot.buildingId)"
        >
          <template v-if="slot.occupied">
            {{ slot.name }}
          </template>
          <template v-else> + </template>
        </div>
      </div>

      <GButton v-if="!slotsFull" size="sm" variant="ghost" @click="toggleBuildPanel()">
        {{ showBuildPanel ? "Cancel" : "Build" }}
      </GButton>

      <div v-if="selectedBuilding" class="selected-detail">
        <div class="selected-info">
          <span class="selected-name">{{ selectedBuilding.definition.name }}</span>
          <span class="selected-status" :class="`status--${selectedBuilding.building.status}`">
            {{ selectedBuilding.building.status }}
          </span>
          <span
            v-if="selectedSponsorName"
            class="sponsor-badge"
            :style="{ borderColor: selectedSponsorColor, color: selectedSponsorColor }"
          >
            <Flag :size="10" />
            {{ selectedSponsorName }}
          </span>
        </div>
        <div class="selected-actions">
          <GSelect
            v-if="canSponsorSelected"
            :model-value="selectedSponsor"
            :options="sponsorOptions"
            size="sm"
            variant="ghost"
            @update:model-value="setSponsor"
          />
          <span v-if="selectedRecycleValue" class="recycle-value">
            {{ formatRecycleValue(selectedRecycleValue) }}
          </span>
          <GButton
            size="sm"
            variant="danger"
            :disabled="!canRecycleSelected"
            @click="recycleSelected()"
          >
            <Recycle :size="14" />
            Recycle
          </GButton>
        </div>
      </div>

      <div v-if="showBuildPanel && !slotsFull" class="build-panel">
        <div class="build-panel-header">
          <span class="build-panel-title">Build in {{ district.name }}</span>
          <button class="build-panel-close" @click="closeBuildPanel()">
            <X :size="16" />
          </button>
        </div>
        <GTabGroup v-model="buildCategory" :tabs="categoryTabs" />
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

    <div v-if="activeTab === 'grants'" class="district-grants">
      <div class="grants-section">
        <span class="section-label">Available Grants</span>
        <div v-if="availableGrants.length === 0" class="grants-empty">
          No grants available. Wait for the next refresh or spend materials to refresh now.
        </div>
        <div v-else class="grants-list">
          <div
            v-for="grant in availableGrants"
            :key="grant.id"
            class="grant-card"
            :class="{ 'grant-disabled': !canAssignGrant(grant.id) }"
          >
            <div class="grant-header">
              <span class="grant-name">{{ grant.name }}</span>
              <div class="grant-badges">
                <GBadge :variant="grant.category === 'identity' ? 'warning' : 'info'" size="sm">
                  {{ grant.category === "identity" ? "Identity" : "Infrastructure" }}
                </GBadge>
                <GBadge v-if="grant.isCapstone" variant="positive" size="sm"> Capstone </GBadge>
              </div>
            </div>
            <p v-if="grant.sourceName" class="grant-source">{{ grant.sourceName }}</p>
            <p class="grant-description">{{ grant.description }}</p>
            <div class="grant-meta">
              <span class="grant-cost">Cost: {{ formatGrantCost(grant.cost) }}</span>
              <span class="grant-duration">{{ grant.baseDuration }} sols</span>
            </div>
            <div class="grant-actions">
              <GButton
                size="sm"
                :disabled="!canAssignGrant(grant.id)"
                @click="assignGrant(grant.id)"
              >
                Assign
              </GButton>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeGrants.length > 0" class="grants-section">
        <span class="section-label">Active Grants</span>
        <div v-for="grant in activeGrants" :key="grant.id" class="active-grant">
          <div class="active-grant-header">
            <span class="active-grant-name">{{ grant.name }}</span>
            <span class="active-grant-remaining">{{ grant.remainingSols }} sols left</span>
          </div>
          <GProgress
            :percent="grantProgress(grant)"
            variant="positive"
            show-label
            :label="`${grantProgress(grant)}%`"
          />
        </div>
      </div>

      <div class="grants-footer">
        <GButton size="sm" variant="ghost" @click="refreshGrants()"> Refresh Grants </GButton>
      </div>
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

.founded-date {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: calc(-1 * var(--g-space-xs));
}

.district-section {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-size: var(--g-font-size-sm);
}

.section-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text-muted);
  width: 100%;
}

.resource-flows {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.resource-flow {
  white-space: nowrap;
}

.flow--positive {
  color: var(--g-color-positive);
}

.flow--negative {
  color: var(--g-color-danger);
}

.power-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
}

.power-detail {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.workforce-summary {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.role-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
}

.role-badge {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  padding: 1px 5px;
  border: 1px solid var(--g-color-border);
  border-radius: 2px;
  white-space: nowrap;
}

.faction-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
}

.faction-badge {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  padding: 1px 5px;
  border: 1px solid;
  border-radius: 2px;
  white-space: nowrap;
}

.ideology-radar-container {
  width: 240px;
  margin: 0 auto;
}

.district-buildings {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.buildings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slot-count {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
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
  cursor: pointer;
}

.slot--occupied:hover {
  border-color: var(--g-color-info);
  background: rgba(255, 255, 255, 0.12);
}

.slot--empty {
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: var(--g-color-text-muted);
  font-size: 1em;
  font-weight: bold;
}

.slot--selected {
  border-color: var(--g-color-info);
  box-shadow: 0 0 6px rgba(var(--g-color-info-rgb, 100, 180, 255), 0.3);
}

.slot--pending {
  border: 1px dashed var(--g-color-warning);
  animation: pulse-pending 2s ease-in-out infinite;
}

.slot--recycling {
  opacity: 0.5;
  border-color: var(--g-color-danger);
  animation: fade-recycling 1.5s ease-in-out infinite;
}

@keyframes pulse-pending {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes fade-recycling {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.3;
  }
}

.selected-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  gap: var(--g-space-sm);
}

.selected-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  min-width: 0;
}

.selected-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selected-status {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  padding: 1px 4px;
  border: 1px solid var(--g-color-border);
  white-space: nowrap;
}

.status--active {
  color: var(--g-color-positive);
  border-color: var(--g-color-positive);
}

.status--pending {
  color: var(--g-color-warning);
  border-color: var(--g-color-warning);
}

.status--recycling {
  color: var(--g-color-danger);
  border-color: var(--g-color-danger);
}

.status--disabled,
.status--idle {
  color: var(--g-color-text-muted);
}

.sponsor-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  padding: 1px 5px;
  border: 1px solid;
  border-radius: 2px;
  white-space: nowrap;
}

.selected-actions {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  flex-shrink: 0;
}

.recycle-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-positive);
  white-space: nowrap;
}

.build-panel {
  padding-top: var(--g-space-sm);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.build-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-sm);
}

.build-panel-title {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text-muted);
}

.build-panel-close {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--g-color-text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.build-panel-close:hover {
  color: var(--g-color-text);
  border-color: var(--g-color-text-muted);
}

.district-grants {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.grants-section {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.grants-empty {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  padding: var(--g-space-sm) 0;
}

.grants-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.grant-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-left: 3px solid var(--g-color-border);
}

.grant-card.grant-disabled {
  opacity: 0.5;
}

.grant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-xs);
}

.grant-badges {
  display: flex;
  gap: var(--g-space-xs);
}

.grant-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  color: var(--g-color-text);
}

.grant-source {
  margin: 0 0 var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-style: italic;
}

.grant-description {
  margin: 0 0 var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.grant-meta {
  display: flex;
  justify-content: space-between;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.grant-actions {
  display: flex;
  justify-content: flex-end;
}

.active-grant {
  padding: var(--g-space-xs) 0;
}

.active-grant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.active-grant-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text);
}

.active-grant-remaining {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.grants-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
