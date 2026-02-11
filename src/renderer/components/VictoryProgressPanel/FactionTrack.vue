<!-- src/renderer/components/VictoryProgressPanel/FactionTrack.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { AxisPosition, AxisRequirement, Project } from "../../../core/models/NPCInfluence";
import { AXIS_KEYS, ProjectId } from "../../../core/models/NPCInfluence";
import { PROJECTS, meetsAxisRequirements } from "../../../core/data/projects";
import { BUILDINGS } from "../../../core/data/buildings";
import { gameService } from "../../services/GameService";
import type { FactionSnapshot } from "../../../facade/types/ideology";
import { GBadge } from "../../ui";

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

// All capstone projects
const capstoneProjects = computed((): Project[] => {
  return PROJECTS.filter((p) => p.isCapstone);
});

// For each capstone, compute how close this faction is to meeting its axis requirements
interface CapstoneProgress {
  project: Project;
  meetsRequirements: boolean;
  isCompleted: boolean;
  isPending: boolean;
  megastructureBuildingId: string | undefined;
  axisProgress: Array<{
    axis: keyof AxisPosition;
    current: number;
    required: number;
    direction: "min" | "max";
    met: boolean;
    percent: number;
  }>;
  prerequisitesPassed: number;
  prerequisitesTotal: number;
}

function computeAxisProgress(
  position: AxisPosition,
  axis: keyof AxisPosition,
  req: AxisRequirement,
): { current: number; required: number; direction: "min" | "max"; met: boolean; percent: number } {
  const value = position[axis];

  if (req.min !== undefined) {
    const met = value >= req.min;
    // Progress from 0 toward the required minimum
    // If the value is negative and min is positive, start from 0%
    const percent =
      req.min === 0 ? (met ? 100 : 0) : Math.max(0, Math.min(100, (value / req.min) * 100));
    return { current: value, required: req.min, direction: "min", met, percent };
  }

  if (req.max !== undefined) {
    const met = value <= req.max;
    // Progress toward the required maximum (lower/more negative)
    // e.g., if max is -0.6 and value is -0.3, progress is -0.3/-0.6 = 50%
    const percent =
      req.max === 0 ? (met ? 100 : 0) : Math.max(0, Math.min(100, (value / req.max) * 100));
    return { current: value, required: req.max, direction: "max", met, percent };
  }

  return { current: value, required: 0, direction: "min", met: true, percent: 100 };
}

const capstoneProgressList = computed((): CapstoneProgress[] => {
  const position = props.faction.position;
  const completed = state.ideology.completedProjects;
  const pending = state.ideology.pendingProposals;

  return capstoneProjects.value.map((project) => {
    const axisProgress: CapstoneProgress["axisProgress"] = [];

    if (project.axisRequirements) {
      for (const [axis, req] of Object.entries(project.axisRequirements)) {
        const progress = computeAxisProgress(position, axis as keyof AxisPosition, req);
        axisProgress.push({ axis: axis as keyof AxisPosition, ...progress });
      }
    }

    const prerequisiteIds = project.prerequisites ?? [];
    const prerequisitesPassed = prerequisiteIds.filter((id) => completed.includes(id)).length;

    // Find the building this capstone unlocks
    const megastructureBuildingId =
      typeof project.effects?.unlockBuilding === "string"
        ? project.effects.unlockBuilding
        : undefined;

    return {
      project,
      meetsRequirements: meetsAxisRequirements(position, project),
      isCompleted: completed.includes(project.id),
      isPending: pending.some((p) => p.projectId === project.id),
      megastructureBuildingId,
      axisProgress,
      prerequisitesPassed,
      prerequisitesTotal: prerequisiteIds.length,
    };
  });
});

// Find the capstone this faction is closest to (highest average axis progress)
const bestCapstone = computed((): CapstoneProgress | null => {
  if (capstoneProgressList.value.length === 0) return null;

  let best: CapstoneProgress | null = null;
  let bestScore = -Infinity;

  for (const cp of capstoneProgressList.value) {
    if (cp.axisProgress.length === 0) continue;
    const avgPercent =
      cp.axisProgress.reduce((sum, a) => sum + a.percent, 0) / cp.axisProgress.length;
    if (avgPercent > bestScore) {
      bestScore = avgPercent;
      best = cp;
    }
  }

  return best;
});

// Council seats for this faction
const councilSeats = computed((): number => {
  return state.ideology.councilFactionCounts[props.faction.id] ?? 0;
});

const totalSeats = computed((): number => {
  return state.ideology.council.length;
});

const seatsNeeded = computed((): number => {
  const threshold = Math.ceil(totalSeats.value * 0.65);
  return Math.max(0, threshold - councilSeats.value);
});

