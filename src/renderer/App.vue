<script setup lang="ts">
import { computed } from "vue";
import EventLogSidebar from "./components/EventLogSidebar.vue";
import EventModal from "./components/EventModal.vue";
import GameHeader from "./components/GameHeader.vue";
import GameOverModal from "./components/GameOverModal.vue";
import TabNav from "./components/TabNav.vue";
import { gameService } from "./services/GameService";

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
  /* Legacy semantic colors - mapped to new system */
  --color-positive: var(--g-color-positive);
  --color-negative: var(--g-color-negative);
  --color-danger: var(--g-color-negative);
  --color-warning: var(--g-color-warning);
  --color-info: var(--g-color-info);
  --color-muted: var(--g-color-text-muted);

  /* Legacy semantic backgrounds */
  --bg-positive: rgba(46, 125, 50, 0.1);
  --bg-negative: rgba(198, 40, 40, 0.1);
  --bg-danger: rgba(198, 40, 40, 0.2);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  background: var(--g-color-bg-base);
}

body {
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  min-height: 100vh;
}

.game-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--g-space-md);
}

.game-main {
  display: flex;
  gap: var(--g-space-md);
}

.tab-content {
  flex: 1;
  min-width: 0;
}

/* Legacy panel class - for components not yet migrated */
.panel {
  background: var(--g-color-bg-base);
  border-radius: 8px;
  padding: 1rem;
  border: var(--g-border-width) solid var(--g-current-accent, var(--g-color-border));
}

.panel h2 {
  font-size: var(--g-font-size-xl);
  margin-bottom: 1rem;
  color: #ffd460;
  border-bottom: var(--g-border-width) solid var(--g-current-accent, var(--g-color-border));
  padding-bottom: 0.5rem;
}

.btn {
  padding: var(--g-space-sm) var(--g-space-md);
  border: none;
  cursor: pointer;
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: filter var(--g-transition-fast);
}

.btn-primary {
  background: var(--g-accent-red);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(0.9);
}

.btn-secondary {
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
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
