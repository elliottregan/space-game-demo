<!-- src/renderer/components/VictoryProgressPanel/FactionTrack.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { getCapstoneGrants, getDistrictGrantTemplate } from "../../../core/data/districtGrants";
import { BUILDINGS } from "../../../core/data/buildings";
import { CAPSTONE_UNLOCK_THRESHOLD } from "../../../core/balance/DistrictGrantBalance";
import { gameService } from "../../services/GameService";
import type { FactionSnapshot } from "../../../facade/types/ideology";

const FACTION_COLORS: Record<string, string> = {
  earth_loyalists: "var(--g-color-info)",
  mars_independence: "var(--g-color-positive)",
  corporate_interests: "var(--g-color-warning)",
};

const props = defineProps<{
  faction: FactionSnapshot;
}>();

const state = gameService.getState();

const factionColor = computed((): string => {
  return FACTION_COLORS[props.faction.baseId] ?? "var(--color-muted)";
});

// All capstone grants
const capstoneGrants = computed(() => {
  return getCapstoneGrants();
});

// For each capstone, compute progress toward axis thresholds and prerequisites
interface CapstoneProgress {
  id: string;
  name: string;
  isCompleted: boolean;
  isUnlocked: boolean;
  megastructureBuildingId: string | undefined;
  axisProgress: Array<{
    axis: string;
    current: number;
    required: number;
    met: boolean;
    percent: number;
  }>;
  prerequisitesPassed: number;
  prerequisitesTotal: number;
}

const capstoneProgressList = computed((): CapstoneProgress[] => {
  const axisProgress = state.grants.axisProgress;
  const completedSet = new Set(state.grants.completedGrantIds);

  return capstoneGrants.value.map((capstone) => {
    const axisEntries: CapstoneProgress["axisProgress"] = [];

    if (capstone.axisRequirements) {
      for (const axis of Object.keys(capstone.axisRequirements)) {
        const current = axisProgress[axis] ?? 0;
        const required = CAPSTONE_UNLOCK_THRESHOLD;
        const met = current >= required;
        const percent = required > 0 ? Math.min(100, (current / required) * 100) : 100;
        axisEntries.push({ axis, current, required, met, percent });
      }
    }

    const prerequisiteIds = capstone.prerequisites ?? [];
    const prerequisitesPassed = prerequisiteIds.filter((id) => completedSet.has(id)).length;

    // A capstone is unlocked when all prereqs are done and axis thresholds are met
    const allPrereqsMet = prerequisitesPassed === prerequisiteIds.length;
    const allAxesMet = axisEntries.every((a) => a.met);
    const isUnlocked = allPrereqsMet && allAxesMet;

    const megastructureBuildingId =
      typeof capstone.effect?.unlockBuilding === "string"
        ? capstone.effect.unlockBuilding
        : undefined;

    return {
      id: capstone.id,
      name: capstone.name,
      isCompleted: completedSet.has(capstone.id),
      isUnlocked,
      megastructureBuildingId,
      axisProgress: axisEntries,
      prerequisitesPassed,
      prerequisitesTotal: prerequisiteIds.length,
    };
  });
});

// Find the capstone this faction is closest to (highest average axis progress)
const bestCapstone = computed((): CapstoneProgress | null => {
  if (capstoneProgressList.value.length === 0) return null;

  // Match faction position to capstone axis requirements
  let best: CapstoneProgress | null = null;
  let bestScore = -Infinity;

  for (const cp of capstoneProgressList.value) {
    if (cp.axisProgress.length === 0) continue;

    // Score based on alignment of faction position with capstone axes
    let alignmentScore = 0;
    for (const ap of cp.axisProgress) {
      const factionValue = props.faction.position[ap.axis as keyof typeof props.faction.position];
      // Higher faction value on the capstone's relevant axis = more aligned
      alignmentScore += factionValue ?? 0;
    }

    // Also factor in progress
    const avgPercent =
      cp.axisProgress.reduce((sum, a) => sum + a.percent, 0) / cp.axisProgress.length;
    const score = alignmentScore * 100 + avgPercent;

    if (score > bestScore) {
      bestScore = score;
      best = cp;
    }
  }

  return best;
});

// Faction support % (0-1)
const supportPercent = computed((): number => {
  return state.ideology.factionSupport[props.faction.id] ?? 0;
});

const totalColonists = computed((): number => {
  return state.colonists.length;
});

