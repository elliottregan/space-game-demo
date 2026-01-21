<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "./services/GameService";
import ResourcePanel from "./components/ResourcePanel.vue";
import ColonyPanel from "./components/ColonyPanel.vue";
import BuildingPanel from "./components/BuildingPanel.vue";
import TechnologyPanel from "./components/TechnologyPanel.vue";
import PoliticsPanel from "./components/PoliticsPanel.vue";
import OperationsPanel from "./components/OperationsPanel.vue";
import EventModal from "./components/EventModal.vue";
import GameOverModal from "./components/GameOverModal.vue";
import EventLog from "./components/EventLog.vue";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const isGameOver = computed(() => state.victoryState.status !== "playing");
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasActiveEvent = computed(() => state.activeEvent !== null);

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
  <div class="game-container">
    <header class="game-header">
      <h1>Mars Colony</h1>
      <div class="sol-display">Sol {{ state.currentSol }}</div>
      <div class="header-actions">
        <button @click="advanceTurn" :disabled="isGameOver || hasActiveEvent" class="advance-btn">
          Advance 10 Sols
        </button>
        <button @click="newGame" class="new-game-btn">New Game</button>
      </div>
    </header>

    <main class="game-main">
      <div class=" left-column">
          <div class="column">
            <ResourcePanel />
            <ColonyPanel />
            <EventLog />
          </div>
      </div>

      <div class=" center-column">
          <div class="column">
        <BuildingPanel />
        </div>
      </div>

      <div class=" right-column">
          <div class="column">
        <TechnologyPanel />
        <PoliticsPanel />
        <OperationsPanel />
        </div>
      </div>
    </main>

    <EventModal v-if="hasActiveEvent" />
    <GameOverModal v-if="isGameOver" />
  </div>
</template>

<style>
:root {
  /* Semantic colors */
  --color-positive: #4ade80;
  --color-negative: #f87171;
  --color-danger: #ef4444;
  --color-warning: #fbbf24;
  --color-info: #60a5fa;
  --color-muted: #888;

  /* Semantic backgrounds */
  --bg-positive: rgba(74, 222, 128, 0.1);
  --bg-negative: rgba(248, 113, 113, 0.1);
  --bg-danger: rgba(239, 68, 68, 0.2);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e8e8e8;
  min-height: 100vh;
}

.game-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 1rem;
}

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

.game-main {
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  gap: 1rem;
}

.column {

    position: sticky;
    top: 1rem;
}

.left-column, .center-column, .right-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.panel h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #ffd460;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #e94560;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #c73659;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1200px) {
  .game-main {
    grid-template-columns: 1fr 1fr;
  }

  .right-column {
    grid-column: span 2;
    flex-direction: row;
  }

  .right-column > * {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .game-main {
    grid-template-columns: 1fr;
  }

  .right-column {
    grid-column: span 1;
    flex-direction: column;
  }
}
</style>
