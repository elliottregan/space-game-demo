<script setup lang="ts">
import { computed } from "vue";
import { PROJECTS } from "../../../core/data/projects";
import { NPCFaction, ProjectId } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel, GBadge, GButton } from "../../ui";

const state = gameService.getState();

// oxlint-disable-next-line no-unused-vars
function getFactionBadgeVariant(faction: NPCFaction): "info" | "positive" | "warning" | "muted" {
  switch (faction) {
    case NPCFaction.EarthLoyalists:
      return "info";
    case NPCFaction.MarsIndependence:
      return "positive";
    case NPCFaction.CorporateInterests:
      return "warning";
  }
}

// oxlint-disable-next-line no-unused-vars
function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}

// Projects with eligibility
// oxlint-disable-next-line no-unused-vars
const projectsWithEligibility = computed(() => {
  // Use reactive state directly to ensure Vue tracks dependencies
  const completedSet = new Set(state.ideology.completedProjects);
  const factionSupport = state.ideology.factionSupport;
  const resources = state.resources;

  return PROJECTS.map((project) => {
    const isCompleted = completedSet.has(project.id);

    if (isCompleted) {
      return {
        ...project,
        canPropose: false,
        currentSupport: 0,
        requiredSupport: project.requiredSupport,
        reason: "Project already completed",
        isCompleted: true,
      };
    }

    // Get support for this project's faction from reactive state
    let currentSupport = 0;
    switch (project.type) {
      case NPCFaction.EarthLoyalists:
        currentSupport = factionSupport.earthLoyalists;
        break;
      case NPCFaction.MarsIndependence:
        currentSupport = factionSupport.marsIndependence;
        break;
      case NPCFaction.CorporateInterests:
        currentSupport = factionSupport.corporateInterests;
        break;
    }

    // Check affordability from reactive resources
    const canAfford = Object.entries(project.proposalCost).every(
      ([resource, amount]) => (resources[resource as keyof typeof resources] ?? 0) >= amount,
    );

    const hasSufficientSupport = currentSupport >= project.requiredSupport;
    const canPropose = canAfford && hasSufficientSupport;

    let reason: string | undefined;
    if (!canAfford) {
      reason = "Cannot afford proposal cost";
    } else if (!hasSufficientSupport) {
      reason = `Insufficient faction support (need ${Math.round(project.requiredSupport * 100)}%)`;
    }

    return {
      ...project,
      canPropose,
      currentSupport,
      requiredSupport: project.requiredSupport,
      reason,
      isCompleted: false,
    };
  });
});

// oxlint-disable-next-line no-unused-vars
function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}

// oxlint-disable-next-line no-unused-vars
function handlePropose(projectId: ProjectId): void {
  gameService.proposeProject(projectId);
}
</script>

<template>
  <GPanel title="Projects" accent="slate">
    <div class="projects-list">
      <div
        v-for="project in projectsWithEligibility"
        :key="project.id"
        class="project-card"
        :class="{
          'project-locked': !project.canPropose && !project.isCompleted,
          'project-completed': project.isCompleted,
        }"
      >
        <div class="project-header">
          <span class="project-name">{{ project.name }}</span>
          <div class="project-badges">
            <GBadge v-if="project.isCompleted" variant="positive" size="sm"> Completed </GBadge>
            <GBadge :variant="getFactionBadgeVariant(project.type)" size="sm">
              {{ project.type.replace("_", " ") }}
            </GBadge>
          </div>
        </div>
        <p class="project-description">{{ project.description }}</p>
        <div class="project-footer">
          <span class="project-cost">Cost: {{ formatCost(project.proposalCost) }}</span>
          <span
            v-if="!project.isCompleted"
            class="project-support"
            :class="{
              'support-sufficient': project.canPropose,
              'support-insufficient': !project.canPropose,
            }"
          >
            {{ formatSupport(project.currentSupport) }} /
            {{ formatSupport(project.requiredSupport) }}
          </span>
        </div>
        <div
          v-if="!project.canPropose && !project.isCompleted && project.reason"
          class="project-reason"
        >
          {{ project.reason }}
        </div>
        <GButton
          v-if="project.canPropose"
          size="sm"
          class="propose-button"
          @click="handlePropose(project.id)"
        >
          Propose Project
        </GButton>
      </div>
    </div>

    <p class="hint">
      Projects require faction support to propose. Build support by lobbying council members.
    </p>
  </GPanel>
</template>

<style scoped>
.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.project-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-left: 3px solid var(--g-color-border);
}

.project-card.project-locked {
  opacity: 0.7;
}

.project-card.project-completed {
  border-left-color: var(--color-positive);
  opacity: 0.8;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-xs);
}

.project-badges {
  display: flex;
  gap: var(--g-space-xs);
}

.project-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  color: var(--g-color-text);
}

.project-description {
  margin: 0 0 var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.project-footer {
  display: flex;
  justify-content: space-between;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.project-cost {
  color: var(--g-color-text-muted);
}

.project-support {
  font-weight: bold;
}

.support-sufficient {
  color: var(--color-positive);
}

.support-insufficient {
  color: var(--color-warning);
}

.project-reason {
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--color-warning);
}

.propose-button {
  margin-top: var(--g-space-sm);
  width: 100%;
}

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}
</style>