// Council seats for this faction
const councilSeats = computed((): number => {
  return state.ideology.councilFactionCounts[props.faction.id] ?? 0;
});

const totalSeats = computed((): number => {
  return state.ideology.council.length;
});

// Megastructure state for best capstone
const megastructureDef = computed(() => {
  const buildingId = bestCapstone.value?.megastructureBuildingId;
  if (!buildingId) return null;
  return BUILDINGS.find((b) => b.id === buildingId) ?? null;
});

const megastructureBuilding = computed(() => {
  const megaId = bestCapstone.value?.megastructureBuildingId;
  if (!megaId) return null;
  const pending = state.pendingBuildings.find((b) => b.definitionId === megaId);
  if (pending) return { building: pending, status: "building" as const };
  const active = state.buildings.find((b) => b.definitionId === megaId);
  if (active) return { building: active, status: "complete" as const };
  return null;
});

const megastructureProgress = computed(() => {
  if (!megastructureBuilding.value || megastructureBuilding.value.status !== "building")
    return null;
  const building = megastructureBuilding.value.building;
  const def = megastructureDef.value;
  if (!def) return null;
  return {
    current: building.constructionProgress,
    total: def.constructionTime,
    percent: Math.round((building.constructionProgress / def.constructionTime) * 100),
  };
});

// oxlint-disable-next-line no-unused-vars
function formatAxisValue(value: number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(0);
  }
  return "0";
}

// oxlint-disable-next-line no-unused-vars
function getPrereqName(prereqId: string): string {
  const template = getDistrictGrantTemplate(prereqId as any);
  return template?.name ?? prereqId;
}

// oxlint-disable-next-line no-unused-vars
function isPrereqCompleted(prereqId: string): boolean {
  return state.grants.completedGrantIds.includes(prereqId);
}

// Next step logic
const nextStep = computed(() => {
  const capstone = bestCapstone.value;
  const megaDef = megastructureDef.value;

  // Megastructure being built
  if (megastructureBuilding.value?.status === "building" && megastructureProgress.value) {
    return {
      action: `Building ${megaDef?.name}`,
      detail: `(${megastructureProgress.value.percent}%)`,
      type: "building" as const,
    };
  }

  // Megastructure complete
  if (megastructureBuilding.value?.status === "complete") {
    return { action: "Victory achieved!", type: "ready" as const };
  }

  if (!capstone) {
    return { action: "No capstone path available", type: "locked" as const };
  }

  // Capstone completed - ready to build megastructure
  if (capstone.isCompleted && megaDef && !megastructureBuilding.value) {
    return { action: `Build ${megaDef.name} to win!`, type: "ready" as const };
  }

  // Check axis progress
  const unmetAxes = capstone.axisProgress.filter((a) => !a.met);
  if (unmetAxes.length > 0) {
    const first = unmetAxes[0];
    return {
      action: `Build more ${first.axis} grants`,
      detail: `(${formatAxisValue(first.current)}/${first.required} progress)`,
      type: "locked" as const,
    };
  }

  // Check prerequisites
  if (
    capstone.prerequisitesTotal > 0 &&
    capstone.prerequisitesPassed < capstone.prerequisitesTotal
  ) {
    return {
      action: `Complete ${capstone.prerequisitesTotal - capstone.prerequisitesPassed} more prerequisite grant(s)`,
      type: "locked" as const,
    };
  }

  // Capstone is unlocked - assign it to a district
  if (capstone.isUnlocked && !capstone.isCompleted) {
    return { action: `Assign ${capstone.name} to a district`, type: "ready" as const };
  }

  return { action: "Victory path in progress", type: "locked" as const };
});
</script>

