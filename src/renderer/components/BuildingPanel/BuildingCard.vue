<script setup lang="ts">
import type { BuildingDefinition } from "../../../facade";
import { GActionCard } from "../../ui";

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
  <GActionCard
    :title="definition.name"
    :description="definition.description"
    :cost="`Cost: ${formatCost(definition)}`"
    action-label="Build"
    :disabled="!canBuild || locked"
    class="building-card"
    :class="{ locked, disabled: !canBuild && !locked }"
    @click="emit('build')"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <template #tag>
      <span v-if="count > 0" class="building-count">
        x{{ count }}
        <span v-if="pendingCount > 0" class="pending"> ({{ pendingCount }} building) </span>
      </span>
    </template>

    <div v-if="locked" class="locked-notice">Requires: {{ requiredTechName }}</div>

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
      <div v-if="definition.airContribution !== undefined" class="stat oxygen-contrib">
        <span
          :class="
            definition.airContribution > 0
              ? 'positive'
              : definition.airContribution < 0
                ? 'negative'
                : 'neutral'
          "
        >
          {{ definition.airContribution > 0 ? "+" : "" }}{{ definition.airContribution }} O₂
        </span>
      </div>
      <div class="stat time">Build time: {{ definition.constructionTime }} sols</div>
    </div>
  </GActionCard>
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

.stat.time {
  color: var(--g-color-text-muted);
}
</style>
