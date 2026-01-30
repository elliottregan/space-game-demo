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

// Projects with eligibility and status
// oxlint-disable-next-line no-unused-vars
const projectsWithStatus = computed(() => {
  // Use reactive state directly to ensure Vue tracks dependencies
  const completedSet = new Set(state.ideology.completedProjects);
  const failedSet = new Set(state.ideology.failedProposals);
  const pendingMap = new Map(state.ideology.pendingProposals.map((p) => [p.projectId, p]));
  const factionSupport = state.ideology.factionSupport;
  const councilFactionCounts = state.ideology.councilFactionCounts;
  const councilSize = state.ideology.council.length;
  const resources = state.resources;
  const currentSol = state.currentSol;

  return PROJECTS.map((project) => {
    const isCompleted = completedSet.has(project.id);
    const isFailed = failedSet.has(project.id);
    const pending = pendingMap.get(project.id);
    const isPending = !!pending;

    // Get faction vote counts
    const votesFor = councilFactionCounts[project.type] ?? 0;
    const votesAgainst = councilSize - votesFor;
    const wouldPass = votesFor > votesAgainst;

    if (isCompleted) {
      return {
        ...project,
        status: "completed" as const,
        canPropose: false,
        currentSupport: 0,
        requiredSupport: project.requiredSupport,
        votesFor,
        votesAgainst,
        wouldPass,
      };
    }

    if (isPending) {
      const solsUntilVote = pending.voteSol - currentSol;
      return {
        ...project,
        status: "pending" as const,
        canPropose: false,
        currentSupport: 0,
        requiredSupport: project.requiredSupport,
        solsUntilVote,
        voteSol: pending.voteSol,
        votesFor,
        votesAgainst,
        wouldPass,
      };
    }

    if (isFailed) {
      return {
        ...project,
        status: "failed" as const,
        canPropose: false,
        currentSupport: 0,
        requiredSupport: project.requiredSupport,
        votesFor,
        votesAgainst,
        wouldPass,
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
      status: "available" as const,
      canPropose,
      currentSupport,
      requiredSupport: project.requiredSupport,
      reason,
      votesFor,
      votesAgainst,
      wouldPass,
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
        v-for="project in projectsWithStatus"
        :key="project.id"
        class="project-card"
        :class="{
          'project-locked': project.status === 'available' && !project.canPropose,
          'project-completed': project.status === 'completed',
          'project-pending': project.status === 'pending',
          'project-failed': project.status === 'failed',
        }"
      >
        <div class="project-header">
          <span class="project-name">{{ project.name }}</span>
          <div class="project-badges">
            <GBadge v-if="project.status === 'completed'" variant="positive" size="sm">
              Passed
            </GBadge>
            <GBadge v-else-if="project.status === 'pending'" variant="info" size="sm">
              Vote in {{ project.solsUntilVote }} sols
            </GBadge>
            <GBadge v-else-if="project.status === 'failed'" variant="muted" size="sm">
              Failed
            </GBadge>
            <GBadge :variant="getFactionBadgeVariant(project.type)" size="sm">
              {{ project.type.replace("_", " ") }}
            </GBadge>
          </div>
        </div>
        <p class="project-description">{{ project.description }}</p>
        <div class="project-footer">
          <span class="project-cost">Cost: {{ formatCost(project.proposalCost) }}</span>
          <span
            v-if="project.status === 'available'"
            class="project-support"
            :class="{
              'support-sufficient': project.currentSupport >= project.requiredSupport,
              'support-insufficient': project.currentSupport < project.requiredSupport,
            }"
          >
            {{ formatSupport(project.currentSupport) }} /
            {{ formatSupport(project.requiredSupport) }}
          </span>
        </div>

        <!-- Vote projection for pending projects -->
        <div v-if="project.status === 'pending'" class="vote-projection">
          <span class="vote-label">Council votes:</span>
          <span :class="project.wouldPass ? 'vote-passing' : 'vote-failing'">
            {{ project.votesFor }} for / {{ project.votesAgainst }} against
            <span v-if="project.wouldPass">(will pass)</span>
            <span v-else>(will fail)</span>
          </span>
        </div>

        <!-- Vote projection for available projects -->
        <div v-if="project.status === 'available' && project.canPropose" class="vote-projection">
          <span class="vote-label">If proposed:</span>
          <span :class="project.wouldPass ? 'vote-passing' : 'vote-failing'">
            {{ project.votesFor }} for / {{ project.votesAgainst }} against
            <span v-if="project.wouldPass">(would pass)</span>
            <span v-else>(would fail)</span>
          </span>
        </div>

        <div
          v-if="project.status === 'available' && !project.canPropose && project.reason"
          class="project-reason"
        >
          {{ project.reason }}
        </div>
        <GButton
          v-if="project.status === 'available' && project.canPropose"
          size="sm"
          class="propose-button"
          @click="handlePropose(project.id)"
        >
          Propose Project
        </GButton>
      </div>
    </div>

    <p class="hint">
      Projects require faction support to propose, then pass by council vote after 10 sols.
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

.project-card.project-pending {
  border-left-color: var(--color-info);
}

.project-card.project-failed {
  border-left-color: var(--color-muted);
  opacity: 0.6;
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

.vote-projection {
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  display: flex;
  gap: var(--g-space-xs);
}

.vote-label {
  color: var(--g-color-text-muted);
}

.vote-passing {
  color: var(--color-positive);
}

.vote-failing {
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
