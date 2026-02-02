<script setup lang="ts">
import { computed } from "vue";
import {
  type Colonist,
  type ColonistIdeology,
  ColonistRole,
  MASTERY_DISPLAY_NAMES,
  ROLE_DISPLAY_NAMES,
} from "../../../core/models/Colonist";
import type { CoworkerRelationship } from "../../../core/systems/WorkforceManager";

interface BuildingInfo {
  id: string;
  name: string;
  active: boolean;
  assignedWorkers: string[];
}

interface Props {
  colonist: Colonist;
  colonists: Colonist[];
  relationships: Map<string, CoworkerRelationship>;
  buildings: BuildingInfo[];
}

const props = defineProps<Props>();

// Get colonist's building assignment
const buildingAssignment = computed(() => {
  for (const building of props.buildings) {
    if (building.assignedWorkers.includes(props.colonist.id)) {
      return building;
    }
  }
  return null;
});

// Get colonist's housing
const housingInfo = computed(() => {
  if (!props.colonist.housingId) return null;
  // Find housing building name from buildings list
  const housing = props.buildings.find((b) => b.id === props.colonist.housingId);
  return housing ? housing.name : props.colonist.housingId;
});

// Get coworkers (same building)
const coworkers = computed(() => {
  if (!buildingAssignment.value) return [];
  return props.colonists.filter(
    (c) => c.id !== props.colonist.id && buildingAssignment.value!.assignedWorkers.includes(c.id),
  );
});

// Get housemates (same housing)
const housemates = computed(() => {
  if (!props.colonist.housingId) return [];
  return props.colonists.filter(
    (c) => c.id !== props.colonist.id && c.housingId === props.colonist.housingId,
  );
});

// Get all relationships for this colonist
const colonistRelationships = computed(() => {
  const results: {
    colonist: Colonist;
    strength: number;
    isCoworker: boolean;
    isHousemate: boolean;
  }[] = [];

  for (const [key, rel] of props.relationships) {
    const [id1, id2] = key.split(":");
    let otherId: string | undefined;

    if (id1 === props.colonist.id) {
      otherId = id2;
    } else if (id2 === props.colonist.id) {
      otherId = id1;
    }

    if (otherId) {
      const other = props.colonists.find((c) => c.id === otherId);
      if (other) {
        const isCoworker = coworkers.value.some((c) => c.id === otherId);
        const isHousemate = housemates.value.some((c) => c.id === otherId);
        results.push({
          colonist: other,
          strength: rel.strength,
          isCoworker,
          isHousemate,
        });
      }
    }
  }

  return results.sort((a, b) => b.strength - a.strength);
});

function getRoleClass(role: ColonistRole): string {
  return role.toLowerCase().replace("_", "-");
}

function formatStrength(strength: number): string {
  return (strength * 100).toFixed(0) + "%";
}

// Ideology display data
interface IdeologyDisplay {
  label: string;
  value: number;
  cssClass: string;
}

const ideologyData = computed<IdeologyDisplay[]>(() => {
  const ideology = props.colonist.ideology;
  if (!ideology) return [];

  return [
    { label: "Earth", value: ideology.earthLoyalist, cssClass: "earth" },
    { label: "Mars", value: ideology.marsIndependence, cssClass: "mars" },
    { label: "Corporate", value: ideology.corporateInterests, cssClass: "corporate" },
  ];
});

const convictionLevel = computed(() => {
  return props.colonist.ideology?.conviction ?? 0;
});
</script>

