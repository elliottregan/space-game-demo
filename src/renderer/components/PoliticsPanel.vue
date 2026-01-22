<script setup lang="ts">
import { ref } from "vue";
import { gameService } from "../services/GameService";
import type { Decision } from "../../core/models/Politics";
import { highlightResources, clearHighlights } from "../directives/ResourceHighlight";
import { GPanel, GButton, GProgress } from "../ui";

const state = gameService.getState();
const selectedDecision = ref<Decision | null>(null);
const decisionResult = ref<string | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportVariant(support: number): "positive" | "warning" | "negative" {
  if (support >= 60) return "positive";
  if (support >= 40) return "warning";
  return "negative";
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

  const affectedResources = Object.keys(decision.effects.resources).filter(
    (key) => (decision.effects?.resources as Record<string, number>)?.[key] !== 0,
  );

  const negativeResources = affectedResources.filter(
    (key) => ((decision.effects?.resources as Record<string, number>)?.[key] || 0) < 0,
  );

  const deltas: Record<string, number> = { ...decision.effects.resources };

  highlightResources(affectedResources, negativeResources, deltas);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onDecisionLeave(): void {
  clearHighlights();
}
</script>

<template>
  <GPanel title="Politics">
    <div class="average-support">
      <span class="label">Average Support:</span>
      <span class="value" :class="`support-${getSupportVariant(state.averageSupport)}`">
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
          <span class="faction-support" :class="`support-${getSupportVariant(faction.support)}`">
            {{ Math.floor(faction.support) }}%
          </span>
        </div>
        <GProgress
          :percent="faction.support"
          :variant="getSupportVariant(faction.support)"
        />
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
          <GButton variant="secondary" @click="cancelDecision">Cancel</GButton>
          <GButton variant="primary" @click="makeDecision">Confirm</GButton>
        </div>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.average-support {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  margin-bottom: var(--g-space-md);
}

.average-support .label {
  color: var(--g-color-text-muted);
}

.average-support .value {
  font-family: var(--g-font-mono);
  font-size: 1.25rem;
  font-weight: bold;
}

.support-positive { color: var(--g-color-positive); }
.support-warning { color: var(--g-color-warning); }
.support-negative { color: var(--g-color-negative); }

.factions {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-lg);
}

.faction-card {
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  padding: var(--g-space-sm);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
}

.faction-support {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.faction-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: var(--g-space-xs);
}

.decisions-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
  padding-bottom: var(--g-space-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.decision-result {
  padding: var(--g-space-sm);
  background: oklch(65% 0.15 250 / 0.1);
  border: 1px solid var(--g-color-info);
  border-radius: 4px;
  margin-bottom: var(--g-space-sm);
  font-size: var(--g-font-size-sm);
}

.decisions-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  max-height: 200px;
  overflow-y: auto;
}

.decision-card {
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  padding: var(--g-space-sm);
  cursor: pointer;
  border: 1px solid var(--g-color-border);
  transition: all var(--g-transition-fast);
}

.decision-card:hover:not(.disabled) {
  border-color: var(--g-color-border-focus);
  box-shadow: var(--g-glow-subtle);
}

.decision-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.decision-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-xs);
}

.decision-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.decision-requirement {
  font-size: var(--g-font-size-xs);
  color: oklch(70% 0.15 280);
}

.decision-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: oklch(10% 0.02 250 / 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.decision-modal {
  background: var(--g-color-bg-surface);
  border-radius: 8px;
  padding: var(--g-space-lg);
  max-width: 400px;
  width: 90%;
  border: 1px solid var(--g-color-border);
}

.decision-modal h3 {
  font-family: var(--g-font-mono);
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-sm);
}

.decision-modal p {
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-md);
}

.decision-effects h4 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-info);
  margin-bottom: var(--g-space-xs);
}

.decision-effects ul {
  list-style: none;
  padding: 0;
  margin-bottom: var(--g-space-md);
}

.decision-effects li {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  padding: var(--g-space-xs) 0;
}

.resource-effects {
  margin-top: var(--g-space-sm);
}

.modal-actions {
  display: flex;
  gap: var(--g-space-md);
  justify-content: flex-end;
}
</style>
