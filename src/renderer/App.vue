<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "./services/GameService";
import GameHeader from "./components/GameHeader.vue";
import TabNav from "./components/TabNav.vue";
import EventLogSidebar from "./components/EventLogSidebar.vue";
import EventModal from "./components/EventModal.vue";
import GameOverModal from "./components/GameOverModal.vue";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const isGameOver = computed(() => state.victoryState.status !== "playing");
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasActiveEvent = computed(() => state.activeEvent !== null);
</script>

<template>
  <div class="game-container">
    <GameHeader :is-game-over="isGameOver" :has-active-event="hasActiveEvent" />
    <TabNav />

    <main class="game-main">
      <div class="tab-content">
        <router-view />
      </div>
      <EventLogSidebar />
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

.game-main {
  display: flex;
  gap: 1rem;
}

.tab-content {
  flex: 1;
  min-width: 0;
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

@media (max-width: 1024px) {
  .game-main {
    flex-direction: column;
  }
}
</style>
