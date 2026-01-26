<script setup lang="ts">
import { GButton, GBadge, GActionCard } from "../../ui";
import type { Project } from "../../../core/models/types";
import { NPCFaction } from "../../../core/models/NPCInfluence";

defineProps<{
  projects: Project[];
  selectedProject: string | null;
  canPropose: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  select: [projectId: string];
  propose: [];
}>();

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
</script>

<template>
  <section class="section">
    <h3 class="section-title">Propose a Project</h3>
    <div class="project-list">
      <GActionCard
        v-for="project in projects"
        :key="project.id"
        :title="project.name"
        :description="project.description"
        :cost="formatProjectCost(project.proposalCost)"
        :selected="selectedProject === project.id"
        @click="emit('select', project.id)"
      >
        <template #tag>
          <GBadge :variant="getFactionVariant(project.type)">
            {{ project.type }}
          </GBadge>
        </template>
      </GActionCard>
    </div>
    <GButton variant="primary" :disabled="!canPropose" @click="emit('propose')">
      Propose Selected Project
    </GButton>
  </section>
</template>

<style scoped>
.section {
  margin-bottom: var(--g-space-lg);
  padding-bottom: var(--g-space-md);
  border-bottom: 1px solid var(--g-color-border);
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
  gap: var(--g-space-xs);
  margin: var(--g-space-sm) 0;
}
</style>
