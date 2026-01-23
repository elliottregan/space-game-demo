<script setup lang="ts">
import { computed, ref } from "vue";
import { VueFlow, type Node, type Edge } from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { gameService } from "../services/GameService";
import type { NPC, NPCFaction } from "../../core/models/NPCInfluence";
import NPCNode from "./NPCNode.vue";

const state = gameService.getState();

const selectedNPC = ref<NPC | null>(null);

// Faction colors
const factionColors: Record<NPCFaction, string> = {
  futurist: "var(--g-color-info)",
  progressive: "var(--g-color-positive)",
  traditionalist: "var(--g-color-warning)",
};

// Position NPCs in faction clusters
function getNodePosition(npc: NPC, index: number): { x: number; y: number } {
  const factionPositions: Record<NPCFaction, { baseX: number; baseY: number }> = {
    futurist: { baseX: 400, baseY: 50 },
    progressive: { baseX: 100, baseY: 250 },
    traditionalist: { baseX: 500, baseY: 350 },
  };

  const base = factionPositions[npc.faction];
  const factionNPCs = state.npcInfluence.npcs.filter((n) => n.faction === npc.faction);
  const factionIndex = factionNPCs.findIndex((n) => n.id === npc.id);

  // Arrange in a small cluster
  const angle = (factionIndex / factionNPCs.length) * Math.PI * 2;
  const radius = 80;

  return {
    x: base.baseX + Math.cos(angle) * radius,
    y: base.baseY + Math.sin(angle) * radius,
  };
}

// Check if NPC is in a council
function isInCouncil(npcId: string): boolean {
  return state.npcInfluence.councils.some((c) => c.memberIds.includes(npcId));
}