const hasCouncilMajority = computed((): boolean => {
  return seatsNeeded.value === 0 && totalSeats.value > 0;
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

// Project status helper
type ProjectStatus = "passed" | "pending" | "locked";

// oxlint-disable-next-line no-unused-vars
function getProjectStatus(projectId: ProjectId): ProjectStatus {
  if (state.ideology.completedProjects.includes(projectId)) return "passed";
  if (state.ideology.pendingProposals.some((p) => p.projectId === projectId)) return "pending";
  return "locked";
}

// oxlint-disable-next-line no-unused-vars
function getPendingVoteSols(projectId: ProjectId): number | null {
  const pending = state.ideology.pendingProposals.find((p) => p.projectId === projectId);
  if (!pending) return null;
  return pending.voteSol - state.currentSol;
}

// oxlint-disable-next-line no-unused-vars
function formatAxisValue(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}`;
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

  // Capstone pending vote
  if (capstone.isPending) {
    const pending = state.ideology.pendingProposals.find(
      (p) => p.projectId === capstone.project.id,
    );
    if (pending) {
      const sols = pending.voteSol - state.currentSol;
      return {
        action: `${capstone.project.name} vote in ${sols} sols`,
        type: "pending" as const,
      };
    }
  }

  // Check axis alignment
  if (!capstone.meetsRequirements) {
    const unmetAxes = capstone.axisProgress.filter((a) => !a.met);
    if (unmetAxes.length > 0) {
      const first = unmetAxes[0];
      const dirLabel = first.direction === "min" ? "Increase" : "Decrease";
      return {
        action: `${dirLabel} ${first.axis} to reach ${capstone.project.name}`,
        detail: `(${formatAxisValue(first.current)} / need ${formatAxisValue(first.required)})`,
        type: "locked" as const,
      };
    }
  }

  // Check prerequisites
  if (
    capstone.prerequisitesTotal > 0 &&
    capstone.prerequisitesPassed < capstone.prerequisitesTotal
  ) {
    return {
      action: `Pass ${capstone.prerequisitesTotal - capstone.prerequisitesPassed} more prerequisite(s)`,
      type: "locked" as const,
    };
  }

  // Check council majority
  if (!hasCouncilMajority.value) {
    return {
      action: `Gain ${seatsNeeded.value} more council seat${seatsNeeded.value !== 1 ? "s" : ""}`,
      type: "seats" as const,
    };
  }

  // Ready to propose capstone
  if (capstone.meetsRequirements && !capstone.isCompleted) {
    return { action: `Propose ${capstone.project.name}`, type: "ready" as const };
  }

  return { action: "Victory path complete", type: "ready" as const };
});
</script>

<template>
  <div class="faction-track" :style="{ '--faction-color': factionColor }">
    <div class="track-header">
      <span class="faction-name">{{ faction.name }}</span>
    </div>

    <!-- Axis Positions -->
    <div class="axis-section">
      <div class="section-label">Axis Positions</div>
      <div v-for="axis in AXIS_KEYS" :key="axis" class="axis-row">
        <span class="axis-label">{{ axis }}</span>
        <div class="axis-bar-container">
          <div class="axis-bar">
            <div class="axis-center" />
            <div
              class="axis-fill"
              :class="{
                positive: faction.position[axis] > 0,
                negative: faction.position[axis] < 0,
              }"
              :style="{
                left: faction.position[axis] >= 0 ? '50%' : `${50 + faction.position[axis] * 50}%`,
                width: `${Math.abs(faction.position[axis]) * 50}%`,
              }"
            />
          </div>
        </div>
        <span class="axis-value">{{ formatAxisValue(faction.position[axis]) }}</span>
      </div>
    </div>

    <!-- Best Capstone Path -->
    <div v-if="bestCapstone" class="capstone-section">
      <div class="section-label">Nearest Capstone</div>
      <div
        class="capstone-row"
        :class="{ met: bestCapstone.meetsRequirements, passed: bestCapstone.isCompleted }"
      >
        <span class="project-icon">
          <template v-if="bestCapstone.isCompleted">&#x2713;</template>
          <template v-else-if="bestCapstone.meetsRequirements">&#x25CF;</template>
          <template v-else>&#x25CB;</template>
        </span>
        <span class="capstone-name">{{ bestCapstone.project.name }}</span>
      </div>

      <!-- Axis requirement progress bars -->
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
            {{ formatAxisValue(ap.current) }}/{{ formatAxisValue(ap.required) }}
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
          v-for="prereqId in bestCapstone.project.prerequisites"
          :key="prereqId"
          class="project-row"
          :class="getProjectStatus(prereqId)"
        >
          <span class="project-icon">
            <template v-if="getProjectStatus(prereqId) === 'passed'">&#x2713;</template>
            <template v-else-if="getProjectStatus(prereqId) === 'pending'">&#x25D0;</template>
            <template v-else>&#x25CB;</template>
          </span>
          <span class="project-name">{{
            PROJECTS.find((p) => p.id === prereqId)?.name ?? prereqId
          }}</span>
          <GBadge v-if="getProjectStatus(prereqId) === 'pending'" variant="info" size="sm">
            {{ getPendingVoteSols(prereqId) }} sols
          </GBadge>
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
        <div class="council-threshold" />
      </div>
      <div class="council-stats">
        <span class="council-count">{{ councilSeats }}/{{ totalSeats }}</span>
        <span v-if="hasCouncilMajority" class="council-status majority">
          Majority secured &#x2713;
        </span>
        <span v-else class="council-status needed"> Need {{ seatsNeeded }} more </span>
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

/* Axis Positions */
.axis-section {
  margin-bottom: var(--g-space-xs);
}

.axis-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: 2px 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.axis-label {
  width: 90px;
  color: var(--g-color-text-muted);
  text-transform: capitalize;
}

.axis-bar-container {
  flex: 1;
}

.axis-bar {
  position: relative;
  height: 6px;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.axis-center {
  position: absolute;
  left: 50%;
  top: -1px;
  width: 1px;
  height: 8px;
  background: var(--g-color-text-muted);
}

.axis-fill {
  position: absolute;
  height: 100%;
  transition:
    width 0.3s,
    left 0.3s;
}

.axis-fill.positive {
  background: var(--faction-color);
}

.axis-fill.negative {
  background: var(--faction-color);
  opacity: 0.7;
}

.axis-value {
  width: 40px;
  text-align: right;
  color: var(--g-color-text);
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

/* Projects */
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

.project-row.pending {
  color: var(--color-info);
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

.council-threshold {
  position: absolute;
  left: 65%;
  top: -2px;
  width: 2px;
  height: 12px;
  background: var(--g-color-text);
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

.council-status.majority {
  color: var(--color-positive);
}

.council-status.needed {
  color: var(--g-color-text-muted);
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
