<!-- src/renderer/components/VictoryProgressPanel/FactionTrack.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { NPCFaction, ProjectId } from "../../../core/models/NPCInfluence";
import { BuildingId } from "../../../core/models/Building";
import { PROJECTS, getProjectsByFaction } from "../../../core/data/projects";
import { BUILDINGS } from "../../../core/data/buildings";
import { gameService } from "../../services/GameService";
import { GBadge } from "../../ui";
import {
  FACTION_CSS_VARS,
  FACTION_FULL_NAMES,
  npcFactionToFactionId,
} from "../../utils/ideologyDisplay";

const props = defineProps<{
  faction: NPCFaction;
}>();

const state = gameService.getState();

// Faction display config with megastructure using unified display model
const factionConfig = computed(() => {
  const factionId = npcFactionToFactionId(props.faction);
  const megastructureMap: Record<NPCFaction, BuildingId> = {
    [NPCFaction.EarthLoyalists]: BuildingId.SPACE_ELEVATOR,
    [NPCFaction.MarsIndependence]: BuildingId.UNITED_MARS_STATION,
    [NPCFaction.CorporateInterests]: BuildingId.GENERATION_SHIP,
  };

  return {
    name: FACTION_FULL_NAMES[factionId],
    color: FACTION_CSS_VARS[factionId],
    megastructureId: megastructureMap[props.faction],
  };
});

// Get projects for this faction (non-capstone prerequisites)
const prerequisiteProjects = computed(() => {
  return getProjectsByFaction(props.faction).filter((p) => !p.isCapstone);
});

// Get capstone project for this faction
const capstoneProject = computed(() => {
  return getProjectsByFaction(props.faction).find((p) => p.isCapstone);
});

// Project status helper
type ProjectStatus = "passed" | "pending" | "available" | "locked";

function getProjectStatus(projectId: ProjectId): ProjectStatus {
  if (state.ideology.completedProjects.includes(projectId)) {
    return "passed";
  }
  const pending = state.ideology.pendingProposals.find((p) => p.projectId === projectId);
  if (pending) {
    return "pending";
  }
  // Check if can propose (has sufficient support)
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) return "locked";

  const support = getFactionSupport();
  if (support >= project.requiredSupport) {
    return "available";
  }
  return "locked";
}

function getFactionSupport(): number {
  switch (props.faction) {
    case NPCFaction.EarthLoyalists:
      return state.ideology.factionSupport.earthLoyalists;
    case NPCFaction.MarsIndependence:
      return state.ideology.factionSupport.marsIndependence;
    case NPCFaction.CorporateInterests:
      return state.ideology.factionSupport.corporateInterests;
  }
}

// Count passed prerequisites
const passedCount = computed(() => {
  return prerequisiteProjects.value.filter((p) => state.ideology.completedProjects.includes(p.id))
    .length;
});

// Council seats
const councilSeats = computed(() => {
  return state.ideology.councilFactionCounts[props.faction] ?? 0;
});

const totalSeats = computed(() => {
  return state.ideology.council.length;
});

const seatsNeeded = computed(() => {
  const threshold = Math.ceil(totalSeats.value * 0.65);
  return Math.max(0, threshold - councilSeats.value);
});

const hasCouncilMajority = computed(() => {
  return seatsNeeded.value === 0 && totalSeats.value > 0;
});

// Megastructure state
const megastructureDef = computed(() => {
  return BUILDINGS.find((b) => b.id === factionConfig.value.megastructureId);
});

const isCapstoneCompleted = computed(() => {
  const capstone = capstoneProject.value;
  return capstone ? state.ideology.completedProjects.includes(capstone.id) : false;
});

