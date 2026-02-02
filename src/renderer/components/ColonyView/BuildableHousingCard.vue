<script setup lang="ts">
import type { BuildingDefinition } from "../../../facade";
import { GButton } from "../../ui";

const props = defineProps<{
  definition: BuildingDefinition;
  canBuild: boolean;
  buildReason?: string;
  pendingCount: number;
}>();

const emit = defineEmits<{
  build: [];
  hover: [];
  leave: [];
}>();

function formatCapacity(def: BuildingDefinition): string {
  return def.capacity ? `${def.capacity} beds` : "";
}

function formatCost(def: BuildingDefinition): string {
  return def.cost.materials ? `${def.cost.materials} materials` : "";
}
</script>

<template>
  <div
    class="buildable-housing-card"
    :class="{ disabled: !canBuild }"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <div class="housing-info">
      <span class="housing-name">{{ definition.name }}</span>
      <span class="housing-capacity">{{ formatCapacity(definition) }}</span>
      <span class="housing-cost">{{ formatCost(definition) }}</span>
      <span v-if="pendingCount > 0" class="housing-pending">({{ pendingCount }} building)</span>
    </div>
    <GButton size="sm" :disabled="!canBuild" :title="buildReason" @click="emit('build')">
      Build
    </GButton>
  </div>
</template>

<style scoped>
.buildable-housing-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  border-radius: var(--g-radius-sm);
}

.buildable-housing-card.disabled {
  opacity: 0.6;
}

.housing-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-md);
}

.housing-name {
  font-weight: 500;
}

.housing-capacity {
  color: var(--g-color-info);
  font-size: var(--g-font-size-sm);
}

.housing-cost {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
}

.housing-pending {
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
}
</style>
