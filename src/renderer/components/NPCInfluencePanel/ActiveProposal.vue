<script setup lang="ts">
import { GProgress, GBadge } from "../../ui";
import type { NPC, ActiveProject, Project } from "../../../core/models/types";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import NPCListItem from "./NPCListItem.vue";

defineProps<{
  activeProject: ActiveProject;
  npcs: NPC[];
  projects: Project[];
  selectedNPCForLobby: string | null;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  "select-npc": [npcId: string];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportVariant(support: number): "positive" | "negative" | "default" {
  if (support > 0.3) return "positive";
  if (support < -0.3) return "negative";
  return "default";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatSupport(support: number): string {
  const pct = (support * 100).toFixed(0);
  return support >= 0 ? `+${pct}%` : `${pct}%`;
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
    <h3 class="section-title">Active Proposal</h3>
    <div class="project-status">
      <div class="project-name">
        {{ projects.find(p => p.id === activeProject.projectId)?.name }}
      </div>
      <div class="status-row">
        <span class="status-label">
          Average Support:
          <span :class="`support-${getSupportVariant(activeProject.averageSupport)}`">
            {{ formatSupport(activeProject.averageSupport) }}
          </span>
        </span>
        <span class="status-label">
          Sols until vote: {{ activeProject.solsRemaining }}
        </span>
      </div>
      <div class="threshold-container">
        <GProgress
          :percent="Math.max(0, ((activeProject.averageSupport + 1) / 2) * 100)"
          :variant="getSupportVariant(activeProject.averageSupport)"
        />
        <div class="threshold-marker" />
      </div>
      <small class="hint">Need 40% average support to pass</small>
    </div>

    <h4 class="subsection-title">Council Members</h4>
    <div class="npc-list">
      <NPCListItem
        v-for="npc in npcs"
        :key="npc.id"
        :npc="npc"
        :support="activeProject.supportLevels[npc.id] || 0"
        :selected="selectedNPCForLobby === npc.id"
        @click="emit('select-npc', npc.id)"
      >
        <template #badge>
          <GBadge :variant="getFactionVariant(npc.faction)">
            {{ npc.faction }}
          </GBadge>
        </template>
      </NPCListItem>
    </div>
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

.subsection-title {
  margin: var(--g-space-md) 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.project-status {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.project-name {
  font-weight: 600;
  color: var(--g-color-text);
}

.status-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.status-label {
  color: var(--g-color-text-muted);
}

.threshold-container {
  position: relative;
  margin: var(--g-space-xs) 0;
}

.threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 70%;
  width: 2px;
  background: var(--g-color-text);
  opacity: 0.5;
}

.hint {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.npc-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  margin: var(--g-space-sm) 0;
}

.support-positive {
  color: var(--g-color-positive);
}

.support-negative {
  color: var(--g-color-negative);
}

.support-default {
  color: var(--g-color-text-muted);
}
</style>
