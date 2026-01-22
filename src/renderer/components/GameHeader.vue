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
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  margin-bottom: var(--g-space-md);
}

.game-header h1 {
  font-family: var(--g-font-mono);
  color: var(--g-color-negative);
  font-size: 1.8rem;
}

.sol-display {
  font-family: var(--g-font-mono);
  font-size: 1.5rem;
  color: var(--g-color-warning);
  font-weight: bold;
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
    font-size: 1.2rem;
  }

  .sol-display {
    font-size: 1.1rem;
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
    font-size: 1.1rem;
  }

  .sol-display {
    font-size: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
