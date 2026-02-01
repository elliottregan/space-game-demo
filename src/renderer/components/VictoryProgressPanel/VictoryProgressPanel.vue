<!-- src/renderer/components/VictoryProgressPanel/VictoryProgressPanel.vue -->
<script setup lang="ts">
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { GPanel } from "../../ui";
import FactionTrack from "./FactionTrack.vue";

const factions = [
  NPCFaction.EarthLoyalists,
  NPCFaction.MarsIndependence,
  NPCFaction.CorporateInterests,
];
</script>

<template>
  <GPanel title="Victory Progress" accent="slate">
    <div class="victory-grid">
      <FactionTrack v-for="faction in factions" :key="faction" :faction="faction" />
    </div>
    <p class="hint">
      Pass 3 faction projects, then secure 65% of council seats to propose the capstone victory
      project.
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
