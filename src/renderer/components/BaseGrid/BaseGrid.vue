<!-- src/renderer/components/BaseGrid/BaseGrid.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { GridPosition, DepositType, PowerState } from "../../../core/models/Grid";
import { renderBaseGrid, type BaseGridData, type GridNodeData } from "./renderBaseGrid";
import { GRID_SIZE } from "./isometricUtils";

interface BuildingInfo {
  id: string;
  defId: string;
  name: string;
  position: GridPosition;
  powerState: PowerState;
  batteryLevel: number;
  status?: "pending" | "active" | "disabled" | "idle" | "recycling";
  constructionProgress?: number;
  powerSourceId?: string;
}

interface DepositInfo {
  position: GridPosition;
  type: DepositType;
}

interface Props {
  buildings: BuildingInfo[];
  deposits: DepositInfo[];
  selectedPosition: GridPosition | null;
  /** Building definition ID selected for placement preview */
  selectedBuildingDefId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  cellClick: [position: GridPosition, hasBuilding: boolean];
  cellHover: [position: GridPosition | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const dimensions = ref({ width: 800, height: 600 });

// Pan state
const pan = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const isMouseDown = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const panStart = ref({ x: 0, y: 0 });
const DRAG_THRESHOLD = 5; // pixels before drag starts

function updateDimensions() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dimensions.value = {
      width: Math.max(400, rect.width),
      height: Math.max(300, rect.height),
    };
  }
}

function handleMouseDown(event: MouseEvent) {
  if (event.button === 0) {
    isMouseDown.value = true;
    dragStart.value = { x: event.clientX, y: event.clientY };
    panStart.value = { x: pan.value.x, y: pan.value.y };
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!isMouseDown.value) return;

  const dx = event.clientX - dragStart.value.x;
  const dy = event.clientY - dragStart.value.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Start panning once we exceed threshold
  if (distance > DRAG_THRESHOLD) {
    isPanning.value = true;
  }

  if (isPanning.value) {
    pan.value = {
      x: panStart.value.x + dx,
      y: panStart.value.y + dy,
    };
  }
}

function handleMouseUp() {
  isMouseDown.value = false;
  isPanning.value = false;
}

function handleMouseLeave() {
  isMouseDown.value = false;
  isPanning.value = false;
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
        buildingDefId: building?.defId,
        buildingName: building?.name,
        powerState: building?.powerState,
        batteryLevel: building?.batteryLevel,
        deposit: deposit?.type,
        status: building?.status,
        constructionProgress: building?.constructionProgress,
        powerSourceId: building?.powerSourceId,
      });
    }
  }

  return {
    cells,
    selectedPosition: props.selectedPosition,
    selectedBuildingDefId: props.selectedBuildingDefId,
  };
});

function render() {
  if (!svgRef.value) return;

  renderBaseGrid(svgRef.value, gridData.value, {
    width: dimensions.value.width,
    height: dimensions.value.height,
    panX: pan.value.x,
    panY: pan.value.y,
    onCellClick: (pos, hasBuilding) => emit("cellClick", pos, hasBuilding),
    onCellHover: (pos) => emit("cellHover", pos),
  });
}

let resizeObserver: ResizeObserver | null = null;
let resizeFrameId: number | null = null;

onMounted(() => {
  updateDimensions();
  render();

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeFrameId !== null) {
        cancelAnimationFrame(resizeFrameId);
      }
      resizeFrameId = requestAnimationFrame(() => {
        updateDimensions();
        render();
        resizeFrameId = null;
      });
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  if (resizeFrameId !== null) {
    cancelAnimationFrame(resizeFrameId);
  }
  resizeObserver?.disconnect();
});

watch([gridData, dimensions, pan], render, { deep: true });
</script>

<template>
  <div
    ref="containerRef"
    class="base-grid"
    :class="{ dragging: isPanning }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <svg ref="svgRef" class="grid-svg" />
  </div>
</template>

<style scoped>
.base-grid {
  width: 100%;
  height: 100%;
  min-height: 400px;
  cursor: grab;
  user-select: none;
}

.base-grid.dragging {
  cursor: grabbing;
}

.grid-svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.grid-svg :deep(*) {
  pointer-events: auto;
}
</style>
