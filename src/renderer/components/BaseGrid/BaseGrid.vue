<!-- src/renderer/components/BaseGrid/BaseGrid.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { GridPosition, DepositType, PowerState } from "../../../core/models/Grid";
import { renderBaseGrid, type BaseGridData, type GridNodeData } from "./renderBaseGrid";
import { GRID_SIZE } from "./isometricUtils";

interface BuildingInfo {
  id: string;
  name: string;
  position: GridPosition;
  powerState: PowerState;
  batteryLevel: number;
}

interface DepositInfo {
  position: GridPosition;
  type: DepositType;
}

interface Props {
  buildings: BuildingInfo[];
  deposits: DepositInfo[];
  selectedPosition: GridPosition | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  cellClick: [position: GridPosition, hasBuilding: boolean];
  cellHover: [position: GridPosition | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const dimensions = ref({ width: 800, height: 600 });

function updateDimensions() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dimensions.value = {
      width: Math.max(400, rect.width),
      height: Math.max(300, rect.height),
    };
  }
}

const gridData = computed<BaseGridData>(() => {
  const cells: GridNodeData[] = [];

  // Create lookup for buildings and deposits
  const buildingMap = new Map(props.buildings.map((b) => [`${b.position.x},${b.position.y}`, b]));
  const depositMap = new Map(props.deposits.map((d) => [`${d.position.x},${d.position.y}`, d]));

  // Generate all cells
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = `${x},${y}`;
      const building = buildingMap.get(key);
      const deposit = depositMap.get(key);

      cells.push({
        position: { x, y },
        buildingId: building?.id,
        buildingName: building?.name,
        powerState: building?.powerState,
        batteryLevel: building?.batteryLevel,
        deposit: deposit?.type,
      });
    }
  }

  return {
    cells,
    selectedPosition: props.selectedPosition,
  };
});

function render() {
  if (!svgRef.value) return;

  renderBaseGrid(svgRef.value, gridData.value, {
    width: dimensions.value.width,
    height: dimensions.value.height,
    onCellClick: (pos, hasBuilding) => emit("cellClick", pos, hasBuilding),
    onCellHover: (pos) => emit("cellHover", pos),
  });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateDimensions();
  render();

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      render();
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch([gridData, dimensions], render);
</script>

<template>
  <div ref="containerRef" class="base-grid">
    <svg ref="svgRef" class="grid-svg" />
  </div>
</template>

<style scoped>
.base-grid {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.grid-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
