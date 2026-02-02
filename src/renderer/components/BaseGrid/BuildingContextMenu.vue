<!-- src/renderer/components/BaseGrid/BuildingContextMenu.vue -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { GridPosition, DepositType } from "../../../core/models/Grid";
import type { BuildingDefinition } from "../../../core/models/Building";
import { BuildingId } from "../../../core/models/Building";

// Map building IDs to icon characters
const BUILDING_ICONS: Record<string, string> = {
  [BuildingId.HABITAT]: "🏠",
  [BuildingId.SOLAR_PANEL]: "☀️",
  [BuildingId.WATER_EXTRACTOR]: "💧",
  [BuildingId.BASIC_FARM]: "🌱",
  [BuildingId.BASIC_MINE]: "⛏️",
  [BuildingId.OXYGEN_GENERATOR]: "💨",
  [BuildingId.GREENHOUSE]: "🌿",
  [BuildingId.WATER_RECLAIMER]: "♻️",
  [BuildingId.RESEARCH_LAB]: "🔬",
  [BuildingId.ADVANCED_HABITAT]: "🏢",
  [BuildingId.AUTOMATED_FACTORY]: "🏭",
  [BuildingId.FABRICATOR_3D]: "🖨️",
  [BuildingId.MINING_STATION]: "🏗️",
  [BuildingId.NUCLEAR_REACTOR]: "⚛️",
  [BuildingId.BIOLAB]: "🧬",
  [BuildingId.MEDICAL_CENTER]: "🏥",
  [BuildingId.CRYO_FACILITY]: "❄️",
  [BuildingId.COMMON_ROOM]: "🛋️",
  [BuildingId.GYMNASIUM]: "🏋️",
  [BuildingId.HYDROPONIC_GARDEN]: "🌺",
  [BuildingId.OBSERVATORY_DOME]: "🔭",
  [BuildingId.ASSEMBLY_HALL]: "🏛️",
  [BuildingId.GENERATION_SHIP]: "🚀",
  [BuildingId.UNITED_MARS_STATION]: "🌍",
  [BuildingId.SPACE_ELEVATOR]: "🗼",
};

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
  preview: [buildingId: string | null];
  close: [];
}>();

// Track selected building before confirmation
const selectedDefId = ref<string | null>(null);

const selectedBuilding = computed(() => {
  if (!selectedDefId.value) return null;
  return props.availableBuildings.find((b) => b.id === selectedDefId.value) ?? null;
});

// Emit preview when selection changes
watch(selectedDefId, (defId) => {
  emit("preview", defId);
});

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

function selectBuilding(defId: string) {
  selectedDefId.value = defId;
}

function confirmSelection() {
  if (selectedDefId.value) {
    emit("select", selectedDefId.value);
  }
}

function cancelSelection() {
  selectedDefId.value = null;
}

function getIcon(defId: string): string {
  return BUILDING_ICONS[defId] ?? "🏗️";
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

    <!-- Selected building preview -->
    <div v-if="selectedBuilding" class="selected-preview">
      <div class="preview-icon">{{ getIcon(selectedBuilding.id) }}</div>
      <div class="preview-info">
        <div class="preview-name">{{ selectedBuilding.name }}</div>
        <div class="preview-desc">{{ selectedBuilding.description }}</div>
        <div class="preview-cost">{{ selectedBuilding.cost.materials }} materials</div>
      </div>
      <div class="preview-actions">
        <button class="build-btn" @click="confirmSelection">Build</button>
        <button class="cancel-btn" @click="cancelSelection">Back</button>
      </div>
    </div>

    <!-- Building list -->
    <ul v-else class="building-list">
      <li
        v-for="def in filteredBuildings"
        :key="def.id"
        class="building-option"
        :class="{ recommended: isRecommended(def) }"
        @click="selectBuilding(def.id)"
      >
        <div class="building-icon">{{ getIcon(def.id) }}</div>
        <div class="building-details">
          <div class="building-name">
            {{ def.name }}
            <span v-if="isRecommended(def)" class="rec-badge">*</span>
          </div>
          <div class="building-hint">{{ getBuildingHint(def) }}</div>
          <div class="building-cost">{{ def.cost.materials }} mat</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 240px;
  max-height: 350px;
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

/* Selected building preview */
.selected-preview {
  padding: var(--g-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.preview-icon {
  font-size: 32px;
  text-align: center;
}

.preview-info {
  text-align: center;
}

.preview-name {
  font-weight: 600;
  font-size: var(--g-font-size-md);
  margin-bottom: var(--g-space-xs);
}

.preview-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.preview-cost {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-info);
}

.preview-actions {
  display: flex;
  gap: var(--g-space-sm);
  margin-top: var(--g-space-sm);
}

.build-btn {
  flex: 1;
  padding: var(--g-space-sm);
  background: var(--g-color-positive);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.build-btn:hover {
  filter: brightness(1.1);
}

.cancel-btn {
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-base);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
  cursor: pointer;
}

.cancel-btn:hover {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text);
}

/* Building list */
.building-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.building-option {
  display: flex;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  cursor: pointer;
  border-bottom: 1px solid var(--g-color-border);
  align-items: center;
}

.building-option:hover {
  background: var(--g-color-bg-base);
}

.building-option.recommended {
  background: rgba(33, 150, 243, 0.1);
}

.building-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
}

.building-details {
  flex: 1;
  min-width: 0;
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
