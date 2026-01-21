<script setup lang="ts">
import { gameService } from "../services/GameService";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const props = defineProps<{
  isGameOver: boolean;
  hasActiveEvent: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function advanceTurn() {
  gameService.advanceTurn(10);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function newGame() {
  gameService.newGame();
}
</script>

<template>
  <header class="game-header">
    <h1>Mars Colony</h1>
    <div class="sol-display">Sol {{ state.currentSol }}</div>
    <div class="header-actions">
      <button
        @click="advanceTurn"
        :disabled="props.isGameOver || props.hasActiveEvent"
        class="advance-btn"
      >
        Advance 10 Sols
      </button>
      <button @click="newGame" class="new-game-btn">New Game</button>
    </div>
  </header>
</template>

<style scoped>
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.game-header h1 {
  color: #e94560;
  font-size: 1.8rem;
}

.sol-display {
  font-size: 1.5rem;
  color: #ffd460;
  font-weight: bold;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.advance-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: linear-gradient(135deg, #e94560, #c73659);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s, box-shadow 0.2s;
}

.advance-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}

.advance-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-game-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.new-game-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
