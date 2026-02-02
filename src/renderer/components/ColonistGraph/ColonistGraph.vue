<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Colonist } from "../../../core/models/Colonist";
import type { Guild } from "../../../core/models/Guild";
import { WEAK_TIE_THRESHOLD } from "../../../core/balance/WorkforceBalance";
import type { CoworkerRelationship } from "../../../core/systems/WorkforceManager";
import { ColonistSimulationManager } from "../../utils/ColonistSimulationManager";
import {
  type ColonistGraphData,
  type ColonistGraphLink,
  type ColonistGraphNode,
  type IdeologyPressureData,
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
  guilds: Guild[];
  selectedColonistId: string | null;
  ideologyPressures?: Map<string, IdeologyPressureData>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [colonistId: string | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

// Display options
const showWeakTies = ref(false);

// Reactive dimensions from container
const dimensions = ref({ width: 600, height: 400 });

function updateDimensions() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dimensions.value = {
      width: Math.max(200, rect.width),
      height: Math.max(200, rect.height),
    };
    simulationManager?.resize(dimensions.value.width, dimensions.value.height);
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

// Simulation manager
let simulationManager: ColonistSimulationManager | null = null;

// Reactive positions from simulation
const layoutPositions = ref<{ id: string; x: number; y: number }[]>([]);

function updateSimulation() {
  if (!simulationManager) return;
  simulationManager.update(props.colonists, relationshipStrengths.value);
  layoutPositions.value = simulationManager.getPositions();
  simulationManager.startAnimation();
}

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

// Count connections per colonist
const connectionCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const colonist of props.colonists) {
    counts.set(colonist.id, 0);
  }
  for (const [key, rel] of props.relationships) {
    if (rel.strength < 0.05) continue;
    const [id1, id2] = key.split(":");
    if (id1) counts.set(id1, (counts.get(id1) ?? 0) + 1);
    if (id2) counts.set(id2, (counts.get(id2) ?? 0) + 1);
  }
  return counts;
});

// Detect bridge colonists (connect otherwise disconnected groups using weak ties)
const bridgeColonists = computed(() => {
  const bridges = new Set<string>();

  // A bridge colonist has at least one weak tie and connects colonists
  // who don't share other connections
  for (const [key, rel] of props.relationships) {
    if (rel.strength >= WEAK_TIE_THRESHOLD) continue; // Only weak ties can be bridges
    if (rel.strength < 0.05) continue;

    const [id1, id2] = key.split(":");
    if (!id1 || !id2) continue;

    // Check if these colonists share other strong connections
    const id1Connections = new Set<string>();
    const id2Connections = new Set<string>();

    for (const [otherKey, otherRel] of props.relationships) {
      if (otherRel.strength < WEAK_TIE_THRESHOLD) continue;
      const [a, b] = otherKey.split(":");
      if (!a || !b) continue;
      if (a === id1) id1Connections.add(b);
      if (b === id1) id1Connections.add(a);
      if (a === id2) id2Connections.add(b);
      if (b === id2) id2Connections.add(a);
    }

    // If id1's strong connections don't overlap with id2's, both are bridges
    const overlap = [...id1Connections].filter((c) => id2Connections.has(c));
    if (overlap.length === 0) {
      bridges.add(id1);
      bridges.add(id2);
    }
  }

  return bridges;
});

// Build guild membership lookup
const guildMembership = computed(() => {
  const membership = new Map<string, string[]>();
  for (const colonist of props.colonists) {
    membership.set(colonist.id, []);
  }
  for (const guild of props.guilds) {
    for (const memberId of guild.memberIds) {
      const guilds = membership.get(memberId) ?? [];
      guilds.push(guild.id);
      membership.set(memberId, guilds);
    }
  }
  return membership;
});

// Check if two colonists share a guild
function getSharedGuildIds(id1: string, id2: string): string[] {
  const guilds1 = guildMembership.value.get(id1) ?? [];
  const guilds2 = guildMembership.value.get(id2) ?? [];
  return guilds1.filter((g) => guilds2.includes(g));
}

