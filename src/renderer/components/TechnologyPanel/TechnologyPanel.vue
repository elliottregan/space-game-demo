<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import type { Technology } from "../../../core/models/Technology";
import { highlightResources, clearHighlights } from "../../directives/ResourceHighlight";
import { calculateHighlightInfo } from "../../utils/formatters";
import { GPanel } from "../../ui";
import TechTreeGraph from "../TechTreeGraph.vue";
import CurrentResearch from "./CurrentResearch.vue";
import TechCard from "./TechCard.vue";
import TechSection from "./TechSection.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const viewMode = ref<"list" | "graph">("graph");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const currentResearchTech = computed(() => {
  if (!state.currentResearch) return null;
  return state.technologies.find((t) => t.id === state.currentResearch?.techId);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const researchProgress = computed(() => {
  if (!state.currentResearch) return 0;
  return (state.currentResearch.progress / state.currentResearch.requiredSols) * 100;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const lockedTechs = computed(() => {
  return state.technologies.filter((t) => !isResearched(t.id) && !canResearch(t.id));
});

function canResearch(techId: string): boolean {
  return api.technology.canResearch(techId).allowed;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function startResearch(techId: string): void {
  const result = api.technology.startResearch(techId);
  if (!result.success) {
    console.warn(`Research failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function cancelResearch(): void {
  const result = api.technology.cancelResearch();
  if (!result.success) {
    console.warn(`Cancel research failed: ${result.error.type}`, result.error);
  }
}

function isResearched(techId: string): boolean {
  return api.technology.isResearched(techId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPrerequisiteNames(tech: Technology): string[] {
  return tech.prerequisites.map((prereqId) => {
    const prereq = api.technology.getById(prereqId);
    return prereq?.name || prereqId;
  });
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function hasAllPrerequisites(tech: Technology): boolean {
  return tech.prerequisites.every((prereqId) => isResearched(prereqId));
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onTechHover(tech: Technology): void {
  if (!tech.cost.resources) return;
  const currentResources = state.resources as Record<string, number>;
  const info = calculateHighlightInfo(tech.cost.resources, currentResources);
  highlightResources(info.requiredResources, info.insufficientResources, info.deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onTechLeave(): void {
  clearHighlights();
}
</script>

<template>
  <GPanel title="Research" accent="cyan">
    <template #header-actions>
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'graph' }"
          @click="viewMode = 'graph'"
          title="Graph View"
        >
          &#9638;
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
          title="List View"
        >
          &#9776;
        </button>
      </div>
    </template>

    <TechTreeGraph v-if="viewMode === 'graph'" />

    <template v-else>
      <CurrentResearch
        :tech="currentResearchTech"
        :progress="researchProgress"
        :current-progress="state.currentResearch?.progress ?? 0"
        :required-sols="state.currentResearch?.requiredSols ?? 0"
        @cancel="cancelResearch"
      />

      <div class="tech-sections">
        <TechSection v-if="state.availableTechs.length > 0" title="Available">
          <TechCard
            v-for="tech in state.availableTechs"
            :key="tech.id"
            :tech="tech"
            variant="available"
            :can-research="canResearch(tech.id)"
            :has-active-research="!!state.currentResearch"
            :prerequisite-names="getPrerequisiteNames(tech)"
            :has-all-prerequisites="hasAllPrerequisites(tech)"
            @research="startResearch(tech.id)"
            @hover="onTechHover(tech)"
            @leave="onTechLeave"
          />
        </TechSection>

        <TechSection v-if="state.researchedTechs.length > 0" :title="`Completed (${state.researchedTechs.length})`" completed>
          <TechCard
            v-for="tech in state.researchedTechs"
            :key="tech.id"
            :tech="tech"
            variant="completed"
            :can-research="false"
            :has-active-research="false"
            :prerequisite-names="[]"
            :has-all-prerequisites="true"
          />
        </TechSection>

        <TechSection title="Locked">
          <TechCard
            v-for="tech in lockedTechs"
            :key="tech.id"
            :tech="tech"
            variant="locked"
            :can-research="false"
            :has-active-research="false"
            :prerequisite-names="getPrerequisiteNames(tech)"
            :has-all-prerequisites="hasAllPrerequisites(tech)"
          />
        </TechSection>
      </div>
    </template>
  </GPanel>
</template>

<style scoped>
.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--g-color-bg);
  padding: 2px;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--g-color-text-muted);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: all 0.15s ease;
}

.toggle-btn:hover {
  color: var(--g-color-text);
  background: var(--g-color-bg-surface);
}

.toggle-btn.active {
  background: var(--g-accent-cyan);
  color: var(--g-color-bg);
}

.tech-sections {
  max-height: 350px;
  overflow-y: auto;
}
</style>