<template>
  <div class="detail-panel">
    <div class="panel-header">
      <h3 class="colonist-name">{{ colonist.name }}</h3>
      <span :class="['role-badge', getRoleClass(colonist.role)]">
        {{ ROLE_DISPLAY_NAMES[colonist.role] }}
      </span>
    </div>

    <div class="panel-section">
      <div class="stat-row">
        <span class="stat-label">Mastery</span>
        <span class="stat-value">{{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Experience</span>
        <span class="stat-value">{{ colonist.experience.toFixed(1) }} XP</span>
      </div>
    </div>

    <div v-if="colonist.ideology" class="panel-section">
      <div class="section-title">Ideology</div>
      <div class="ideology-list">
        <div v-for="ideo in ideologyData" :key="ideo.label" class="ideology-row">
          <span class="ideology-label">{{ ideo.label }}</span>
          <div class="ideology-bar-container">
            <div class="ideology-bar-bg">
              <div
                :class="['ideology-bar', ideo.cssClass]"
                :style="{ width: ideo.value * 100 + '%' }"
              />
            </div>
            <span class="ideology-value">{{ formatStrength(ideo.value) }}</span>
          </div>
        </div>
        <div class="ideology-row conviction-row">
          <span class="ideology-label">Conviction</span>
          <div class="ideology-bar-container">
            <div class="ideology-bar-bg">
              <div
                class="ideology-bar conviction"
                :style="{ width: convictionLevel * 100 + '%' }"
              />
            </div>
            <span class="ideology-value">{{ formatStrength(convictionLevel) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="buildingAssignment" class="panel-section">
      <div class="section-title">Workplace</div>
      <div class="assignment-info">
        <span class="building-name">{{ buildingAssignment.name }}</span>
        <span v-if="!buildingAssignment.active" class="inactive-badge">Inactive</span>
      </div>
      <div v-if="coworkers.length > 0" class="coworkers-list">
        <span class="list-label">Coworkers:</span>
        <span
          v-for="cw in coworkers"
          :key="cw.id"
          :class="['coworker-name', getRoleClass(cw.role)]"
        >
          {{ cw.name.split(" ").pop() }}
        </span>
      </div>
    </div>

    <div v-if="housingInfo" class="panel-section">
      <div class="section-title">Housing</div>
      <div class="assignment-info">
        <span class="building-name">{{ housingInfo }}</span>
      </div>
      <div v-if="housemates.length > 0" class="housemates-list">
        <span class="list-label">Housemates:</span>
        <span
          v-for="hm in housemates"
          :key="hm.id"
          :class="['housemate-name', getRoleClass(hm.role)]"
        >
          {{ hm.name.split(" ").pop() }}
        </span>
      </div>
    </div>

    <div v-if="colonistRelationships.length > 0" class="panel-section">
      <div class="section-title">Relationships</div>
      <div class="relationships-list">
        <div v-for="rel in colonistRelationships" :key="rel.colonist.id" class="relationship-row">
          <div class="rel-info">
            <span :class="['rel-name', getRoleClass(rel.colonist.role)]">
              {{ rel.colonist.name.split(" ").pop() }}
            </span>
            <div class="rel-badges">
              <span v-if="rel.isCoworker" class="rel-badge coworker">CW</span>
              <span v-if="rel.isHousemate" class="rel-badge housemate">HM</span>
            </div>
          </div>
          <div class="rel-strength">
            <div class="strength-bar-bg">
              <div
                class="strength-bar"
                :style="{ width: rel.strength * 100 + '%' }"
                :class="{ strong: rel.strength > 0.5 }"
              />
            </div>
            <span class="strength-value">{{ formatStrength(rel.strength) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-panel {
  width: 240px;
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border: var(--g-border-width) solid var(--g-color-border);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  font-size: var(--g-font-size-sm);
  max-height: 100%;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  padding-bottom: var(--g-space-sm);
  border-bottom: var(--g-border-width) solid var(--g-color-border);
}

.colonist-name {
  margin: 0;
  font-size: var(--g-font-size-md);
  font-family: var(--g-font-mono);
}

.role-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: var(--g-font-size-xs);
  font-family: var(--g-font-mono);
  width: fit-content;
}

.role-badge.research {
  background: var(--g-color-info);
  color: white;
}

.role-badge.engineering {
  background: var(--g-color-warning);
  color: white;
}

.role-badge.farming {
  background: var(--g-color-positive);
  color: white;
}

.role-badge.civil-science {
  background: #9c27b0;
  color: white;
}

.role-badge.unassigned {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.section-title {
  font-weight: bold;
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
}

.stat-label {
  color: var(--g-color-text-muted);
}

.stat-value {
  font-family: var(--g-font-mono);
}

.assignment-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.building-name {
  font-family: var(--g-font-mono);
}

.inactive-badge {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-danger);
  background: rgba(198, 40, 40, 0.1);
  padding: 1px 4px;
  border-radius: 2px;
}

.coworkers-list,
.housemates-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
  align-items: center;
}

.list-label {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
}

.coworker-name,
.housemate-name {
  font-size: var(--g-font-size-xs);
  padding: 1px 4px;
  border-radius: 2px;
  background: var(--g-color-bg-surface);
}

.coworker-name.research,
.housemate-name.research {
  border-left: 2px solid var(--g-color-info);
}

.coworker-name.engineering,
.housemate-name.engineering {
  border-left: 2px solid var(--g-color-warning);
}

.coworker-name.farming,
.housemate-name.farming {
  border-left: 2px solid var(--g-color-positive);
}

.coworker-name.civil-science,
.housemate-name.civil-science {
  border-left: 2px solid #9c27b0;
}

.relationships-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.relationship-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rel-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.rel-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.rel-badges {
  display: flex;
  gap: 2px;
}

.rel-badge {
  font-size: 9px;
  padding: 0 3px;
  border-radius: 2px;
  font-weight: bold;
}

.rel-badge.coworker {
  background: var(--g-color-warning);
  color: white;
}

.rel-badge.housemate {
  background: var(--g-color-info);
  color: white;
}

.rel-strength {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.strength-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--g-color-bg-surface);
  border-radius: 3px;
  overflow: hidden;
}

.strength-bar {
  height: 100%;
  background: var(--g-color-border-strong);
  border-radius: 3px;
  transition: width 0.2s;
}

.strength-bar.strong {
  background: var(--g-color-positive);
}

.strength-value {
  font-size: var(--g-font-size-xs);
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  min-width: 32px;
  text-align: right;
}

/* Ideology styles */
.ideology-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.ideology-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.ideology-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  min-width: 60px;
}

.ideology-bar-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.ideology-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--g-color-bg-surface);
  border-radius: 3px;
  overflow: hidden;
}

.ideology-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.2s;
}

.ideology-bar.earth {
  background: var(--g-color-info);
}

.ideology-bar.mars {
  background: var(--g-color-positive);
}

.ideology-bar.corporate {
  background: var(--g-color-warning);
}

.ideology-bar.conviction {
  background: var(--g-color-text-muted);
}

.ideology-value {
  font-size: var(--g-font-size-xs);
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  min-width: 32px;
  text-align: right;
}

.conviction-row {
  margin-top: var(--g-space-xs);
  padding-top: var(--g-space-xs);
  border-top: 1px solid var(--g-color-border);
}
</style>
