<!-- src/renderer/components/VictoryProgressPanel/VictoryProgressPanel.vue -->
<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import FactionTrack from "./FactionTrack.vue";

const state = gameService.getState();
</script>

<template>
  <GPanel title="Victory Progress" accent="slate">
    <div class="victory-grid">
      <FactionTrack
        v-for="faction in state.ideology.factions"
        :key="faction.id"
        :faction="faction"
      />
    </div>
    <p class="hint">
      Fund identity grants in districts &rarr; Build axis progress &rarr; Complete prerequisites
      &rarr; Unlock capstone &rarr; Build megastructure to win!
    </p>
  </GPanel>
</template>

<style scoped>
.victory-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--g-space-md);
}

@media (max-width: 1200px) {
  .victory-grid {
    grid-template-columns: 1fr;
  }
}

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}
</style>
