<script setup lang="ts">
import { computed, ref } from "vue";
import { VueFlow, type Node, type Edge } from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { gameService } from "../services/GameService";
import type { Technology } from "../../core/models/Technology";
import TechNode from "./TechNode.vue";

const state = gameService.getState();

// Node positions - manually laid out for clear visualization
// Layout: X = branch position, Y = tier depth
const nodePositions: Record<string, { x: number; y: number }> = {
  // Early Tier (y: 0)
  hydroponics: { x: 0, y: 0 },
  water_recycling: { x: 200, y: 0 },
  advanced_materials: { x: 400, y: 0 },

  // Mid Tier (y: 150)
  genetics: { x: 0, y: 150 },
  robotics: { x: 400, y: 150 },
  nuclear_fission: { x: 600, y: 150 },

  // Late Tier (y: 300)
  advanced_medicine: { x: 0, y: 300 },
  cryosleep: { x: 150, y: 450 },
  life_extension: { x: -50, y: 450 },
  asteroid_mining: { x: 500, y: 300 },

  // Endgame Tier (y: 450-600)
  closed_ecosystem: { x: 100, y: 600 },
  fusion_drive: { x: 500, y: 450 },

  // Victory (y: 750)
  generation_ship: { x: 300, y: 750 },
};

type TechStatus = "researched" | "in_progress" | "available" | "locked";

function getTechStatus(tech: Technology): TechStatus {
  if (state.researchedTechs.some((t) => t.id === tech.id)) {
    return "researched";
  }
  if (state.currentResearch?.techId === tech.id) {
    return "in_progress";
  }
  if (state.availableTechs.some((t) => t.id === tech.id)) {
    return "available";
  }
  return "locked";
}