// Get support level for active project
function getSupportLevel(npcId: string): number | null {
  if (!state.npcInfluence.activeProject) return null;
  return state.npcInfluence.activeProject.supportLevels[npcId] ?? null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const nodes = computed<Node[]>(() =>
  state.npcInfluence.npcs.map((npc, index) => ({
    id: npc.id,
    type: "npc",
    position: getNodePosition(npc, index),
    data: {
      npc,
      color: factionColors[npc.faction],
      inCouncil: isInCouncil(npc.id),
      supportLevel: getSupportLevel(npc.id),
    },
  })),
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const edges = computed<Edge[]>(() => {
  const result: Edge[] = [];
  const npcs = state.npcInfluence.npcs;
  const matrix = state.npcInfluence.relationshipMatrix;

  for (let i = 0; i < npcs.length; i++) {
    for (let j = 0; j < npcs.length; j++) {
      if (i === j) continue;

      const weight = matrix[i]?.[j] ?? 0;
      if (weight < 0.1) continue; // Skip very weak relationships

      // Check if both are in the same council
      const inSameCouncil = state.npcInfluence.councils.some(
        (c) => c.memberIds.includes(npcs[i].id) && c.memberIds.includes(npcs[j].id),
      );

      result.push({
        id: `${npcs[j].id}-${npcs[i].id}`,
        source: npcs[j].id,
        target: npcs[i].id,
        type: "default",
        animated: inSameCouncil,
        style: {
          stroke: inSameCouncil ? "var(--g-color-positive)" : "var(--g-color-border)",
          strokeWidth: Math.max(1, weight * 4),
          opacity: Math.max(0.2, weight),
        },
        markerEnd: {
          type: "arrowclosed",
          color: inSameCouncil ? "var(--g-color-positive)" : "var(--g-color-border)",
        },
      });
    }
  }
  return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onNodeClick(_event: MouseEvent, node: Node) {
  selectedNPC.value = node.data.npc;
}

// Get relationships for selected NPC
// biome-ignore lint/correctness/noUnusedVariables: used in template
const selectedRelationships = computed(() => {
  if (!selectedNPC.value) return [];

  const npcs = state.npcInfluence.npcs;
  const matrix = state.npcInfluence.relationshipMatrix;
  const selectedIndex = npcs.findIndex((n) => n.id === selectedNPC.value?.id);

  if (selectedIndex === -1) return [];

  const relationships: { npc: NPC; influenceFrom: number; influenceTo: number }[] = [];

  for (let i = 0; i < npcs.length; i++) {
    if (i === selectedIndex) continue;

    const influenceFrom = matrix[selectedIndex]?.[i] ?? 0;
    const influenceTo = matrix[i]?.[selectedIndex] ?? 0;

    if (influenceFrom > 0.05 || influenceTo > 0.05) {
      relationships.push({
        npc: npcs[i],
        influenceFrom,
        influenceTo,
      });
    }
  }

  return relationships.sort(
    (a, b) => b.influenceFrom + b.influenceTo - (a.influenceFrom + a.influenceTo),
  );
});
</script>

<template>
  <div class="npc-graph-container">
    <div class="graph-wrapper">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ x: 50, y: 20, zoom: 0.9 }"
        :min-zoom="0.4"
        :max-zoom="1.5"
        fit-view-on-init
        @node-click="onNodeClick"
      >
        <template #node-npc="nodeProps">
          <NPCNode v-bind="nodeProps" />
        </template>
      </VueFlow>

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

    <div v-if="selectedNPC" class="npc-details">
      <div class="details-header">
        <h3>{{ selectedNPC.name }}</h3>
        <button class="close-btn" @click="selectedNPC = null">x</button>
      </div>

      <div class="npc-meta">
        <div class="meta-row">
          <span class="label">Faction:</span>
          <span class="value faction" :class="selectedNPC.faction">
            {{ selectedNPC.faction }}
          </span>
        </div>
        <div class="meta-row">
          <span class="label">Influence:</span>
          <span class="value">{{ selectedNPC.influence.toFixed(1) }}x</span>
        </div>
        <div v-if="getSupportLevel(selectedNPC.id) !== null" class="meta-row">
          <span class="label">Support:</span>
          <span
            class="value"
            :class="{
              positive: getSupportLevel(selectedNPC.id)! > 0,
              negative: getSupportLevel(selectedNPC.id)! < 0,
            }"
          >
            {{ (getSupportLevel(selectedNPC.id)! * 100).toFixed(0) }}%
          </span>
        </div>
      </div>

      <div v-if="selectedRelationships.length > 0" class="relationships">
        <h4>Relationships</h4>
        <div class="relationship-list">
          <div
            v-for="rel in selectedRelationships"
            :key="rel.npc.id"
            class="relationship-item"
          >
            <span class="rel-name">{{ rel.npc.name }}</span>
            <div class="rel-bars">
              <div class="rel-bar">
                <span class="rel-label">From</span>
                <div class="bar-track">
                  <div
                    class="bar-fill from"
                    :style="{ width: `${rel.influenceFrom * 100}%` }"
                  />
                </div>
                <span class="rel-value">{{ (rel.influenceFrom * 100).toFixed(0) }}%</span>
              </div>
              <div class="rel-bar">
                <span class="rel-label">To</span>
                <div class="bar-track">
                  <div
                    class="bar-fill to"
                    :style="{ width: `${rel.influenceTo * 100}%` }"
                  />
                </div>
                <span class="rel-value">{{ (rel.influenceTo * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.npc-graph-container {
  display: flex;
  height: 100%;
  gap: var(--g-space-md);
}

.graph-wrapper {
  flex: 1;
  position: relative;
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  overflow: hidden;
}

.graph-wrapper :deep(.vue-flow) {
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
  background: var(--g-color-info);
}

.legend-dot.progressive {
  background: var(--g-color-positive);
}

.legend-dot.traditionalist {
  background: var(--g-color-warning);
}

.npc-details {
  width: 260px;
  background: var(--g-color-bg-elevated);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  padding: var(--g-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  overflow-y: auto;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.details-header h3 {
  margin: 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
}

.close-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0 var(--g-space-xs);
}

.close-btn:hover {
  color: var(--g-color-text);
}

.npc-meta {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.label {
  color: var(--g-color-text-muted);
}

.value.faction {
  text-transform: capitalize;
}

.value.faction.futurist {
  color: var(--g-color-info);
}

.value.faction.progressive {
  color: var(--g-color-positive);
}

.value.faction.traditionalist {
  color: var(--g-color-warning);
}

.value.positive {
  color: var(--g-color-positive);
}

.value.negative {
  color: var(--g-color-negative);
}

.relationships {
  margin-top: var(--g-space-sm);
}

.relationships h4 {
  margin: 0 0 var(--g-space-xs);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  border-bottom: 1px solid var(--g-color-border);
  padding-bottom: var(--g-space-xs);
}

.relationship-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.relationship-item {
  font-size: var(--g-font-size-xs);
}

.rel-name {
  font-weight: 500;
  display: block;
  margin-bottom: 2px;
}

.rel-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rel-bar {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.rel-label {
  width: 30px;
  color: var(--g-color-text-muted);
}

.bar-track {
  flex: 1;
  height: 6px;
  background: var(--g-color-bg);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.bar-fill.from {
  background: var(--g-color-info);
}

.bar-fill.to {
  background: var(--g-color-positive);
}

.rel-value {
  width: 35px;
  text-align: right;
  color: var(--g-color-text-muted);
}
</style>
