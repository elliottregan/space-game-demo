<script setup lang="ts">
import { computed } from "vue";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import type { Project } from "../../../core/models/types";
import { gameService } from "../../services/GameService";
import { GActionCard, GBadge } from "../../ui";

const props = defineProps<{
  projects: Project[];
}>();

const state = gameService.getState();
const api = gameService.api;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  propose: [projectId: string];
}>();

// Compute project eligibility for each project
// biome-ignore lint/correctness/noUnusedVariables: used in template
const projectEligibility = computed(() => {
  const result: Record<string, { canPropose: boolean; currentSupport: number; requiredSupport: number; reason?: string }> = {};
  for (const project of props.projects) {
    result[project.id] = api.ideology.canProposeProject(project.id);
  }
  return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatProjectCost(cost: Record<string, number>): string {
  return (
    "Cost: " +
    Object.entries(cost)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")
  );
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatSupport(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getFactionVariant(faction: NPCFaction): "info" | "positive" | "warning" | "muted" {
  switch (faction) {
    case NPCFaction.EarthLoyalists:
      return "info";
    case NPCFaction.MarsIndependence:
      return "positive";
    case NPCFaction.CorporateInterests:
      return "warning";
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handlePropose(projectId: string): void {
  const eligibility = projectEligibility.value[projectId];
  if (eligibility?.canPropose) {
    emit("propose", projectId);
  }
}
</script>

<template>
  <section class="section">
    <h3 class="section-title">Propose a Project</h3>
    <div class="project-list">
      <div v-for="project in projects" :key="project.id" class="project-wrapper">
        <GActionCard
          :title="project.name"
          :description="project.description"
          :cost="formatProjectCost(project.proposalCost)"
          :action-label="projectEligibility[project.id]?.canPropose ? 'Propose' : 'Locked'"
          :disabled="!projectEligibility[project.id]?.canPropose"
          @click="handlePropose(project.id)"
        >
          <template #tag>
            <GBadge :variant="getFactionVariant(project.type)">
              {{ project.type }}
            </GBadge>
          </template>
        </GActionCard>

        <!-- Support requirement indicator -->
        <div class="support-indicator">
          <span class="support-label">Support:</span>
          <span
            class="support-value"
            :class="{
              'support-sufficient': projectEligibility[project.id]?.canPropose,
              'support-insufficient': !projectEligibility[project.id]?.canPropose,
            }"
          >
            {{ formatSupport(projectEligibility[project.id]?.currentSupport ?? 0) }}
          </span>
          <span class="support-separator">/</span>
          <span class="support-required">
            {{ formatSupport(projectEligibility[project.id]?.requiredSupport ?? 0) }}
          </span>
          <span v-if="!projectEligibility[project.id]?.canPropose" class="support-warning">
            (need more support)
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section {
  margin-bottom: var(--g-space-lg);
  padding-bottom: var(--g-space-md);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
}

.section-title {
  margin: 0 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  margin: var(--g-space-sm) 0;
}

.project-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.support-indicator {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.support-label {
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.support-value {
  font-weight: bold;
}

.support-sufficient {
  color: var(--color-positive);
}

.support-insufficient {
  color: var(--color-warning);
}

.support-separator {
  color: var(--g-color-text-muted);
}

.support-required {
  color: var(--g-color-text-muted);
}

.support-warning {
  color: var(--color-warning);
  font-size: var(--g-font-size-xs);
}
</style>
