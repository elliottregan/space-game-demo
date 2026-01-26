<script setup lang="ts">
import { gameService } from "../services/GameService";
import { GButton } from "../ui";

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
function advanceOneSol() {
  gameService.advanceTurn(1);
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
      <GButton
        variant="secondary"
        @click="advanceOneSol"
        :disabled="props.isGameOver || props.hasActiveEvent"
      >
        +1 Sol
      </GButton>
      <GButton
        variant="primary"
        @click="advanceTurn"
        :disabled="props.isGameOver || props.hasActiveEvent"
      >
        +10 Sols
      </GButton>
      <GButton variant="secondary" @click="newGame">New Game</GButton>
    </div>
  </header>
</template>

<style scoped>
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--g-space-sm);
  padding: var(--g-space-md);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  margin-bottom: var(--g-space-md);
}

.game-header h1 {
  font-family: var(--g-font-mono);
  color: var(--g-accent-red);
  font-size: var(--g-font-size-xl);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sol-display {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-2xl);
  color: var(--g-color-text);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  gap: var(--g-space-sm);
}

@media (max-width: 768px) {
  .game-header {
    padding: var(--g-space-sm);
  }

  .game-header h1 {
    font-size: var(--g-font-size-lg);
  }

  .sol-display {
    font-size: var(--g-font-size-xl);
  }

  .header-actions {
    gap: var(--g-space-xs);
  }
}

@media (max-width: 480px) {
  .game-header {
    justify-content: center;
  }

  .game-header h1 {
    width: 100%;
    text-align: center;
    font-size: var(--g-font-size-md);
  }

  .sol-display {
    font-size: var(--g-font-size-lg);
  }

  .header-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
