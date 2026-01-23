<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../services/GameService";
import type { Technology } from "../../core/models/Technology";
import { highlightResources, clearHighlights } from "../directives/ResourceHighlight";
import { GPanel, GButton, GProgress } from "../ui";
import TechTreeGraph from "./TechTreeGraph.vue";

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
function canResearch(techId: string): boolean {
  return api.technology.canResearch(techId).allowed;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getResearchReason(techId: string): string | undefined {
  const check = api.technology.canResearch(techId);
  return check.allowed ? undefined : check.reason;
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
function formatCost(tech: Technology): string {
  const parts = [`${tech.cost.sols} sols`];
  if (tech.cost.resources) {
    for (const [key, value] of Object.entries(tech.cost.resources)) {
      if (value) parts.push(`${value} ${key}`);
    }
  }
  return parts.join(", ");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onTechHover(tech: Technology): void {
  if (!tech.cost.resources) return;

  const deltas: Record<string, number> = {};
  const requiredResources = Object.keys(tech.cost.resources).filter((key) => {
    const value = (tech.cost.resources as Record<string, number>)[key] || 0;
    if (value > 0) {
      deltas[key] = -value;
      return true;
    }
    return false;
  });

  const insufficientResources = requiredResources.filter((key) => {
    const required = (tech.cost.resources as Record<string, number>)[key] || 0;
    const available = (state.resources as Record<string, number>)[key] || 0;
    return available < required;
  });

  highlightResources(requiredResources, insufficientResources, deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onTechLeave(): void {
  clearHighlights();
}
</script>

<template>
  <GPanel title="Research">
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
      <div v-if="state.currentResearch && currentResearchTech" class="current-research">
        <div class="research-header">
          <span class="research-name">{{ currentResearchTech.name }}</span>
          <GButton variant="secondary" size="sm" @click="cancelResearch">Cancel</GButton>
        </div>
        <GProgress :percent="researchProgress" showLabel>
          {{ Math.floor(state.currentResearch.progress) }} / {{ state.currentResearch.requiredSols }} sols
        </GProgress>
      </div>

      <div v-else class="no-research">
        No active research
      </div>

      <div class="tech-sections">
      <div v-if="state.availableTechs.length > 0" class="tech-section">
        <h3>Available</h3>
        <div class="tech-list">
          <div
            v-for="tech in state.availableTechs"
            :key="tech.id"
            class="tech-card available"
            @mouseenter="onTechHover(tech)"
            @mouseleave="onTechLeave"
          >
            <div class="tech-name">{{ tech.name }}</div>
            <div class="tech-desc">{{ tech.description }}</div>
            <div class="tech-cost">{{ formatCost(tech) }}</div>
            <div v-if="tech.unlocks.length > 0" class="tech-unlocks">
              Unlocks: {{ tech.unlocks.join(', ') }}
            </div>
            <GButton
              variant="primary"
              :disabled="!canResearch(tech.id) || !!state.currentResearch"
              @click="startResearch(tech.id)"
            >
              Research
            </GButton>
          </div>
        </div>
      </div>

      <div v-if="state.researchedTechs.length > 0" class="tech-section">
        <h3>Completed ({{ state.researchedTechs.length }})</h3>
        <div class="tech-list completed">
          <div
            v-for="tech in state.researchedTechs"
            :key="tech.id"
            class="tech-card completed"
          >
            <div class="tech-name">{{ tech.name }}</div>
          </div>
        </div>
      </div>

      <div class="tech-section">
        <h3>Locked</h3>
        <div class="tech-list">
          <div
            v-for="tech in state.technologies.filter(t => !isResearched(t.id) && !canResearch(t.id))"
            :key="tech.id"
            class="tech-card locked"
          >
            <div class="tech-name">{{ tech.name }}</div>
            <div class="tech-desc">{{ tech.description }}</div>
            <div v-if="!hasAllPrerequisites(tech)" class="tech-prereqs">
              Requires: {{ getPrerequisiteNames(tech).join(', ') }}
            </div>
          </div>
        </div>
      </div>
    </div>
    </template>
  </GPanel>
</template>

<style scoped>
.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--g-color-bg);
  border-radius: 4px;
  padding: 2px;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: var(--g-color-text-muted);
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: all 0.15s ease;
}

.toggle-btn:hover {
  color: var(--g-color-text);
  background: var(--g-color-bg-elevated);
}

.toggle-btn.active {
  background: var(--g-color-info);
  color: var(--g-color-bg);
}

.current-research {
  background: oklch(65% 0.15 250 / 0.1);
  border: 1px solid var(--g-color-info);
  border-radius: 4px;
  padding: var(--g-space-md);
  margin-bottom: var(--g-space-md);
}

.research-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-sm);
}

.research-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-info);
}

.no-research {
  color: var(--g-color-text-muted);
  font-style: italic;
  padding: var(--g-space-md);
  text-align: center;
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  margin-bottom: var(--g-space-md);
}

.tech-sections {
  max-height: 350px;
  overflow-y: auto;
}

.tech-section {
  margin-bottom: var(--g-space-md);
}

.tech-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
  padding-bottom: var(--g-space-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.tech-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.tech-list.completed {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
}

.tech-card {
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  padding: var(--g-space-sm);
  border: 1px solid var(--g-color-border);
}

.tech-card.available {
  border-color: oklch(65% 0.15 250 / 0.3);
}

.tech-card.available:hover {
  border-color: var(--g-color-info);
  box-shadow: var(--g-glow-subtle);
}

.tech-card.completed {
  display: inline-block;
  padding: var(--g-space-xs) var(--g-space-sm);
  background: oklch(70% 0.17 145 / 0.1);
  border-color: oklch(70% 0.17 145 / 0.3);
}

.tech-card.locked {
  opacity: 0.6;
}

.tech-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-xs);
}

.tech-card.completed .tech-name {
  color: var(--g-color-positive);
  margin-bottom: 0;
}

.tech-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.tech-cost {
  font-size: var(--g-font-size-xs);
  color: oklch(70% 0.15 280);
  margin-bottom: var(--g-space-xs);
}

.tech-unlocks {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-positive);
  margin-bottom: var(--g-space-xs);
}

.tech-prereqs {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-negative);
}

.tech-card :deep(.g-button) {
  margin-top: var(--g-space-xs);
  width: 100%;
}
</style>
