<script setup lang="ts">
import { gameService } from "../services/GameService";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function resolveEvent(choiceId: string): void {
  gameService.resolveEvent(choiceId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatEffects(effects: Record<string, unknown>): string[] {
  const result: string[] = [];

  if (effects.resources) {
    for (const [resource, amount] of Object.entries(effects.resources as Record<string, number>)) {
      const prefix = amount >= 0 ? "+" : "";
      result.push(`${prefix}${amount} ${resource}`);
    }
  }

  if (effects.population) {
    const pop = effects.population as number;
    const prefix = pop >= 0 ? "+" : "";
    result.push(`${prefix}${pop} population`);
  }

  if (effects.support) {
    for (const [faction, amount] of Object.entries(effects.support as Record<string, number>)) {
      const prefix = amount >= 0 ? "+" : "";
      result.push(`${prefix}${amount} ${faction} support`);
    }
  }

  return result;
}
</script>

<template>
  <div v-if="state.activeEvent" class="event-modal-overlay">
    <div class="event-modal">
      <div class="event-icon">⚠️</div>
      <h2>{{ state.activeEvent.definition.name }}</h2>
      <p class="event-description">{{ state.activeEvent.definition.description }}</p>

      <div class="choices">
        <div
          v-for="choice in state.activeEvent.definition.choices"
          :key="choice.id"
          class="choice-card"
          @click="resolveEvent(choice.id)"
        >
          <div class="choice-text">{{ choice.text }}</div>
          <div class="choice-effects">
            <span
              v-for="(effect, index) in formatEffects(choice.effects)"
              :key="index"
              class="effect-tag"
              :class="{
                positive: effect.startsWith('+'),
                negative: effect.startsWith('-')
              }"
            >
              {{ effect }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.event-modal {
  background: var(--g-color-bg-base);
  border: 2px solid var(--g-accent-slate);
  padding: var(--g-space-xl);
  max-width: 500px;
  width: 90%;
  text-align: center;
}

.event-icon {
  font-size: 3rem;
  margin-bottom: var(--g-space-md);
}

.event-modal h2 {
  font-family: var(--g-font-mono);
  color: var(--g-color-negative);
  margin-bottom: var(--g-space-md);
  font-size: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.event-description {
  font-family: var(--g-font-mono);
  color: var(--g-color-text);
  margin-bottom: var(--g-space-lg);
  line-height: 1.6;
}

.choices {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.choice-card {
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  padding: var(--g-space-md);
  cursor: pointer;
  transition: all var(--g-transition-fast);
  text-align: left;
}

.choice-card:hover {
  background: var(--g-color-bg-surface);
  border-color: var(--g-accent-slate);
  transform: translateX(4px);
}

.choice-text {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-xs);
}

.choice-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
}

.effect-tag {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.effect-tag.positive {
  color: var(--g-color-positive);
  background: rgba(34, 197, 94, 0.1);
}

.effect-tag.negative {
  color: var(--g-color-negative);
  background: rgba(239, 68, 68, 0.1);
}
</style>
