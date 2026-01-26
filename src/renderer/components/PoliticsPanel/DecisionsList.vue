<script setup lang="ts">
import type { Decision } from "../../../core/models/Politics";
import { highlightResources, clearHighlights } from "../../directives/ResourceHighlight";
import { GActionCard, GSection } from "../../ui";

defineProps<{
  decisions: Decision[];
  decisionResult: string | null;
  canMakeDecision: (decision: Decision) => boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  select: [decision: Decision];
}>();

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
  <GSection title="Available Decisions" variant="muted">
    <div v-if="decisionResult" class="decision-result">
      {{ decisionResult }}
    </div>

    <div class="decisions-list">
      <GActionCard
        v-for="decision in decisions"
        :key="decision.id"
        :title="decision.name"
        :description="decision.description"
        :cost="`Requires ${decision.requiredSupport}% support`"
        :disabled="!canMakeDecision(decision)"
        @click="emit('select', decision)"
        @mouseenter="onDecisionHover(decision)"
        @mouseleave="onDecisionLeave"
      />
    </div>
  </GSection>
</template>

<style scoped>
.decision-result {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-accent-slate);
  margin-bottom: var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.decisions-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  max-height: 200px;
  overflow-y: auto;
}
</style>
