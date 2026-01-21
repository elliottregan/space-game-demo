<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../services/GameService";
import type { BuildingDefinition } from "../../core/models/Building";
import { highlightResources, clearHighlights } from "../directives/ResourceHighlight";

const state = gameService.getState();
const selectedCategory = ref<"all" | "available" | "built">("available");

const availableBuildings = computed(() => {
  return state.buildingDefinitions.filter((def) => {
    if (def.requiredTech) {
      const isResearched = state.researchedTechs.some((t) => t.id === def.requiredTech);
      if (!isResearched) return false;
    }
    return true;
  });
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const filteredBuildings = computed(() => {
  switch (selectedCategory.value) {
    case "available":
      return availableBuildings.value;
    case "built":
      return state.buildingDefinitions.filter(
        (def) =>
          state.buildings.some((b) => b.definitionId === def.id) ||
          state.pendingBuildings.some((b) => b.definitionId === def.id),
      );
    default:
      return state.buildingDefinitions;
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canBuild(defId: string): boolean {
  return gameService.canBuild(defId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function buildBuilding(defId: string): void {
  gameService.startBuilding(defId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildingCount(defId: string): number {
  return (
    state.buildings.filter((b) => b.definitionId === defId).length +
    state.pendingBuildings.filter((b) => b.definitionId === defId).length
  );
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPendingCount(defId: string): number {
  return state.pendingBuildings.filter((b) => b.definitionId === defId).length;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatCost(def: BuildingDefinition): string {
  const costs: string[] = [];
  if (def.cost.materials) costs.push(`${def.cost.materials} Materials`);
  if (def.cost.power) costs.push(`${def.cost.power} Power`);
  return costs.join(", ");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatProduction(def: BuildingDefinition): string {
  if (!def.production) return "";
  const items: string[] = [];
  for (const [key, value] of Object.entries(def.production)) {
    if (value) items.push(`+${value} ${key}`);
  }
  return items.join(", ");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatConsumption(def: BuildingDefinition): string {
  if (!def.consumption) return "";
  const items: string[] = [];
  for (const [key, value] of Object.entries(def.consumption)) {
    if (value) items.push(`-${value} ${key}`);
  }
  return items.join(", ");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isLocked(def: BuildingDefinition): boolean {
  if (!def.requiredTech) return false;
  return !state.researchedTechs.some((t) => t.id === def.requiredTech);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getRequiredTechName(def: BuildingDefinition): string {
  if (!def.requiredTech) return "";
  const tech = state.technologies.find((t) => t.id === def.requiredTech);
  return tech?.name || def.requiredTech;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onBuildingHover(def: BuildingDefinition): void {
  const allResources = new Set<string>();
  const deltas: Record<string, number> = {};

  // Add construction cost resources (one-time deduction)
  for (const [key, value] of Object.entries(def.cost)) {
    if (value > 0) {
      allResources.add(key);
      deltas[key] = -value;
    }
  }

  const requiredResources = Array.from(allResources);

  // Check which construction cost resources are insufficient
  const insufficientResources = Object.keys(def.cost).filter((key) => {
    const required = (def.cost as Record<string, number>)[key] || 0;
    const available = (state.resources as Record<string, number>)[key] || 0;
    return available < required;
  });

  highlightResources(requiredResources, insufficientResources, deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onBuildingLeave(): void {
  clearHighlights();
}
</script>

<template>
  <div class="panel building-panel">
    <h2>Buildings</h2>

    <div class="category-tabs">
      <button
        :class="{ active: selectedCategory === 'available' }"
        @click="selectedCategory = 'available'"
      >
        Available
      </button>
      <button
        :class="{ active: selectedCategory === 'built' }"
        @click="selectedCategory = 'built'"
      >
        Built ({{ state.buildings.length }})
      </button>
      <button
        :class="{ active: selectedCategory === 'all' }"
        @click="selectedCategory = 'all'"
      >
        All
      </button>
    </div>

    <div class="building-list">
      <div
        v-for="def in filteredBuildings"
        :key="def.id"
        class="building-card"
        :class="{ locked: isLocked(def), disabled: !canBuild(def.id) && !isLocked(def) }"
        @mouseenter="onBuildingHover(def)"
        @mouseleave="onBuildingLeave"
      >
        <div class="building-header">
          <span class="building-name">{{ def.name }}</span>
          <span v-if="getBuildingCount(def.id) > 0" class="building-count">
            x{{ getBuildingCount(def.id) }}
            <span v-if="getPendingCount(def.id) > 0" class="pending">
              ({{ getPendingCount(def.id) }} building)
            </span>
          </span>
        </div>

        <p class="building-desc">{{ def.description }}</p>

        <div v-if="isLocked(def)" class="locked-notice">
          Requires: {{ getRequiredTechName(def) }}
        </div>

        <div v-else class="building-stats">
          <div v-if="formatProduction(def)" class="stat production">
            {{ formatProduction(def) }}
          </div>
          <div v-if="formatConsumption(def)" class="stat consumption">
            {{ formatConsumption(def) }}
          </div>
          <div class="stat cost">
            Cost: {{ formatCost(def) }}
          </div>
          <div class="stat time">
            Build time: {{ def.constructionTime }} sols
          </div>
        </div>

        <button
          v-if="!isLocked(def)"
          class="btn btn-primary build-btn"
          :disabled="!canBuild(def.id)"
          @click="buildBuilding(def.id)"
        >
          Build
        </button>
      </div>
    </div>

    <div v-if="state.pendingBuildings.length > 0" class="construction-queue">
      <h3>Under Construction</h3>
      <div
        v-for="building in state.pendingBuildings"
        :key="building.id"
        class="construction-item"
      >
        <span class="construction-name">
          {{ state.buildingDefinitions.find(d => d.id === building.definitionId)?.name }}
        </span>
        <div class="construction-progress">
          <div
            class="progress-fill"
            :style="{
              width: `${(building.constructionProgress / (state.buildingDefinitions.find(d => d.id === building.definitionId)?.constructionTime || 1)) * 100}%`
            }"
          ></div>
        </div>
        <span class="construction-time">
          {{ Math.ceil((state.buildingDefinitions.find(d => d.id === building.definitionId)?.constructionTime || 0) - building.constructionProgress) }} sols
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.building-panel {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
}

.category-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.category-tabs button {
  flex: 1;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
}

.category-tabs button.active {
  background: #e94560;
  color: white;
}

.category-tabs button:hover:not(.active) {
  background: rgba(255, 255, 255, 0.2);
}

.building-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  max-height: 100%;
  overflow-y: auto;
}

.building-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.building-card:hover:not(.locked):not(.disabled) {
  border-color: #e94560;
  transform: translateY(-2px);
}

.building-card.locked {
  opacity: 0.5;
}

.building-card.disabled {
  opacity: 0.7;
}

.building-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.building-name {
  font-weight: bold;
  color: #ffd460;
}

.building-count {
  font-size: 0.875rem;
  color: #60a5fa;
}

.building-count .pending {
  color: #fbbf24;
}

.building-desc {
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 0.75rem;
}

.locked-notice {
  font-size: 0.75rem;
  color: #f87171;
  padding: 0.5rem;
  background: rgba(248, 113, 113, 0.1);
  border-radius: 4px;
}

.building-stats {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.stat {
  font-size: 0.75rem;
}

.stat.production {
  color: #4ade80;
}

.stat.consumption {
  color: #f87171;
}

.stat.cost {
  color: #a78bfa;
}

.stat.time {
  color: #888;
}

.build-btn {
  width: 100%;
}

.construction-queue {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.construction-queue h3 {
  font-size: 0.875rem;
  color: #fbbf24;
  margin-bottom: 0.75rem;
}

.construction-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.construction-name {
  font-size: 0.875rem;
  min-width: 120px;
}

.construction-progress {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.construction-progress .progress-fill {
  height: 100%;
  background: #fbbf24;
  transition: width 0.3s;
}

.construction-time {
  font-size: 0.75rem;
  color: #888;
  min-width: 50px;
  text-align: right;
}
</style>