const megastructureBuilding = computed(() => {
  const megaId = factionConfig.value.megastructureId;
  // Check pending (under construction)
  const pending = state.pendingBuildings.find((b) => b.definitionId === megaId);
  if (pending) return { building: pending, status: "building" as const };
  // Check active (completed)
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

// Get pending vote info
function getPendingVoteSols(projectId: ProjectId): number | null {
  const pending = state.ideology.pendingProposals.find((p) => p.projectId === projectId);
  if (!pending) return null;
  return pending.voteSol - state.currentSol;
}

// Next step logic
const nextStep = computed(() => {
  const support = getFactionSupport();
  const capstone = capstoneProject.value;
  const megaDef = megastructureDef.value;

  // Check if megastructure is being built
  if (megastructureBuilding.value?.status === "building" && megastructureProgress.value) {
    return {
      action: `Building ${megaDef?.name}`,
      detail: `(${megastructureProgress.value.percent}%)`,
      type: "building" as const,
    };
  }

  // Check if capstone completed - ready to build megastructure
  if (isCapstoneCompleted.value && megaDef && !megastructureBuilding.value) {
    return { action: `Build ${megaDef.name} to win!`, type: "ready" as const };
  }

  // Check if capstone is pending
  if (capstone) {
    const capstonePending = state.ideology.pendingProposals.find(
      (p) => p.projectId === capstone.id,
    );
    if (capstonePending) {
      const sols = capstonePending.voteSol - state.currentSol;
      return { action: `${capstone.name} vote in ${sols} sols`, type: "pending" as const };
    }
  }

  // Check if capstone is ready to propose
  if (
    passedCount.value >= 3 &&
    hasCouncilMajority.value &&
    capstone &&
    !isCapstoneCompleted.value
  ) {
    return { action: `Propose ${capstone.name}`, type: "ready" as const };
  }

  // Check if projects incomplete
  if (passedCount.value < 3) {
    // Find next project to work on
    for (const project of prerequisiteProjects.value) {
      const status = getProjectStatus(project.id);
      if (status === "pending") {
        const sols = getPendingVoteSols(project.id);
        return { action: `${project.name} vote in ${sols} sols`, type: "pending" as const };
      }
      if (status === "available") {
        return { action: `Propose ${project.name}`, type: "available" as const };
      }
      if (status === "locked") {
        const requiredPct = Math.round(project.requiredSupport * 100);
        const currentPct = Math.round(support * 100);
        return {
          action: `Raise support to ${requiredPct}% to propose ${project.name}`,
          detail: `(current: ${currentPct}%)`,
          type: "locked" as const,
        };
      }
    }
  }

  // Projects done but need seats
  if (passedCount.value >= 3 && !hasCouncilMajority.value) {
    return {
      action: `Gain ${seatsNeeded.value} more council seat${seatsNeeded.value !== 1 ? "s" : ""}`,
      type: "seats" as const,
    };
  }

  return { action: "Victory path complete", type: "ready" as const };
});
</script>

<template>
  <div class="faction-track" :style="{ '--faction-color': factionConfig.color }">
    <div class="track-header">
      <span class="faction-name">{{ factionConfig.name }}</span>
    </div>

    <!-- Projects Section -->
    <div class="projects-section">
      <div class="section-label">Projects ({{ passedCount }}/3)</div>
      <div class="project-list">
        <div
          v-for="project in prerequisiteProjects"
          :key="project.id"
          class="project-row"
          :class="getProjectStatus(project.id)"
        >
          <span class="project-icon">
            <template v-if="getProjectStatus(project.id) === 'passed'">✓</template>
            <template v-else-if="getProjectStatus(project.id) === 'pending'">◐</template>
            <template v-else>○</template>
          </span>
          <span class="project-name">{{ project.name }}</span>
          <GBadge v-if="getProjectStatus(project.id) === 'pending'" variant="info" size="sm">
            {{ getPendingVoteSols(project.id) }} sols
          </GBadge>
        </div>
      </div>

      <!-- Capstone -->
      <div v-if="capstoneProject" class="capstone-section">
        <div class="capstone-label">CAPSTONE</div>
        <div
          class="project-row capstone"
          :class="{
            ready: passedCount >= 3 && hasCouncilMajority && !isCapstoneCompleted,
            passed: isCapstoneCompleted,
          }"
        >
          <span class="project-icon">
            <template v-if="isCapstoneCompleted">✓</template>
            <template v-else>○</template>
          </span>
          <span class="project-name">{{ capstoneProject.name }}</span>
        </div>
        <div class="capstone-reqs">Requires: {{ passedCount }}/3 projects, 65% council</div>
      </div>

      <!-- Megastructure -->
      <div v-if="megastructureDef" class="megastructure-section">
        <div class="megastructure-label">VICTORY BUILDING</div>
        <div
          class="megastructure-row"
          :class="{
            locked: !isCapstoneCompleted,
            ready: isCapstoneCompleted && !megastructureBuilding,
            building: megastructureBuilding?.status === 'building',
            complete: megastructureBuilding?.status === 'complete',
          }"
        >
          <span class="project-icon">
            <template v-if="megastructureBuilding?.status === 'complete'">★</template>
            <template v-else-if="megastructureBuilding?.status === 'building'">◐</template>
            <template v-else-if="isCapstoneCompleted">○</template>
            <template v-else>🔒</template>
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
        <span v-if="hasCouncilMajority" class="council-status majority"> Majority secured ✓ </span>
        <span v-else class="council-status needed"> Need {{ seatsNeeded }} more </span>
      </div>
    </div>

    <!-- Next Step -->
    <div class="next-step" :class="nextStep.type">
      <span class="step-arrow">→</span>
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

/* Projects */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.project-row.available {
  color: var(--g-color-text);
}

.project-icon {
  width: 16px;
  text-align: center;
}

.project-name {
  flex: 1;
}

/* Capstone */
.capstone-section {
  margin-top: var(--g-space-sm);
  padding-top: var(--g-space-sm);
  border-top: 1px dashed var(--g-color-border);
}

.capstone-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  letter-spacing: 0.1em;
}

.project-row.capstone {
  color: var(--g-color-text-muted);
  font-weight: bold;
}

.project-row.capstone.ready {
  color: var(--faction-color);
}

.capstone-reqs {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: 2px;
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