<template>
  <div class="faction-track" :style="{ '--faction-color': factionColor }">
    <div class="track-header">
      <span class="faction-name">{{ faction.name }}</span>
    </div>

    <!-- Faction Strength -->
    <div class="strength-section">
      <div class="strength-row">
        <span class="strength-label">Support</span>
        <div class="strength-bar-container">
          <div class="strength-bar">
            <div class="strength-fill" :style="{ width: `${supportPercent * 100}%` }" />
          </div>
        </div>
        <span class="strength-value">{{ (supportPercent * 100).toFixed(0) }}%</span>
      </div>
      <div class="strength-row">
        <span class="strength-label">Conviction</span>
        <div class="strength-bar-container">
          <div class="strength-bar">
            <div
              class="strength-fill conviction-fill"
              :style="{ width: `${faction.avgConviction * 100}%` }"
            />
          </div>
        </div>
        <span class="strength-value">{{ (faction.avgConviction * 100).toFixed(0) }}%</span>
      </div>
      <div class="strength-row">
        <span class="strength-label">Members</span>
        <span class="strength-value members-value">{{ faction.members }}/{{ totalColonists }}</span>
      </div>
    </div>

    <!-- Best Capstone Path -->
    <div v-if="bestCapstone" class="capstone-section">
      <div class="section-label">Nearest Capstone</div>
      <div
        class="capstone-row"
        :class="{ met: bestCapstone.isUnlocked, passed: bestCapstone.isCompleted }"
      >
        <span class="project-icon">
          <template v-if="bestCapstone.isCompleted">&#x2713;</template>
          <template v-else-if="bestCapstone.isUnlocked">&#x25CF;</template>
          <template v-else>&#x25CB;</template>
        </span>
        <span class="capstone-name">{{ bestCapstone.name }}</span>
      </div>

      <!-- Axis progress bars (colony-wide grant progress toward threshold) -->
      <div class="axis-reqs">
        <div v-for="ap in bestCapstone.axisProgress" :key="ap.axis" class="axis-req-row">
          <span class="axis-req-label">{{ ap.axis }}</span>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ met: ap.met }"
              :style="{ width: `${Math.min(100, ap.percent)}%` }"
            />
          </div>
          <span class="axis-req-value" :class="{ met: ap.met }">
            {{ formatAxisValue(ap.current) }}/{{ ap.required }}
          </span>
        </div>
      </div>

      <!-- Prerequisites -->
      <div v-if="bestCapstone.prerequisitesTotal > 0" class="prereqs-section">
        <div class="prereqs-label">
          Prerequisites ({{ bestCapstone.prerequisitesPassed }}/{{
            bestCapstone.prerequisitesTotal
          }})
        </div>
        <div
          v-for="prereqId in capstoneGrants.find((c) => c.id === bestCapstone!.id)?.prerequisites ??
          []"
          :key="prereqId"
          class="project-row"
          :class="isPrereqCompleted(prereqId) ? 'passed' : 'locked'"
        >
          <span class="project-icon">
            <template v-if="isPrereqCompleted(prereqId)">&#x2713;</template>
            <template v-else>&#x25CB;</template>
          </span>
          <span class="project-name">{{ getPrereqName(prereqId) }}</span>
        </div>
      </div>

      <!-- Megastructure -->
      <div v-if="megastructureDef" class="megastructure-section">
        <div class="megastructure-label">VICTORY BUILDING</div>
        <div
          class="megastructure-row"
          :class="{
            locked: !bestCapstone.isCompleted,
            ready: bestCapstone.isCompleted && !megastructureBuilding,
            building: megastructureBuilding?.status === 'building',
            complete: megastructureBuilding?.status === 'complete',
          }"
        >
          <span class="project-icon">
            <template v-if="megastructureBuilding?.status === 'complete'">&#x2605;</template>
            <template v-else-if="megastructureBuilding?.status === 'building'">&#x25D0;</template>
            <template v-else-if="bestCapstone.isCompleted">&#x25CB;</template>
            <template v-else>&#x1F512;</template>
          </span>
          <span class="megastructure-name">{{ megastructureDef.name }}</span>
        </div>
        <div v-if="megastructureProgress" class="megastructure-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${megastructureProgress.percent}%` }" />
          </div>
          <span class="progress-text">
            {{ megastructureProgress.current }}/{{ megastructureProgress.total }} sols
          </span>
        </div>
        <div v-else class="megastructure-cost">
          Cost: {{ megastructureDef.cost.materials }} materials
          <template v-if="megastructureDef.cost.power"
            >, {{ megastructureDef.cost.power }} power</template
          >
        </div>
      </div>
    </div>

    <!-- Council Section -->
    <div class="council-section">
      <div class="section-label">Council Seats</div>
      <div class="council-bar">
        <div
          class="council-fill"
          :style="{ width: totalSeats > 0 ? `${(councilSeats / totalSeats) * 100}%` : '0%' }"
        />
      </div>
      <div class="council-stats">
        <span class="council-count">{{ councilSeats }}/{{ totalSeats }}</span>
      </div>
    </div>

    <!-- Next Step -->
    <div class="next-step" :class="nextStep.type">
      <span class="step-arrow">&rarr;</span>
      <span class="step-action">{{ nextStep.action }}</span>
      <span v-if="nextStep.detail" class="step-detail">{{ nextStep.detail }}</span>
    </div>
  </div>
