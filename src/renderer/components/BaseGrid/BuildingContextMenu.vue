<!-- src/renderer/components/BaseGrid/BuildingContextMenu.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { GridPosition, DepositType } from "../../../core/models/Grid";
import type { BuildingDefinition } from "../../../core/models/Building";

interface PlacementHints {
  hasPower: boolean;
  powerCapacityAvailable: number;
  deposit?: DepositType;
  isOccupied: boolean;
}

interface Props {
  position: GridPosition;
  hints: PlacementHints;
  availableBuildings: BuildingDefinition[];
  screenX: number;
  screenY: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [buildingId: string];
  close: [];
}>();

const filteredBuildings = computed(() => {
  return props.availableBuildings.filter((def) => {
    // Filter by deposit requirement
    if (def.requiresDeposit && !props.hints.deposit) {
      return false;
    }
    return true;
  });
});

function getBuildingHint(def: BuildingDefinition): string {
  const hints: string[] = [];

  if (!props.hints.hasPower && def.powerConsumption) {
    hints.push("No power");
  } else if (props.hints.hasPower) {
    hints.push(`${props.hints.powerCapacityAvailable} available`);
  }

  if (def.requiresDeposit && props.hints.deposit) {
    hints.push(`${props.hints.deposit} deposit`);
  }

  return hints.join(" - ");
}

function isRecommended(def: BuildingDefinition): boolean {
  // Recommend power buildings when no power
  if (!props.hints.hasPower && def.powerProduction) {
    return true;
  }
  // Recommend deposit buildings when on deposit
  if (props.hints.deposit && def.requiresDeposit) {
    return true;
  }
  return false;
}
</script>

<template>
  <div class="context-menu" :style="{ left: `${screenX}px`, top: `${screenY}px` }">
    <header class="menu-header">
      <span class="coords">Cell ({{ position.x }}, {{ position.y }})</span>
      <button class="close-btn" @click="emit('close')">x</button>
    </header>

    <div class="menu-info">
      <span v-if="hints.hasPower" class="power-ok">Powered</span>
      <span v-else class="power-warning">No power coverage</span>
      <span v-if="hints.deposit" class="deposit">
        {{ hints.deposit === "water" ? "Water" : "Mineral" }}
      </span>
    </div>

    <ul class="building-list">
      <li
        v-for="def in filteredBuildings"
        :key="def.id"
        class="building-option"
        :class="{ recommended: isRecommended(def) }"
        @click="emit('select', def.id)"
      >
        <div class="building-name">
          {{ def.name }}
          <span v-if="isRecommended(def)" class="rec-badge">*</span>
        </div>
        <div class="building-hint">{{ getBuildingHint(def) }}</div>
        <div class="building-cost">{{ def.cost.materials }} materials</div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-base);
  border-bottom: 1px solid var(--g-color-border);
}

.coords {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.close-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.close-btn:hover {
  color: var(--g-color-text);
}

.menu-info {
  display: flex;
  gap: var(--g-space-sm);
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.power-ok {
  color: var(--g-color-positive);
}

.power-warning {
  color: var(--g-color-warning);
}

.deposit {
  color: var(--g-color-info);
}

.building-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.building-option {
  padding: var(--g-space-sm);
  cursor: pointer;
  border-bottom: 1px solid var(--g-color-border);
}

.building-option:hover {
  background: var(--g-color-bg-base);
}

.building-option.recommended {
  background: rgba(33, 150, 243, 0.1);
}

.building-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.rec-badge {
  color: var(--g-color-warning);
  font-size: var(--g-font-size-xs);
}

.building-hint {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: 2px;
}

.building-cost {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
}
</style>
