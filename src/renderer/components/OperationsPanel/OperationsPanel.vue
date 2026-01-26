<script setup lang="ts">
import { ref } from "vue";
import { gameService } from "../../services/GameService";
import {
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
} from "../../../core/balance/OperationsBalance";
import type { PolicyType, PolicyValue } from "../../../facade";
import { GPanel, GTabGroup } from "../../ui";
import PoliciesTab from "./PoliciesTab.vue";
import BuildingsTab from "./BuildingsTab.vue";
import MissionsTab from "./MissionsTab.vue";

// Reactive state for template bindings (auto-updates when API syncs)
// biome-ignore lint/correctness/noUnusedVariables: used in template
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const activeTab = ref<"policies" | "buildings" | "missions">("policies");

// biome-ignore lint/correctness/noUnusedVariables: used in template
const policyOptions = {
  workIntensity: Object.keys(WORK_INTENSITY) as Array<"relaxed" | "standard" | "crunch">,
  resourcePriority: Object.keys(RESOURCE_PRIORITY) as Array<"stockpile" | "balanced" | "burn">,
  explorationStance: Object.keys(EXPLORATION_STANCE) as Array<
    "cautious" | "standard" | "aggressive"
  >,
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
function setPolicy(type: PolicyType, value: string): void {
  const result = api.operations.setPolicy(type, value as PolicyValue);
  if (!result.success) {
    console.warn(`Policy change failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function revealSite(siteId: string): void {
  const result = api.operations.revealSite(siteId);
  if (!result.success) {
    console.warn(`Reveal failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function developSite(siteId: string): void {
  const result = api.operations.developSite(siteId);
  if (!result.success) {
    console.warn(`Development failed: ${result.error.type}`, result.error);
  }
}
</script>

<template>
  <GPanel title="Operations" accent="amber">
    <GTabGroup v-model="activeTab" :tabs="[
      { id: 'policies', label: 'Policies' },
      { id: 'buildings', label: 'Buildings' },
      { id: 'missions', label: 'Missions' }
    ]" />

    <PoliciesTab
      v-if="activeTab === 'policies'"
      :policies="state.policies"
      :policy-cooldown-remaining="state.policyCooldownRemaining"
      :policy-options="policyOptions"
      @set-policy="setPolicy"
    />

    <BuildingsTab v-if="activeTab === 'buildings'" />

    <MissionsTab
      v-if="activeTab === 'missions'"
      :active-expeditions="state.activeExpeditions"
      :prospecting-sites="state.prospectingSites"
      @reveal-site="revealSite"
      @develop-site="developSite"
    />
  </GPanel>
</template>

