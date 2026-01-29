<script setup lang="ts">
import { ref } from "vue";
import type { StartingCondition } from "../../facade";
import { gameService } from "../services/GameService";
import { GButton } from "../ui";

const emit = defineEmits<{
  close: [];
}>();

const conditions = gameService.getStartingConditions();
const selectedId = ref(conditions[0]?.id ?? "default");

function startGame() {
  gameService.newGame(selectedId.value);
  emit("close");
}

function cancel() {
  emit("close");
}

function selectCondition(condition: StartingCondition) {
  selectedId.value = condition.id;
}
</script>

<template>
  <div class="modal-overlay" @click.self="cancel">
    <div class="modal">
      <h2>New Game</h2>
      <p class="subtitle">Select starting conditions</p>

      <div class="conditions-list">
        <button
          v-for="condition in conditions"
          :key="condition.id"
          class="condition-card"
          :class="{ selected: selectedId === condition.id }"
          @click="selectCondition(condition)"
        >
          <h3>{{ condition.name }}</h3>
          <p>{{ condition.description }}</p>
          <div class="details">
            <span class="detail">
              <span class="label">Population:</span>
              {{ condition.population }}
            </span>
            <span class="detail">
              <span class="label">Buildings:</span>
              {{ condition.preBuiltBuildings.length }}
            </span>
          </div>
        </button>
      </div>

      <div class="actions">
        <GButton variant="secondary" @click="cancel">Cancel</GButton>
        <GButton variant="primary" @click="startGame">Start Game</GButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.modal {
  background: var(--g-color-bg-base);
  border: 2px solid var(--g-accent-slate);
  padding: var(--g-space-xl);
  max-width: 500px;
  width: 90%;
}

h2 {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xl);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-xs);
}

.subtitle {
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  margin-bottom: var(--g-space-lg);
}

.conditions-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  margin-bottom: var(--g-space-xl);
}

.condition-card {
  background: var(--g-color-bg-surface);
  border: 2px solid var(--g-color-border);
  padding: var(--g-space-md);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.condition-card:hover {
  border-color: var(--g-accent-slate);
}

.condition-card.selected {
  border-color: var(--g-accent-red);
  background: var(--g-color-bg-elevated);
}

.condition-card h3 {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  color: var(--g-color-text);
  margin-bottom: var(--g-space-xs);
}

.condition-card p {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.details {
  display: flex;
  gap: var(--g-space-md);
}

.detail {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text);
}

.detail .label {
  color: var(--g-color-text-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--g-space-sm);
}
</style>
