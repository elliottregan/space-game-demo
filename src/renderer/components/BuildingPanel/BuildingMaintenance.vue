<script setup lang="ts">
import { computed } from "vue";
import { GButton, GProgress } from "../../ui";
import type { Building, BuildingDefinition, ResourceDelta } from "../../../facade";
import { MAINTENANCE_WARNING_THRESHOLD } from "../../../core/balance/BuildingBalance";

const props = defineProps<{
  buildings: Building[];
  getDefinition: (defId: string) => BuildingDefinition | undefined;
  getMaintenanceCost: (buildingId: string) => ResourceDelta | undefined;
  canPerformMaintenance: (buildingId: string) => boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  maintain: [buildingId: string];
}>();

// Show buildings that need attention (condition below warning threshold)
// biome-ignore lint/correctness/noUnusedVariables: used in template
const buildingsNeedingMaintenance = computed(() => {
  return props.buildings
    .filter(
      (b) => b.status === "active" && !b.broken && b.condition < MAINTENANCE_WARNING_THRESHOLD,
    )
    .sort((a, b) => a.condition - b.condition);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getConditionColor(condition: number): string {
  if (condition >= 80) return "var(--g-color-positive)";
  if (condition >= 50) return "var(--g-color-warning)";
  return "var(--g-color-negative)";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getConditionVariant(condition: number): "positive" | "warning" | "negative" {
  if (condition >= 80) return "positive";
  if (condition >= 50) return "warning";
  return "negative";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatMaintenanceCost(cost: ResourceDelta | undefined): string {
  if (!cost) return "";
  const items: string[] = [];
  for (const [key, value] of Object.entries(cost)) {
    if (value) items.push(`${value} ${key}`);
  }
  return items.join(", ");
}
</script>

<template>
  <div v-if="buildingsNeedingMaintenance.length > 0" class="maintenance-section">
    <h3>Maintenance Required</h3>
    <div class="maintenance-list">
      <div
        v-for="building in buildingsNeedingMaintenance"
        :key="building.id"
        class="maintenance-item"
      >
        <div class="building-info">
          <span class="building-name">
            {{ getDefinition(building.definitionId)?.name || building.definitionId }}
          </span>
          <span class="building-age">Age: {{ building.age }} sols</span>
        </div>

        <div class="condition-bar">
          <GProgress
            :percent="building.condition"
            :variant="getConditionVariant(building.condition)"
            showLabel
          >
            {{ building.condition }}%
          </GProgress>
        </div>

        <div class="maintenance-action">
          <GButton
            size="sm"
            variant="warning"
            :disabled="!canPerformMaintenance(building.id)"
            :title="canPerformMaintenance(building.id)
              ? `Cost: ${formatMaintenanceCost(getMaintenanceCost(building.id))}`
              : 'Insufficient resources'"
            @click="emit('maintain', building.id)"
          >
            Maintain
          </GButton>
        </div>
      </div>
    </div>

    <p v-if="buildingsNeedingMaintenance.some(b => b.condition < 50)" class="efficiency-warning">
      Buildings below 50% condition have reduced efficiency (-25%)
    </p>
  </div>
</template>

<style scoped>
.maintenance-section {
  margin-top: var(--g-space-lg);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.maintenance-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-accent-amber);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-sm);
}

.maintenance-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.maintenance-item {
  display: grid;
  grid-template-columns: 1fr 120px auto;
  align-items: center;
  gap: var(--g-space-md);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  border-left: 3px solid var(--g-color-warning);
}

.building-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.building-name {
  font-size: var(--g-font-size-sm);
  font-weight: 500;
}

.building-age {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.condition-bar {
  min-width: 100px;
}

.efficiency-warning {
  margin-top: var(--g-space-sm);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-negative);
  padding: var(--g-space-xs);
  background: rgba(198, 40, 40, 0.1);
}
</style>
