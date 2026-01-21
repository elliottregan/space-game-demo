<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";
import type { Technology } from "../../core/models/Technology";
import { highlightResources, clearHighlights } from "../directives/ResourceHighlight";

const state = gameService.getState();

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
  return gameService.canResearch(techId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function startResearch(techId: string): void {
  gameService.startResearch(techId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function cancelResearch(): void {
  gameService.cancelResearch();
}

function isResearched(techId: string): boolean {
  return state.researchedTechs.some((t) => t.id === techId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPrerequisiteNames(tech: Technology): string[] {
  return tech.prerequisites.map((prereqId) => {
    const prereq = state.technologies.find((t) => t.id === prereqId);
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
  <div class="panel technology-panel">
    <h2>Research</h2>

    <div v-if="state.currentResearch && currentResearchTech" class="current-research">
      <div class="research-header">
        <span class="research-name">{{ currentResearchTech.name }}</span>
        <button class="btn btn-secondary cancel-btn" @click="cancelResearch">Cancel</button>
      </div>
      <div class="research-progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${researchProgress}%` }"
          ></div>
        </div>
        <span class="progress-text">
          {{ Math.floor(state.currentResearch.progress) }} / {{ state.currentResearch.requiredSols }} sols
        </span>
      </div>
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
            <button
              class="btn btn-primary"
              :disabled="!canResearch(tech.id) || !!state.currentResearch"
              @click="startResearch(tech.id)"
            >
              Research
            </button>
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
  </div>
</template>

<style scoped>
.technology-panel {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
}

.current-research {
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid #60a5fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.research-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.research-name {
  font-weight: bold;
  color: #60a5fa;
}

.cancel-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.research-progress-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #60a5fa;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.75rem;
  color: #888;
  min-width: 80px;
  text-align: right;
}

.no-research {
  color: #888;
  font-style: italic;
  padding: 1rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.tech-sections {
  max-height: 350px;
  overflow-y: auto;
}

.tech-section {
  margin-bottom: 1rem;
}

.tech-section h3 {
  font-size: 0.875rem;
  color: #888;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tech-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tech-list.completed {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tech-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tech-card.available {
  border-color: rgba(96, 165, 250, 0.3);
}

.tech-card.available:hover {
  border-color: #60a5fa;
}

.tech-card.completed {
  display: inline-block;
  padding: 0.5rem 0.75rem;
  background: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.3);
}

.tech-card.locked {
  opacity: 0.6;
}

.tech-name {
  font-weight: bold;
  color: #ffd460;
  margin-bottom: 0.25rem;
}

.tech-card.completed .tech-name {
  color: #4ade80;
  margin-bottom: 0;
}

.tech-desc {
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 0.5rem;
}

.tech-cost {
  font-size: 0.75rem;
  color: #a78bfa;
  margin-bottom: 0.25rem;
}

.tech-unlocks {
  font-size: 0.75rem;
  color: #4ade80;
  margin-bottom: 0.5rem;
}

.tech-prereqs {
  font-size: 0.75rem;
  color: #f87171;
}

.tech-card button {
  margin-top: 0.5rem;
  width: 100%;
}
</style>
