<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../services/GameService";
import type { BuildingDefinition } from "../../facade";
import { highlightResources, clearHighlights } from "../directives/ResourceHighlight";
import { GPanel, GButton, GProgress } from "../ui";

// Access the type-safe domain API
const api = gameService.api;

const selectedCategory = ref<"all" | "available" | "built">("available");

// Computed property for reactive building data
const buildingsSnapshot = computed(() => api.buildings.snapshot());

const availableBuildings = computed(() => {
  return buildingsSnapshot.value.definitions.filter((def) => {
    if (def.requiredTech) {
      return api.technology.isResearched(def.requiredTech);
    }
    return true;
  });
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const filteredBuildings = computed(() => {
  const snapshot = buildingsSnapshot.value;
  switch (selectedCategory.value) {
    case "available":
      return availableBuildings.value;
    case "built":
      return snapshot.definitions.filter(
        (def) =>
          snapshot.active.some((b) => b.definitionId === def.id) ||
          snapshot.pending.some((b) => b.definitionId === def.id),
      );
    default:
      return snapshot.definitions;
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeBuildings = computed(() => buildingsSnapshot.value.active);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const pendingBuildings = computed(() => buildingsSnapshot.value.pending);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canBuild(defId: string): boolean {
  return api.buildings.canBuild(defId).allowed;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildReason(defId: string): string | undefined {
  const check = api.buildings.canBuild(defId);
  return check.allowed ? undefined : check.reason;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function buildBuilding(defId: string): void {
  const result = api.buildings.build(defId);
  if (!result.success) {
    console.warn(`Build failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildingCount(defId: string): number {
  const snapshot = api.buildings.snapshot();
  return (
    snapshot.active.filter((b) => b.definitionId === defId).length +
    snapshot.pending.filter((b) => b.definitionId === defId).length
  );
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getPendingCount(defId: string): number {
  return api.buildings.snapshot().pending.filter((b) => b.definitionId === defId).length;
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
  return !api.technology.isResearched(def.requiredTech);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getRequiredTechName(def: BuildingDefinition): string {
  if (!def.requiredTech) return "";
  const tech = api.technology.getById(def.requiredTech);
  return tech?.name || def.requiredTech;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onBuildingHover(def: BuildingDefinition): void {
  const allResources = new Set<string>();
  const deltas: Record<string, number> = {};

  for (const [key, value] of Object.entries(def.cost)) {
    if (value > 0) {
      allResources.add(key);
      deltas[key] = -value;
    }
  }

  const requiredResources = Array.from(allResources);
  const currentResources = api.resources.snapshot().current;

  const insufficientResources = Object.keys(def.cost).filter((key) => {
    const required = (def.cost as Record<string, number>)[key] || 0;
    const available = (currentResources as Record<string, number>)[key] || 0;
    return available < required;
  });

  highlightResources(requiredResources, insufficientResources, deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onBuildingLeave(): void {
  clearHighlights();
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getConstructionPercent(building: { constructionProgress: number; definitionId: string }): number {
  const def = api.buildings.getDefinition(building.definitionId);
  if (!def) return 0;
  return (building.constructionProgress / def.constructionTime) * 100;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getBuildingName(definitionId: string): string {
  return api.buildings.getDefinition(definitionId)?.name || definitionId;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getRemainingBuildTime(building: { constructionProgress: number; definitionId: string }): number {
  const def = api.buildings.getDefinition(building.definitionId);
  if (!def) return 0;
  return Math.ceil(def.constructionTime - building.constructionProgress);
}
</script>

<template>
  <GPanel title="Buildings">
    <div class="category-tabs">
      <GButton
        :variant="selectedCategory === 'available' ? 'primary' : 'ghost'"
        size="sm"
        @click="selectedCategory = 'available'"
      >
        Available
      </GButton>
      <GButton
        :variant="selectedCategory === 'built' ? 'primary' : 'ghost'"
        size="sm"
        @click="selectedCategory = 'built'"
      >
        Built ({{ activeBuildings.length }})
      </GButton>
      <GButton
        :variant="selectedCategory === 'all' ? 'primary' : 'ghost'"
        size="sm"
        @click="selectedCategory = 'all'"
      >
        All
      </GButton>
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

        <GButton
          v-if="!isLocked(def)"
          variant="primary"
          :disabled="!canBuild(def.id)"
          :title="getBuildReason(def.id)"
          @click="buildBuilding(def.id)"
        >
          Build
        </GButton>
      </div>
    </div>

    <div v-if="pendingBuildings.length > 0" class="construction-queue">
      <h3>Under Construction</h3>
      <div
        v-for="building in pendingBuildings"
        :key="building.id"
        class="construction-item"
      >
        <span class="construction-name">
          {{ getBuildingName(building.definitionId) }}
        </span>
        <GProgress
          :percent="getConstructionPercent(building)"
          variant="warning"
          showLabel
        >
          {{ getRemainingBuildTime(building) }} sols
        </GProgress>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.category-tabs {
  display: flex;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-md);
}

.building-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--g-space-md);
  max-height: 100%;
  overflow-y: auto;
}

.building-card {
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  padding: var(--g-space-md);
  border: 1px solid var(--g-color-border);
  transition: all var(--g-transition-fast);
}

.building-card:hover:not(.locked):not(.disabled) {
  border-color: var(--g-color-border-focus);
  box-shadow: var(--g-glow-subtle);
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
  margin-bottom: var(--g-space-xs);
}

.building-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
}

.building-count {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-info);
}

.building-count .pending {
  color: var(--g-color-warning);
}

.building-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.locked-notice {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-negative);
  padding: var(--g-space-xs);
  background: oklch(60% 0.2 25 / 0.1);
  border-radius: 4px;
}

.building-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--g-space-sm);
}

.stat {
  font-size: var(--g-font-size-xs);
}

.stat.production {
  color: var(--g-color-positive);
}

.stat.consumption {
  color: var(--g-color-negative);
}

.stat.cost {
  color: oklch(70% 0.15 280);
}

.stat.time {
  color: var(--g-color-text-muted);
}

.construction-queue {
  margin-top: var(--g-space-lg);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.construction-queue h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-sm);
}

.construction-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  margin-bottom: var(--g-space-xs);
}

.construction-name {
  font-size: var(--g-font-size-sm);
  min-width: 120px;
}
</style>
