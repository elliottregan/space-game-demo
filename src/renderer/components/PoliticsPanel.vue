<script setup lang="ts">
import { ref } from "vue";
import { gameService } from "../services/GameService";
import type { Decision } from "../../core/models/Politics";
import { highlightResources, clearHighlights } from "../directives/ResourceHighlight";

const state = gameService.getState();
const selectedDecision = ref<Decision | null>(null);
const decisionResult = ref<string | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportColor(support: number): string {
  if (support >= 60) return "#4ade80";
  if (support >= 40) return "#fbbf24";
  if (support >= 20) return "#fb923c";
  return "#f87171";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function selectDecision(decision: Decision): void {
  selectedDecision.value = decision;
  decisionResult.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function makeDecision(): void {
  if (!selectedDecision.value) return;

  const result = gameService.makeDecision(selectedDecision.value.id);
  if (result) {
    const impacts = result.impacts
      .map((i) => {
        const faction = state.factions.find((f) => f.id === i.factionId);
        const changeStr = i.change >= 0 ? `+${i.change}` : `${i.change}`;
        return `${faction?.name}: ${changeStr}`;
      })
      .join(", ");

    decisionResult.value = result.success
      ? `Decision made! ${impacts}`
      : `Decision failed. ${impacts}`;
  }

  selectedDecision.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function cancelDecision(): void {
  selectedDecision.value = null;
  decisionResult.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canMakeDecision(decision: Decision): boolean {
  return state.averageSupport >= decision.requiredSupport;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onDecisionHover(decision: Decision): void {
  if (!decision.effects?.resources) return;

  // For decisions, highlight affected resources (not required, but affected)
  const affectedResources = Object.keys(decision.effects.resources).filter(
    (key) => (decision.effects?.resources as Record<string, number>)?.[key] !== 0,
  );

  // Resources with negative effects are shown as "insufficient" style (red glow)
  const negativeResources = affectedResources.filter(
    (key) => ((decision.effects?.resources as Record<string, number>)?.[key] || 0) < 0,
  );

  // Pass the resource effects as deltas (can be positive or negative)
  const deltas: Record<string, number> = { ...decision.effects.resources };

  highlightResources(affectedResources, negativeResources, deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onDecisionLeave(): void {
  clearHighlights();
}
</script>

<template>
  <div class="panel politics-panel">
    <h2>Politics</h2>

    <div class="average-support">
      <span class="label">Average Support:</span>
      <span class="value" :style="{ color: getSupportColor(state.averageSupport) }">
        {{ Math.floor(state.averageSupport) }}%
      </span>
    </div>

    <div class="factions">
      <div
        v-for="faction in state.factions"
        :key="faction.id"
        class="faction-card"
      >
        <div class="faction-header">
          <span class="faction-name">{{ faction.name }}</span>
          <span class="faction-support" :style="{ color: getSupportColor(faction.support) }">
            {{ Math.floor(faction.support) }}%
          </span>
        </div>
        <div class="support-bar">
          <div
            class="support-fill"
            :style="{
              width: `${faction.support}%`,
              background: getSupportColor(faction.support)
            }"
          ></div>
        </div>
        <div class="faction-desc">{{ faction.description }}</div>
      </div>
    </div>

    <div class="decisions-section">
      <h3>Available Decisions</h3>

      <div v-if="decisionResult" class="decision-result">
        {{ decisionResult }}
      </div>

      <div class="decisions-list">
        <div
          v-for="decision in state.decisions"
          :key="decision.id"
          class="decision-card"
          :class="{ disabled: !canMakeDecision(decision) }"
          @click="canMakeDecision(decision) && selectDecision(decision)"
          @mouseenter="onDecisionHover(decision)"
          @mouseleave="onDecisionLeave"
        >
          <div class="decision-name">{{ decision.name }}</div>
          <div class="decision-desc">{{ decision.description }}</div>
          <div class="decision-requirement">
            Requires {{ decision.requiredSupport }}% support
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedDecision" class="decision-modal-overlay" @click.self="cancelDecision">
      <div class="decision-modal">
        <h3>{{ selectedDecision.name }}</h3>
        <p>{{ selectedDecision.description }}</p>

        <div class="decision-effects">
          <h4>Effects:</h4>
          <ul>
            <li v-for="(value, tag) in selectedDecision.tags" :key="tag">
              {{ tag }}: {{ value >= 0 ? '+' : '' }}{{ value }}
            </li>
          </ul>
          <div v-if="selectedDecision.effects?.resources" class="resource-effects">
            <h4>Resource Changes:</h4>
            <ul>
              <li v-for="(value, resource) in selectedDecision.effects.resources" :key="resource">
                {{ resource }}: {{ value >= 0 ? '+' : '' }}{{ value }}
              </li>
            </ul>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="cancelDecision">Cancel</button>
          <button class="btn btn-primary" @click="makeDecision">Confirm</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.politics-panel {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
}

.average-support {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 1rem;
}

.average-support .label {
  color: #888;
}

.average-support .value {
  font-size: 1.25rem;
  font-weight: bold;
}

.factions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.faction-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.75rem;
}

.faction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.faction-name {
  font-weight: bold;
  color: #ffd460;
}

.faction-support {
  font-weight: bold;
}

.support-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.support-fill {
  height: 100%;
  transition: width 0.3s, background 0.3s;
}

.faction-desc {
  font-size: 0.75rem;
  color: #888;
}

.decisions-section h3 {
  font-size: 0.875rem;
  color: #888;
  margin-bottom: 0.75rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.decision-result {
  padding: 0.75rem;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid #60a5fa;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.decisions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.decision-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.decision-card:hover:not(.disabled) {
  border-color: #e94560;
  transform: translateY(-1px);
}

.decision-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.decision-name {
  font-weight: bold;
  color: #ffd460;
  margin-bottom: 0.25rem;
}

.decision-desc {
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 0.25rem;
}

.decision-requirement {
  font-size: 0.75rem;
  color: #a78bfa;
}

.decision-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.decision-modal {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.decision-modal h3 {
  color: #ffd460;
  margin-bottom: 0.75rem;
}

.decision-modal p {
  color: #888;
  margin-bottom: 1rem;
}

.decision-effects h4 {
  font-size: 0.875rem;
  color: #60a5fa;
  margin-bottom: 0.5rem;
}

.decision-effects ul {
  list-style: none;
  padding: 0;
  margin-bottom: 1rem;
}

.decision-effects li {
  font-size: 0.875rem;
  color: #e8e8e8;
  padding: 0.25rem 0;
}

.resource-effects {
  margin-top: 0.75rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}
</style>
