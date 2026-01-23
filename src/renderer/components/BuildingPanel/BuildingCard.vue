<script setup lang="ts">
import { GButton } from "../../ui";
import type { BuildingDefinition } from "../../../facade";

defineProps<{
  definition: BuildingDefinition;
  count: number;
  pendingCount: number;
  locked: boolean;
  canBuild: boolean;
  buildReason: string | undefined;
  requiredTechName: string;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  build: [];
  hover: [];
  leave: [];
}>();

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
</script>

<template>
  <div
    class="building-card"
    :class="{ locked, disabled: !canBuild && !locked }"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <div class="building-header">
      <span class="building-name">{{ definition.name }}</span>
      <span v-if="count > 0" class="building-count">
        x{{ count }}
        <span v-if="pendingCount > 0" class="pending">
          ({{ pendingCount }} building)
        </span>
      </span>
    </div>

    <p class="building-desc">{{ definition.description }}</p>

    <div v-if="locked" class="locked-notice">
      Requires: {{ requiredTechName }}
    </div>

    <div v-else class="building-stats">
      <div v-if="formatProduction(definition)" class="stat production">
        {{ formatProduction(definition) }}
      </div>
      <div v-if="formatConsumption(definition)" class="stat consumption">
        {{ formatConsumption(definition) }}
      </div>
      <div v-if="definition.moraleBoost" class="stat morale-boost">
        <span class="positive">+{{ definition.moraleBoost }} Morale</span>
      </div>
      <div class="stat cost">
        Cost: {{ formatCost(definition) }}
      </div>
      <div class="stat time">
        Build time: {{ definition.constructionTime }} sols
      </div>
    </div>

    <GButton
      v-if="!locked"
      variant="primary"
      :disabled="!canBuild"
      :title="buildReason"
      @click="emit('build')"
    >
      Build
    </GButton>
  </div>
</template>

<style scoped>
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

.stat.morale-boost .positive {
  color: var(--g-color-positive);
}

.stat.cost {
  color: oklch(70% 0.15 280);
}

.stat.time {
  color: var(--g-color-text-muted);
}
</style>
