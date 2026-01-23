<script setup lang="ts">
import { ref } from "vue";
import { gameService } from "../services/GameService";
import type { Decision } from "../../core/models/Politics";
import { GPanel } from "../ui";
import AverageSupportDisplay from "./AverageSupportDisplay.vue";
import FactionCard from "./FactionCard.vue";
import DecisionsList from "./DecisionsList.vue";
import DecisionModal from "./DecisionModal.vue";

const state = gameService.getState();
const api = gameService.api;

const selectedDecision = ref<Decision | null>(null);
const decisionResult = ref<string | null>(null);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function canMakeDecision(decision: Decision): boolean {
  return api.politics.canMakeDecision(decision.id).allowed;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function selectDecision(decision: Decision): void {
  selectedDecision.value = decision;
  decisionResult.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function makeDecision(): void {
  if (!selectedDecision.value) return;

  const result = api.politics.makeDecision(selectedDecision.value.id);
  if (result.success) {
    const impacts = result.data.impacts
      .map((i) => {
        const faction = state.factions.find((f) => f.id === i.factionId);
        const changeStr = i.change >= 0 ? `+${i.change}` : `${i.change}`;
        return `${faction?.name}: ${changeStr}`;
      })
      .join(", ");

    decisionResult.value = result.data.success
      ? `Decision made! ${impacts}`
      : `Decision failed. ${impacts}`;
  } else {
    console.warn(`Decision failed: ${result.error.type}`, result.error);
  }

  selectedDecision.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function cancelDecision(): void {
  selectedDecision.value = null;
  decisionResult.value = null;
}
</script>

<template>
  <GPanel title="Politics">
    <AverageSupportDisplay :support="state.averageSupport" />

    <div class="factions">
      <FactionCard
        v-for="faction in state.factions"
        :key="faction.id"
        :faction="faction"
      />
    </div>

    <DecisionsList
      :decisions="state.decisions"
      :decision-result="decisionResult"
      :can-make-decision="canMakeDecision"
      @select="selectDecision"
    />

    <DecisionModal
      v-if="selectedDecision"
      :decision="selectedDecision"
      @confirm="makeDecision"
      @cancel="cancelDecision"
    />
  </GPanel>
</template>

<style scoped>
.factions {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-lg);
}
</style>