</template>

<style scoped>
.faction-track {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  padding: var(--g-space-md);
  background: var(--g-color-bg-elevated);
  border-top: 3px solid var(--faction-color);
}

.track-header {
  margin-bottom: var(--g-space-xs);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--faction-color);
}

.section-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

/* Faction Strength */
.strength-section {
  margin-bottom: var(--g-space-xs);
}

.strength-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: 2px 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.strength-label {
  width: 70px;
  color: var(--g-color-text-muted);
}

.strength-bar-container {
  flex: 1;
}

.strength-bar {
  position: relative;
  height: 6px;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.strength-fill {
  height: 100%;
  background: var(--faction-color);
  transition: width 0.3s;
}

.conviction-fill {
  opacity: 0.8;
}

.strength-value {
  width: 40px;
  text-align: right;
  color: var(--g-color-text);
}

.members-value {
  width: auto;
  margin-left: auto;
}

/* Capstone */
.capstone-section {
  margin-top: var(--g-space-xs);
  padding-top: var(--g-space-sm);
  border-top: 1px dashed var(--g-color-border);
}

.capstone-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-xs) 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  font-weight: bold;
  color: var(--g-color-text-muted);
}

.capstone-row.met {
  color: var(--faction-color);
}

.capstone-row.passed {
  color: var(--color-positive);
}

.capstone-name {
  flex: 1;
}

/* Axis requirement progress */
.axis-reqs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--g-space-xs);
}

.axis-req-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.axis-req-label {
  width: 90px;
  color: var(--g-color-text-muted);
  text-transform: capitalize;
}

.axis-req-value {
  width: 70px;
  text-align: right;
  color: var(--g-color-text-muted);
  white-space: nowrap;
}

.axis-req-value.met {
  color: var(--color-positive);
}

/* Projects / Prerequisites */
.prereqs-section {
  margin-top: var(--g-space-sm);
}

.prereqs-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

.project-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-xs) 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.project-row.passed {
  color: var(--color-positive);
}

.project-row.passed .project-name {
  text-decoration: line-through;
  opacity: 0.7;
}

.project-row.locked {
  color: var(--g-color-text-muted);
}

.project-icon {
  width: 16px;
  text-align: center;
}

.project-name {
  flex: 1;
}

/* Megastructure */
.megastructure-section {
  margin-top: var(--g-space-sm);
  padding-top: var(--g-space-sm);
  border-top: 1px dashed var(--g-color-border);
}

.megastructure-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--faction-color);
  letter-spacing: 0.1em;
  font-weight: bold;
}

.megastructure-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-xs) 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
}

.megastructure-row.locked {
  color: var(--g-color-text-muted);
}

.megastructure-row.ready {
  color: var(--faction-color);
}

.megastructure-row.building {
  color: var(--color-info);
}

.megastructure-row.complete {
  color: var(--color-positive);
}

.megastructure-name {
  flex: 1;
}

.megastructure-progress {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  margin-top: var(--g-space-xs);
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.progress-fill {
  height: 100%;
  background: var(--faction-color);
  transition: width 0.3s;
}

.progress-fill.met {
  background: var(--color-positive);
}

.progress-text {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  white-space: nowrap;
}

.megastructure-cost {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: 2px;
}

/* Council */
.council-section {
  margin-top: var(--g-space-sm);
}

.council-bar {
  position: relative;
  height: 8px;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.council-fill {
  height: 100%;
  background: var(--faction-color);
  transition: width 0.3s;
}

.council-stats {
  display: flex;
  justify-content: space-between;
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.council-count {
  color: var(--g-color-text);
}

/* Next Step */
.next-step {
  margin-top: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-base);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  display: flex;
  gap: var(--g-space-xs);
  flex-wrap: wrap;
}

.step-arrow {
  color: var(--faction-color);
  font-weight: bold;
}

.step-action {
  color: var(--g-color-text);
}

.step-detail {
  color: var(--g-color-text-muted);
}

.next-step.ready .step-action {
  color: var(--color-positive);
  font-weight: bold;
}

.next-step.locked .step-action {
  color: var(--color-warning);
}

.next-step.building .step-action {
  color: var(--color-info);
}
</style>
