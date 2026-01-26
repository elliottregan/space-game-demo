<script setup lang="ts">
import { computed, ref } from "vue";
import type { NPC } from "../../core/models/NPCInfluence";
import { gameService } from "../services/GameService";
import { GPanel } from "../ui";
import { CouncilPanel } from "./CouncilPanel";
import { NPCDetailPanel, NPCGraph } from "./NPCGraph";
import { NPCInfluencePanel } from "./NPCInfluencePanel";
import { OperationsPanel } from "./OperationsPanel";
import { PoliticsPanel } from "./PoliticsPanel";

const state = gameService.getState();

const selectedNpcId = ref<string | null>(null);

const selectedNpc = computed(() => {
  if (!selectedNpcId.value) return null;
  return state.npcInfluence.npcs.find((n) => n.id === selectedNpcId.value) ?? null;
});

// Build relationships for selected NPC
// biome-ignore lint/correctness/noUnusedVariables: used in template
const selectedRelationships = computed(() => {
  if (!selectedNpc.value) return [];

  const npcs = state.npcInfluence.npcs;
  const matrix = state.npcInfluence.relationshipMatrix;
  const selectedIndex = npcs.findIndex((n) => n.id === selectedNpc.value?.id);

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

// Get support level for selected NPC
// biome-ignore lint/correctness/noUnusedVariables: used in template
const selectedSupportLevel = computed(() => {
  if (!selectedNpc.value || !state.npcInfluence.activeProject) return null;
  return state.npcInfluence.activeProject.supportLevels[selectedNpc.value.id] ?? null;
});
</script>

<template>
  <div class="politics-tab">
    <div class="politics-top">
      <GPanel title="NPC Relationships" class="relationship-panel">
        <div class="graph-container">
          <NPCGraph
            :npcs="state.npcInfluence.npcs"
            :relationship-matrix="state.npcInfluence.relationshipMatrix"
            :councils="state.npcInfluence.councils"
            :active-project-support="state.npcInfluence.activeProject?.supportLevels ?? null"
            :selected-npc-id="selectedNpcId"
            @select="selectedNpcId = $event"
          />
          <NPCDetailPanel
            v-if="selectedNpc"
            :npc="selectedNpc"
            :support-level="selectedSupportLevel"
            :relationships="selectedRelationships"
            :councils="state.npcInfluence.councils"
            @close="selectedNpcId = null"
          />
        </div>
      </GPanel>
    </div>

    <div class="politics-bottom">
      <div class="politics-col">
        <PoliticsPanel />
      </div>
      <div class="politics-col">
        <NPCInfluencePanel />
      </div>
      <div class="politics-col">
        <CouncilPanel />
      </div>
      <div class="politics-col">
        <OperationsPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.politics-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.politics-top {
  height: 400px;
}

.relationship-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.relationship-panel :deep(.g-panel__body) {
  flex: 1;
  min-height: 0;
  padding: var(--g-space-sm);
  overflow: hidden;
}

.graph-container {
  display: flex;
  gap: var(--g-space-md);
  height: 100%;
}

.graph-container > :first-child {
  flex: 1;
}

.politics-bottom {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.politics-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 1400px) {
  .politics-bottom {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .politics-top {
    height: auto;
    min-height: 300px;
  }

  .politics-bottom {
    grid-template-columns: 1fr;
  }

  .graph-container {
    flex-direction: column;
    height: auto;
  }

  .graph-container > :first-child {
    flex: none;
    height: 300px;
  }
}
</style>
