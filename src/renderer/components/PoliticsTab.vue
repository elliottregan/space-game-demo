<script setup lang="ts">
import { PoliticsPanel } from "./PoliticsPanel";
import { NPCInfluencePanel } from "./NPCInfluencePanel";
import { OperationsPanel } from "./OperationsPanel";
import NPCRelationshipGraph from "./NPCRelationshipGraph.vue";
import { GPanel } from "../ui";
</script>

<template>
  <div class="politics-tab">
    <div class="politics-top">
      <GPanel title="NPC Relationships" class="relationship-panel">
        <NPCRelationshipGraph />
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

.politics-bottom {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.politics-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 1200px) {
  .politics-bottom {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .politics-top {
    height: 300px;
  }

  .politics-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
