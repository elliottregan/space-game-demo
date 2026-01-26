<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { GPanel, GProgress } from "../../ui";
import { getHealthVariant, getMoraleVariant } from "../../utils/displayThresholds";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const state = gameService.getState();
</script>

<template>
  <GPanel title="Colony Overview">
    <div class="stats-bar">
      <div class="stat">
        <span class="label">Population</span>
        <span class="value">{{ state.population }}</span>
      </div>
      <div class="stat">
        <span class="label">Health</span>
        <GProgress
          :value="state.health"
          :max="100"
          :variant="getHealthVariant(state.health)"
          show-label
        />
      </div>
      <div class="stat">
        <span class="label">Morale</span>
        <GProgress
          :value="state.morale"
          :max="100"
          :variant="getMoraleVariant(state.morale)"
          show-label
        />
      </div>
      <div class="stat" v-if="state.moraleBoost > 0">
        <span class="label">Recreation Bonus</span>
        <span class="value positive">+{{ state.moraleBoost }}</span>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.stats-bar {
  display: flex;
  gap: var(--g-space-xl);
  align-items: center;
  flex-wrap: wrap;
  font-family: var(--g-font-mono);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  min-width: 100px;
}

.label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.value {
  font-size: var(--g-font-size-lg);
  font-weight: bold;
}

.value.positive {
  color: var(--g-color-positive);
}
</style>
