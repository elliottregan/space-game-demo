<script setup lang="ts">
import { GButton, GCard } from "../../ui";
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
  <GCard
    :title="definition.name"
    class="building-card"
    :class="{ locked, disabled: !canBuild && !locked }"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <template #header-actions>
      <span v-if="count > 0" class="building-count">
        x{{ count }}
        <span v-if="pendingCount > 0" class="pending">
          ({{ pendingCount }} building)
        </span>
      </span>
    </template>

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
      <div v-if="definition.oxygenContribution !== undefined" class="stat oxygen-contrib">
        <span :class="definition.oxygenContribution > 0 ? 'positive' : definition.oxygenContribution < 0 ? 'negative' : 'neutral'">
          {{ definition.oxygenContribution > 0 ? '+' : '' }}{{ definition.oxygenContribution }} O₂
        </span>
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
  </GCard>
</template>

<style scoped>
.building-card.locked {
  opacity: 0.5;
}

.building-card.disabled {
  opacity: 0.7;
}

.building-count {
  font-family: var(--g-font-mono);
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
  background: rgba(198, 40, 40, 0.1);
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

.stat.oxygen-contrib .positive {
  color: var(--g-color-positive);
}

.stat.oxygen-contrib .negative {
  color: var(--g-color-negative);
}

.stat.oxygen-contrib .neutral {
  color: var(--g-color-text-muted);
}

.stat.cost {
  color: var(--g-accent-slate);
}

.stat.time {
  color: var(--g-color-text-muted);
}
</style>
