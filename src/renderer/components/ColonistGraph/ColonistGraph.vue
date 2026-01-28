<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Colonist } from "../../../core/models/Colonist";
import type { CoworkerRelationship } from "../../../core/systems/WorkforceManager";
import { computeColonistForceLayout } from "../../utils/colonistForceLayout";
import {
  type ColonistGraphData,
  type ColonistGraphLink,
  type ColonistGraphNode,
  type RelationshipType,
  renderColonistGraph,
} from "./renderColonistGraph";

interface BuildingInfo {
  id: string;
  name: string;
  active: boolean;
  assignedWorkers: string[];
}

interface Props {
  colonists: Colonist[];
  relationships: Map<string, CoworkerRelationship>;
  buildings: BuildingInfo[];
  selectedColonistId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [colonistId: string | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

// Reactive dimensions from container
const dimensions = ref({ width: 600, height: 400 });

function updateDimensions() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dimensions.value = {
      width: Math.max(200, rect.width),
      height: Math.max(200, rect.height),
    };
  }
}

// Build relationship map for layout (just strengths)
const relationshipStrengths = computed(() => {
  const map = new Map<string, number>();
  for (const [key, rel] of props.relationships) {
    map.set(key, rel.strength);
  }
  return map;
});

// Compute force layout positions
const layoutPositions = computed(() => {
  return computeColonistForceLayout({
    colonists: props.colonists,
    relationships: relationshipStrengths.value,
    width: dimensions.value.width,
    height: dimensions.value.height,
  });
});

// Build coworker pairs from buildings
const coworkerPairs = computed(() => {
  const pairs = new Set<string>();
  for (const building of props.buildings) {
    if (!building.active || building.assignedWorkers.length < 2) continue;
    const workers = building.assignedWorkers;
    for (let i = 0; i < workers.length; i++) {
      for (let j = i + 1; j < workers.length; j++) {
        const key = [workers[i], workers[j]].sort().join(":");
        pairs.add(key);
      }
    }
  }
  return pairs;
});

// Build housemate pairs from colonist housing
const housematePairs = computed(() => {
  const pairs = new Set<string>();
  const housingGroups = new Map<string, string[]>();

  for (const colonist of props.colonists) {
    if (colonist.housingId) {
      const group = housingGroups.get(colonist.housingId) || [];
      group.push(colonist.id);
      housingGroups.set(colonist.housingId, group);
    }
  }

  for (const [, members] of housingGroups) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key = [members[i], members[j]].sort().join(":");
        pairs.add(key);
      }
    }
  }
  return pairs;
});

// Get building info for a colonist
function getColonistBuilding(colonistId: string): { name: string; active: boolean } | null {
  for (const building of props.buildings) {
    if (building.assignedWorkers.includes(colonistId)) {
      return { name: building.name, active: building.active };
    }
  }
  return null;
}

// Build graph data for rendering
const graphData = computed<ColonistGraphData>(() => {
  const positionMap = new Map(layoutPositions.value.map((p) => [p.id, p]));

  const nodes: ColonistGraphNode[] = props.colonists.map((colonist) => {
    const pos = positionMap.get(colonist.id) ?? { x: 0, y: 0 };
    const buildingInfo = getColonistBuilding(colonist.id);
    return {
      id: colonist.id,
      x: pos.x,
      y: pos.y,
      colonist,
      isWorking: buildingInfo?.active ?? false,
      buildingName: buildingInfo?.name,
    };
  });

  // Determine relationship type for each link
  const links: ColonistGraphLink[] = [];
  const processedPairs = new Set<string>();

  for (const [key, rel] of props.relationships) {
    if (rel.strength < 0.05) continue;
    processedPairs.add(key);

    const [id1, id2] = key.split(":");
    const isCoworker = coworkerPairs.value.has(key);
    const isHousemate = housematePairs.value.has(key);

    let type: RelationshipType = "coworker";
    if (isCoworker && isHousemate) {
      type = "both";
    } else if (isHousemate) {
      type = "housemate";
    }

    links.push({
      source: id1!,
      target: id2!,
      weight: rel.strength,
      type,
    });
  }

  return { nodes, links };
});

// Render when data changes
function render() {
  if (!svgRef.value) return;

  renderColonistGraph(svgRef.value, graphData.value, {
    width: dimensions.value.width,
    height: dimensions.value.height,
    selectedId: props.selectedColonistId,
    onNodeClick: (id) => emit("select", id),
  });
}

// ResizeObserver to track container size changes
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

watch([graphData, () => props.selectedColonistId], render);
watch(dimensions, render);
</script>

<template>
  <div ref="containerRef" class="colonist-graph">
    <svg ref="svgRef" class="graph-svg" />

    <!-- Legend -->
    <div class="legend">
      <div class="legend-section">
        <span class="legend-title">Roles:</span>
        <div class="legend-item">
          <span class="legend-dot research" />
          <span>Research</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot engineering" />
          <span>Engineering</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot farming" />
          <span>Farming</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot civil_science" />
          <span>Civil Science</span>
        </div>
      </div>
      <div class="legend-divider" />
      <div class="legend-section">
        <span class="legend-title">Links:</span>
        <div class="legend-item">
          <span class="legend-line coworker" />
          <span>Coworkers</span>
        </div>
        <div class="legend-item">
          <span class="legend-line housemate" />
          <span>Housemates</span>
        </div>
        <div class="legend-item">
          <span class="legend-line both" />
          <span>Both</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.colonist-graph {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 250px;
  background: var(--g-color-bg-base);
  overflow: hidden;
}

.graph-svg {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--g-color-bg-surface);
}

.legend {
  position: absolute;
  bottom: var(--g-space-sm);
  left: var(--g-space-sm);
  display: flex;
  gap: var(--g-space-md);
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-base);
  border: var(--g-border-width) solid var(--g-color-border-strong);
  font-size: var(--g-font-size-xs);
  font-family: var(--g-font-mono);
}

.legend-section {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.legend-title {
  color: var(--g-color-text-muted);
  margin-right: var(--g-space-xs);
}

.legend-divider {
  width: 1px;
  height: 20px;
  background: var(--g-color-border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.research {
  background: var(--g-color-info);
}

.legend-dot.engineering {
  background: var(--g-color-warning);
}

.legend-dot.farming {
  background: var(--g-color-positive);
}

.legend-dot.civil_science {
  background: #9c27b0;
}

.legend-line {
  width: 20px;
  height: 3px;
  border-radius: 1px;
}

.legend-line.coworker {
  background: var(--g-color-warning);
}

.legend-line.housemate {
  background: var(--g-color-info);
  background: repeating-linear-gradient(
    90deg,
    var(--g-color-info) 0px,
    var(--g-color-info) 4px,
    transparent 4px,
    transparent 7px
  );
}

.legend-line.both {
  background: var(--g-color-positive);
}
</style>
