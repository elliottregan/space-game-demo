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
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.event-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  border: 2px solid #e94560;
  box-shadow: 0 0 50px rgba(233, 69, 96, 0.3);
  text-align: center;
}

.event-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.event-modal h2 {
  color: #e94560;
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.event-description {
  color: #e8e8e8;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.choices {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.choice-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.choice-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #ffd460;
  transform: translateX(4px);
}

.choice-text {
  font-weight: bold;
  color: #ffd460;
  margin-bottom: 0.5rem;
}

.choice-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.effect-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.effect-tag.positive {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.effect-tag.negative {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
</style>
