<script setup lang="ts">
import { CouncilPanel } from "./CouncilPanel";
import { GrantsPanel } from "./GrantsPanel";
import { PoliticsPanel } from "./PoliticsPanel";
import { VictoryProgressPanel } from "./VictoryProgressPanel";
</script>

<template>
  <div class="politics-tab">
    <VictoryProgressPanel />
    <GrantsPanel />
    <div class="politics-grid">
      <div class="politics-col">
        <PoliticsPanel />
      </div>
      <div class="politics-col">
        <CouncilPanel />
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

.politics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.politics-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 1400px) {
  .politics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .politics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
