<script setup lang="ts">
import { computed } from "vue";
import { PROJECTS } from "../../../core/data/projects";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel, GBadge } from "../../ui";

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
  return PROJECTS.map((project) => {
    const eligibility = gameService.api.ideology.canProposeProject(project.id);
    return {
      ...project,
      canPropose: eligibility.canPropose,
      currentSupport: eligibility.currentSupport,
      requiredSupport: eligibility.requiredSupport,
      reason: eligibility.reason,
    };
  });
});

// oxlint-disable-next-line no-unused-vars
function formatCost(cost: Record<string, number>): string {
  return Object.entries(cost)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
</script>

<template>
  <GPanel title="Projects" accent="slate">
    <div class="projects-list">
      <div
        v-for="project in projectsWithEligibility"
        :key="project.id"
        class="project-card"
        :class="{ 'project-locked': !project.canPropose }"
      >
        <div class="project-header">
          <span class="project-name">{{ project.name }}</span>
          <GBadge :variant="getFactionBadgeVariant(project.type)" size="sm">
            {{ project.type.replace("_", " ") }}
          </GBadge>
        </div>
        <p class="project-description">{{ project.description }}</p>
        <div class="project-footer">
          <span class="project-cost">Cost: {{ formatCost(project.proposalCost) }}</span>
          <span
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
        <div v-if="!project.canPropose && project.reason" class="project-reason">
          {{ project.reason }}
        </div>
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

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-xs);
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

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}
</style>
