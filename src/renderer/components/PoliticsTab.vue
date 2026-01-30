<script setup lang="ts">
import { gameService } from "../services/GameService";
import { CouncilPanel } from "./CouncilPanel";
import { OperationsPanel } from "./OperationsPanel";
import { PoliticsPanel } from "./PoliticsPanel";

const state = gameService.getState();
</script>

<template>
  <div class="politics-tab">
    <div class="politics-grid">
      <div class="politics-col">
        <PoliticsPanel />
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

.politics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
