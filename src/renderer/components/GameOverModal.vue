<script setup lang="ts">
import { gameService } from "../services/GameService";

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

      <button class="btn btn-primary new-game-btn" @click="newGame">
        Start New Game
      </button>
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
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.game-over-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 20px;
  padding: 3rem;
  max-width: 450px;
  width: 90%;
  text-align: center;
  border: 3px solid;
}

.game-over-modal.victory {
  border-color: #4ade80;
  box-shadow: 0 0 80px rgba(74, 222, 128, 0.4);
}

.game-over-modal.defeat {
  border-color: #f87171;
  box-shadow: 0 0 80px rgba(248, 113, 113, 0.4);
}

.icon {
  font-size: 5rem;
  margin-bottom: 1rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.victory h1 {
  color: #4ade80;
}

.defeat h1 {
  color: #f87171;
}

.reason {
  color: #e8e8e8;
  font-size: 1.1rem;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
  color: #ffd460;
}

.new-game-btn {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}
</style>
