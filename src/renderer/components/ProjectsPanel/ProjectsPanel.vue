<script setup lang="ts">
import { computed } from "vue";
import { PROJECTS } from "../../../core/data/projects";
import type { AxisPosition, AxisRequirement } from "../../../core/models/NPCInfluence";
import { ProjectId } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel, GBadge, GButton } from "../../ui";

const state = gameService.getState();

const AXIS_LABELS: Record<keyof AxisPosition, { label: string; cssClass: string }> = {
  solidarity: { label: "Solidarity", cssClass: "earth" },
  sovereignty: { label: "Sovereignty", cssClass: "mars" },
  transformation: { label: "Transform", cssClass: "corporate" },
};

// oxlint-disable-next-line no-unused-vars
function formatAxisReq(axis: keyof AxisPosition, req: AxisRequirement): string {
  const info = AXIS_LABELS[axis];
  if (req.min !== undefined && req.max !== undefined) {
    return `${info.label}: ${req.min.toFixed(1)} to ${req.max.toFixed(1)}`;
  }
  if (req.min !== undefined) {
    return `${info.label} >= ${req.min.toFixed(1)}`;
  }
  if (req.max !== undefined) {
    return `${info.label} <= ${req.max.toFixed(1)}`;
  }
  return info.label;
}

// Projects with eligibility from facade
// oxlint-disable-next-line no-unused-vars
const projectsWithStatus = computed(() => {
  // Touch reactive state to ensure Vue tracks dependencies
  const _sol = state.currentSol;
  const _factions = state.ideology.factions;
  const _council = state.ideology.council;
  const _resources = state.resources;
  const _completed = state.ideology.completedProjects;
  const _pending = state.ideology.pendingProposals;
  const _failed = state.ideology.failedProposals;

  const completedSet = new Set(_completed);
  const pendingMap = new Map(_pending.map((p) => [p.projectId, p]));
  const councilFactionCounts = state.ideology.councilFactionCounts;
  const councilSize = state.ideology.council.length;

  return PROJECTS.map((project) => {
    const isCompleted = completedSet.has(project.id);
    const pending = pendingMap.get(project.id);
    const isPending = !!pending;

    // Get eligibility from facade (handles all checks)
    const eligibility = gameService.api.ideology.canProposeProject(project.id);

    // Find which faction can champion this (for vote projection)
    const factions = state.ideology.factions;
    let championBaseId: string | null = null;
    for (const faction of factions) {
      const pos = faction.position;
      let meetsReqs = true;
      if (project.axisRequirements) {
        for (const [axis, req] of Object.entries(project.axisRequirements)) {
          const value = pos[axis as keyof AxisPosition];
          if (req.min !== undefined && value < req.min) meetsReqs = false;
          if (req.max !== undefined && value > req.max) meetsReqs = false;
        }
      }
      if (meetsReqs) {
        championBaseId = faction.baseId;
        break;
      }
    }

    // Vote projection
    const votesFor = championBaseId ? (councilFactionCounts[championBaseId] ?? 0) : 0;
    const votesAgainst = councilSize - votesFor;
    const wouldPass = votesFor > votesAgainst;

    if (isCompleted) {
      return {
        ...project,
        status: "completed" as const,
        canPropose: false,
        reason: undefined as string | undefined,
        votesFor,
        votesAgainst,
        wouldPass,
        championBaseId,
      };
    }

    if (isPending) {
      const solsUntilVote = pending.voteSol - _sol;
      return {
        ...project,
        status: "pending" as const,
        canPropose: false,
        reason: undefined as string | undefined,
        solsUntilVote,
        voteSol: pending.voteSol,
        votesFor,
        votesAgainst,
        wouldPass,
        championBaseId,
      };
    }

    return {
      ...project,
      status: (eligibility.isFailed ? "failed" : "available") as "failed" | "available",
      canPropose: eligibility.canPropose,
      reason: eligibility.reason,
      votesFor,
      votesAgainst,
      wouldPass,
      championBaseId,
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
            <GBadge v-if="project.isCapstone" variant="warning" size="sm"> Capstone </GBadge>
          </div>
        </div>
        <p class="project-description">{{ project.description }}</p>

        <!-- Axis requirements -->
        <div v-if="project.axisRequirements" class="axis-requirements">
          <span
            v-for="(req, axis) in project.axisRequirements"
            :key="axis"
            :class="['axis-tag', AXIS_LABELS[axis as keyof AxisPosition]?.cssClass]"
          >
            {{ formatAxisReq(axis as keyof AxisPosition, req) }}
          </span>
        </div>

        <div class="project-footer">
          <span class="project-cost">Cost: {{ formatCost(project.proposalCost) }}</span>
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
      Projects require a faction with matching axis positions to champion them. The council votes
      after {{ 5 }} sols.
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

.axis-requirements {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-xs);
}

.axis-tag {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid;
}

.axis-tag.earth {
  color: var(--g-color-info);
  border-color: var(--g-color-info);
  background: rgba(0, 131, 143, 0.1);
}

.axis-tag.mars {
  color: var(--g-color-positive);
  border-color: var(--g-color-positive);
  background: rgba(46, 125, 50, 0.1);
}

.axis-tag.corporate {
  color: var(--g-color-warning);
  border-color: var(--g-color-warning);
  background: rgba(239, 108, 0, 0.1);
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