function getResearchProgress(tech: Technology): number {
  if (state.currentResearch?.techId === tech.id) {
    return (state.currentResearch.progress / state.currentResearch.requiredSols) * 100;
  }
  return 0;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const nodes = computed<Node[]>(() =>
  state.technologies.map((tech) => ({
    id: tech.id,
    type: "tech",
    position: nodePositions[tech.id] || { x: 0, y: 0 },
    data: {
      tech,
      status: getTechStatus(tech),
      progress: getResearchProgress(tech),
    },
  }))
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const edges = computed<Edge[]>(() => {
  const result: Edge[] = [];
  for (const tech of state.technologies) {
    for (const prereq of tech.prerequisites) {
      const prereqTech = state.technologies.find((t) => t.id === prereq);
      if (!prereqTech) continue;
      const sourceStatus = getTechStatus(prereqTech);
      const targetStatus = getTechStatus(tech);

      result.push({
        id: `${prereq}-${tech.id}`,
        source: prereq,
        target: tech.id,
        type: "smoothstep",
        animated: targetStatus === "in_progress",
        style: {
          stroke:
            sourceStatus === "researched"
              ? "var(--g-color-positive)"
              : "var(--g-color-border)",
          strokeWidth: sourceStatus === "researched" ? 2 : 1,
          opacity: targetStatus === "locked" ? 0.3 : 1,
        },
      });
    }
  }
  return result;
});

const selectedTech = ref<Technology | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onNodeClick(_event: MouseEvent, node: Node) {
  selectedTech.value = node.data.tech;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function startResearch() {
  if (selectedTech.value && gameService.canResearch(selectedTech.value.id)) {
    gameService.startResearch(selectedTech.value.id);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function cancelResearch() {
  gameService.cancelResearch();
  selectedTech.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatCost(tech: Technology): string {
  const parts = [`${tech.cost.sols} sols`];
  if (tech.cost.resources) {
    for (const [key, value] of Object.entries(tech.cost.resources)) {
      if (value) parts.push(`${value} ${key}`);
    }
  }
  return parts.join(", ");
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canResearch(techId: string): boolean {
  return gameService.canResearch(techId) && !state.currentResearch;
}
</script>

<template>
  <div class="tech-tree-container">
    <div class="graph-container">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ x: 50, y: 20, zoom: 0.8 }"
        :min-zoom="0.3"
        :max-zoom="1.5"
        fit-view-on-init
        @node-click="onNodeClick"
      >
        <template #node-tech="nodeProps">
          <TechNode v-bind="nodeProps" />
        </template>
      </VueFlow>
    </div>

    <div v-if="selectedTech" class="tech-details">
      <div class="details-header">
        <h3>{{ selectedTech.name }}</h3>
        <button class="close-btn" @click="selectedTech = null">x</button>
      </div>
      <p class="tech-desc">{{ selectedTech.description }}</p>
      <div class="tech-meta">
        <div class="meta-row">
          <span class="label">Cost:</span>
          <span class="value">{{ formatCost(selectedTech) }}</span>
        </div>
        <div v-if="selectedTech.unlocks.length > 0" class="meta-row">
          <span class="label">Unlocks:</span>
          <span class="value unlocks">{{ selectedTech.unlocks.join(", ") }}</span>
        </div>
        <div v-if="selectedTech.effects?.length" class="meta-row">
          <span class="label">Effects:</span>
          <span class="value effects">
            <span v-for="effect in selectedTech.effects" :key="effect.type">
              {{ effect.type }}: +{{ effect.value }}
            </span>
          </span>
        </div>
      </div>

      <div class="actions">
        <button
          v-if="canResearch(selectedTech.id)"
          class="research-btn"
          @click="startResearch"
        >
          Start Research
        </button>
        <button
          v-else-if="state.currentResearch?.techId === selectedTech.id"
          class="cancel-btn"
          @click="cancelResearch"
        >
          Cancel Research
        </button>
        <div
          v-else-if="state.researchedTechs.some((t) => t.id === selectedTech.id)"
          class="status-badge researched"
        >
          Researched
        </div>
        <div v-else class="status-badge locked">
          Locked
        </div>
      </div>

      <div v-if="state.currentResearch?.techId === selectedTech.id" class="progress-section">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${(state.currentResearch.progress / state.currentResearch.requiredSols) * 100}%` }"
          />
        </div>
        <span class="progress-text">
          {{ Math.floor(state.currentResearch.progress) }} / {{ state.currentResearch.requiredSols }} sols
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tech-tree-container {
  display: flex;
  height: 500px;
  gap: var(--g-space-md);
}

.graph-container {
  flex: 1;
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  overflow: hidden;
}

.graph-container :deep(.vue-flow) {
  background: radial-gradient(
    circle at center,
    oklch(20% 0.02 250 / 0.5) 0%,
    var(--g-color-bg) 100%
  );
}

.graph-container :deep(.vue-flow__edge-path) {
  stroke-linecap: round;
}

.tech-details {
  width: 280px;
  background: var(--g-color-bg-elevated);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  padding: var(--g-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.details-header h3 {
  margin: 0;
  color: var(--g-color-warning);
  font-family: var(--g-font-mono);
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

.tech-desc {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin: 0;
}

.tech-meta {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.meta-row {
  display: flex;
  gap: var(--g-space-sm);
  font-size: var(--g-font-size-xs);
}

.label {
  color: var(--g-color-text-muted);
  min-width: 60px;
}

.value {
  color: var(--g-color-text);
}

.value.unlocks {
  color: var(--g-color-positive);
}

.value.effects {
  color: var(--g-color-info);
}

.actions {
  margin-top: auto;
}

.research-btn {
  width: 100%;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-info);
  color: var(--g-color-bg);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.research-btn:hover {
  filter: brightness(1.1);
}

.cancel-btn {
  width: 100%;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-negative);
  color: var(--g-color-bg);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--g-font-mono);
}

.status-badge {
  text-align: center;
  padding: var(--g-space-sm);
  border-radius: 4px;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.status-badge.researched {
  background: oklch(70% 0.17 145 / 0.2);
  color: var(--g-color-positive);
  border: 1px solid var(--g-color-positive);
}

.status-badge.locked {
  background: oklch(50% 0.05 250 / 0.2);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.progress-bar {
  height: 8px;
  background: var(--g-color-bg);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--g-color-info);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-align: center;
}
</style>
