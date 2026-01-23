<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { NPC } from "../../../core/models/NPCInfluence";
import { computeForceLayout } from "../../utils/forceLayout";
import { renderGraph, type GraphData, type GraphNode, type GraphLink } from "./renderGraph";

interface Props {
  npcs: NPC[];
  relationshipMatrix: number[][];
  councils: { id: string; memberIds: string[] }[];
  activeProjectSupport: Record<string, number> | null;
  selectedNpcId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [npcId: string | null];
}>();

const svgRef = ref<SVGSVGElement | null>(null);

const GRAPH_WIDTH = 600;
const GRAPH_HEIGHT = 400;

// Compute force layout positions
const layoutPositions = computed(() => {
  return computeForceLayout({
    npcs: props.npcs,
    relationshipMatrix: props.relationshipMatrix,
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
  });
});

// Check if NPC is in a council
function isInCouncil(npcId: string): boolean {
  return props.councils.some((c) => c.memberIds.includes(npcId));
}

// Check if two NPCs are in the same council
function areInSameCouncil(id1: string, id2: string): boolean {
  return props.councils.some(
    (c) => c.memberIds.includes(id1) && c.memberIds.includes(id2)
  );
}

// Build graph data for rendering
const graphData = computed<GraphData>(() => {
  const positionMap = new Map(layoutPositions.value.map((p) => [p.id, p]));

  const nodes: GraphNode[] = props.npcs.map((npc) => {
    const pos = positionMap.get(npc.id) ?? { x: 0, y: 0 };
    return {
      id: npc.id,
      x: pos.x,
      y: pos.y,
      npc,
      supportLevel: props.activeProjectSupport?.[npc.id] ?? null,
      inCouncil: isInCouncil(npc.id),
    };
  });

  const links: GraphLink[] = [];
  for (let i = 0; i < props.npcs.length; i++) {
    for (let j = i + 1; j < props.npcs.length; j++) {
      const weight =
        (props.relationshipMatrix[i]?.[j] ?? 0) +
        (props.relationshipMatrix[j]?.[i] ?? 0);
      if (weight < 0.1) continue;

      links.push({
        source: props.npcs[i].id,
        target: props.npcs[j].id,
        weight: weight / 2,
        inSameCouncil: areInSameCouncil(props.npcs[i].id, props.npcs[j].id),
      });
    }
  }

  return { nodes, links };
});

// Render when data changes
function render() {
  if (!svgRef.value) return;

  renderGraph(svgRef.value, graphData.value, {
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
    selectedId: props.selectedNpcId,
    onNodeClick: (id) => emit("select", id),
  });
}

onMounted(render);

watch([graphData, () => props.selectedNpcId], render);
</script>

<template>
  <div class="npc-graph">
    <svg ref="svgRef" class="graph-svg" />

    <!-- Faction Legend -->
    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot futurist" />
        <span>Futurist</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot progressive" />
        <span>Progressive</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot traditionalist" />
        <span>Traditionalist</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.npc-graph {
  position: relative;
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  overflow: hidden;
}

.graph-svg {
  display: block;
  background: radial-gradient(
    circle at center,
    oklch(20% 0.02 280 / 0.3) 0%,
    var(--g-color-bg) 100%
  );
}

.legend {
  position: absolute;
  bottom: var(--g-space-sm);
  left: var(--g-space-sm);
  display: flex;
  gap: var(--g-space-md);
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  font-size: var(--g-font-size-xs);
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

.legend-dot.futurist {
  background: #60a5fa;
}

.legend-dot.progressive {
  background: #4ade80;
}

.legend-dot.traditionalist {
  background: #fbbf24;
}
</style>