// Build graph data for rendering
const graphData = computed<ColonistGraphData>(() => {
  const positionMap = new Map(layoutPositions.value.map((p) => [p.id, p]));

  const nodes: ColonistGraphNode[] = props.colonists.map((colonist) => {
    const pos = positionMap.get(colonist.id) ?? { x: 0, y: 0 };
    const buildingInfo = getColonistBuilding(colonist.id);
    const guildCount = guildMembership.value.get(colonist.id)?.length ?? 0;
    const ideologyPressure = props.ideologyPressures?.get(colonist.id) ?? null;

    return {
      id: colonist.id,
      x: pos.x,
      y: pos.y,
      colonist,
      isWorking: buildingInfo?.active ?? false,
      buildingName: buildingInfo?.name,
      guildCount,
      isBridge: bridgeColonists.value.has(colonist.id),
      connectionCount: connectionCounts.value.get(colonist.id) ?? 0,
      ideologyPressure,
    };
  });

  // Determine relationship type for each link
  const links: ColonistGraphLink[] = [];

  for (const [key, rel] of props.relationships) {
    if (rel.strength < 0.05) continue;

    const [id1, id2] = key.split(":");
    if (!id1 || !id2) continue;

    const isCoworker = coworkerPairs.value.has(key);
    const isHousemate = housematePairs.value.has(key);
    const sharedGuilds = getSharedGuildIds(id1, id2);
    const hasSharedGuild = sharedGuilds.length > 0;
    const isWeakTie = rel.strength < WEAK_TIE_THRESHOLD;
    const isCohort = rel.isCohort ?? false;

    // Determine relationship type
    let type: RelationshipType;
    if (isCoworker && isHousemate) {
      type = "both";
    } else if (isHousemate) {
      type = "housemate";
    } else if (isCoworker) {
      type = "coworker";
    } else if (hasSharedGuild) {
      type = "guild";
    } else {
      type = "social";
    }

    links.push({
      source: id1,
      target: id2,
      weight: rel.strength,
      type,
      isWeakTie,
      isCohort,
      hasSharedGuild,
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
    showWeakTies: showWeakTies.value,
  });
}

// ResizeObserver to track container size changes
let resizeObserver: ResizeObserver | null = null;
let resizeFrameId: number | null = null;

onMounted(() => {
  updateDimensions();

  // Create simulation manager
  simulationManager = new ColonistSimulationManager(
    dimensions.value.width,
    dimensions.value.height,
  );

  // Set up tick callback for animation
  simulationManager.setOnTick(() => {
    if (simulationManager) {
      layoutPositions.value = simulationManager.getPositions();
    }
  });

  // Initial update
  updateSimulation();
  render();

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      // Throttle resize handling with requestAnimationFrame
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
  resizeObserver?.disconnect();
  if (resizeFrameId !== null) {
    cancelAnimationFrame(resizeFrameId);
  }
  simulationManager?.destroy();
  simulationManager = null;
});

watch([() => props.colonists, relationshipStrengths], updateSimulation, { deep: true });
watch([graphData, () => props.selectedColonistId, showWeakTies], render);
watch(dimensions, render);
</script>

<template>
  <div ref="containerRef" class="colonist-graph">
    <svg ref="svgRef" class="graph-svg" />

    <!-- Legend -->
    <div class="legend">
      <div class="legend-section">
        <span class="legend-title">Ideology:</span>
        <div class="legend-item">
          <span class="legend-dot earth-loyalist" />
          <span>Earth</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot mars-independence" />
          <span>Mars</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot corporate" />
          <span>Corporate</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot neutral" />
          <span>Neutral</span>
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
        <div class="legend-item">
          <span class="legend-line guild" />
          <span>Guild</span>
        </div>
        <label class="legend-item legend-checkbox">
          <input v-model="showWeakTies" type="checkbox" />
          <span class="legend-line weak" />
          <span>Weak Ties</span>
        </label>
      </div>
      <div class="legend-divider" />
      <div class="legend-section">
        <span class="legend-title">Badges:</span>
        <div class="legend-item">
          <span class="legend-badge guild-badge">2</span>
          <span>Guilds</span>
        </div>
        <div class="legend-item">
          <span class="legend-ring bridge" />
          <span>Bridge</span>
        </div>
      </div>
      <div class="legend-divider" />
      <div class="legend-section">
        <span class="legend-title">Pressure:</span>
        <div class="legend-item">
          <span class="legend-arrow" />
          <span>Ideology</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.colonist-graph {
  position: relative;
  width: 100%;
  min-height: 500px;
  max-height: 680px;
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

.legend-dot.earth-loyalist {
  background: var(--g-color-info);
}

.legend-dot.mars-independence {
  background: var(--g-color-positive);
}

.legend-dot.corporate {
  background: var(--g-color-warning);
}

.legend-dot.neutral {
  background: var(--g-color-text-muted);
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

.legend-line.guild {
  background: repeating-linear-gradient(
    90deg,
    #9c27b0 0px,
    #9c27b0 3px,
    transparent 3px,
    transparent 5px
  );
}

.legend-line.weak {
  background: repeating-linear-gradient(
    90deg,
    var(--g-color-text-muted) 0px,
    var(--g-color-text-muted) 2px,
    transparent 2px,
    transparent 5px
  );
  height: 1px;
}

.legend-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  font-size: 8px;
  font-weight: bold;
}

.legend-badge.guild-badge {
  background: #9c27b0;
  color: white;
}

.legend-ring {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px dashed #9c27b0;
  opacity: 0.7;
}

.legend-arrow {
  position: relative;
  width: 16px;
  height: 14px;
}

.legend-arrow::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 0;
  width: 2px;
  height: 10px;
  background: repeating-linear-gradient(
    180deg,
    var(--g-color-text-muted) 0px,
    var(--g-color-text-muted) 3px,
    transparent 3px,
    transparent 5px
  );
}

.legend-arrow::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--g-color-text-muted);
}

.legend-checkbox {
  cursor: pointer;
}

.legend-checkbox input {
  width: 12px;
  height: 12px;
  margin: 0;
  cursor: pointer;
}
</style>
