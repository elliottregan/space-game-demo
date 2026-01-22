<script setup lang="ts">
import { gameService } from "../services/GameService";
import { GButton } from "../ui";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function newGame(): void {
  gameService.newGame();
}
</script>

<template>
  <div class="game-over-overlay">
    <div class="game-over-modal" :class="state.victoryState.status">
      <div class="icon">
        {{ state.victoryState.status === 'victory' ? '🎉' : '💀' }}
      </div>
      <h1>{{ state.victoryState.status === 'victory' ? 'Victory!' : 'Defeat' }}</h1>
      <p class="reason">{{ state.victoryState.reason }}</p>

      <div class="stats">
        <div class="stat">
          <span class="stat-label">Final Sol</span>
          <span class="stat-value">{{ state.currentSol }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Population</span>
          <span class="stat-value">{{ state.population }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Buildings</span>
          <span class="stat-value">{{ state.buildings.length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Technologies</span>
          <span class="stat-value">{{ state.researchedTechs.length }}</span>
        </div>
      </div>

      <GButton variant="primary" @click="newGame">
        Start New Game
      </GButton>
    </div>
  </div>
</template>

<style scoped>
.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: oklch(10% 0.02 250 / 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.game-over-modal {
  background: var(--g-color-bg-surface);
  border-radius: 8px;
  padding: var(--g-space-xl);
  max-width: 450px;
  width: 90%;
  text-align: center;
  border: 3px solid;
}

.game-over-modal.victory {
  border-color: var(--g-color-positive);
  box-shadow: 0 0 80px oklch(70% 0.17 145 / 0.4);
}

.game-over-modal.defeat {
  border-color: var(--g-color-negative);
  box-shadow: 0 0 80px oklch(60% 0.2 25 / 0.4);
}

.icon {
  font-size: 5rem;
  margin-bottom: var(--g-space-md);
}

h1 {
  font-family: var(--g-font-mono);
  font-size: 2.5rem;
  margin-bottom: var(--g-space-md);
}

.victory h1 {
  color: var(--g-color-positive);
}

.defeat h1 {
  color: var(--g-color-negative);
}

.reason {
  color: var(--g-color-text);
  font-size: 1.1rem;
  margin-bottom: var(--g-space-xl);
  line-height: 1.6;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--g-space-md);
  margin-bottom: var(--g-space-xl);
}

.stat {
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  padding: var(--g-space-md);
}

.stat-label {
  display: block;
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

.stat-value {
  display: block;
  font-family: var(--g-font-mono);
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--g-color-warning);
}
</style>
