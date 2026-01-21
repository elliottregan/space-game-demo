<script setup lang="ts">
import TechnologyPanel from "./TechnologyPanel.vue";
import PoliticsPanel from "./PoliticsPanel.vue";
import OperationsPanel from "./OperationsPanel.vue";
import NPCInfluencePanel from "./NPCInfluencePanel.vue";
</script>

<template>
  <div class="strategy-tab">
    <div class="strategy-tab-left">
      <TechnologyPanel />
      <PoliticsPanel />
    </div>
    <div class="strategy-tab-right">
      <OperationsPanel />
      <NPCInfluencePanel />
    </div>
  </div>
</template>

<style scoped>
.strategy-tab {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.strategy-tab-left,
.strategy-tab-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .strategy-tab {
    grid-template-columns: 1fr;
  }
}
</style>
