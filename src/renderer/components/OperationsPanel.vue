<script setup lang="ts">
import { ref, computed } from "vue";
import { gameService } from "../services/GameService";
import {
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
  EXPEDITIONS,
} from "../../core/balance/OperationsBalance";
import { GPanel, GButton } from "../ui";

const state = gameService.getState();
// biome-ignore lint/correctness/noUnusedVariables: reserved for future tab-based UI
const activeTab = ref<"policies" | "buildings" | "missions">("policies");

// Policy helpers
// biome-ignore lint/correctness/noUnusedVariables: used in template
const policyOptions = {
  workIntensity: Object.keys(WORK_INTENSITY) as Array<"relaxed" | "standard" | "crunch">,
  resourcePriority: Object.keys(RESOURCE_PRIORITY) as Array<"stockpile" | "balanced" | "burn">,
  explorationStance: Object.keys(EXPLORATION_STANCE) as Array<
    "cautious" | "standard" | "aggressive"
  >,
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
function setPolicy(
  type: "workIntensity" | "resourcePriority" | "explorationStance",
  value: string,
) {
  gameService.setPolicy(type, value);
}

// Expedition helpers
// biome-ignore lint/correctness/noUnusedVariables: used in template
const expeditionTypes = Object.keys(EXPEDITIONS) as Array<
  "survey" | "salvage" | "science" | "deep"
>;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canStartExpedition = computed(() => {
  return state.activeExpeditions.length < 2;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatExpeditionName(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// Site helpers
// biome-ignore lint/correctness/noUnusedVariables: used in template
function revealSite(siteId: string) {
  gameService.revealSite(siteId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function developSite(siteId: string) {
  gameService.developSite(siteId);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const unrevealedSites = computed(() => state.prospectingSites.filter((s) => !s.revealed));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const revealedSites = computed(() =>
  state.prospectingSites.filter((s) => s.revealed && !s.developed),
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const developedSites = computed(() => state.prospectingSites.filter((s) => s.developed));
</script>

<template>
  <GPanel title="Operations">
    <div class="tabs">
      <GButton
        :variant="activeTab === 'policies' ? 'primary' : 'ghost'"
        size="sm"
        @click="activeTab = 'policies'"
      >
        Policies
      </GButton>
      <GButton
        :variant="activeTab === 'buildings' ? 'primary' : 'ghost'"
        size="sm"
        @click="activeTab = 'buildings'"
      >
        Buildings
      </GButton>
      <GButton
        :variant="activeTab === 'missions' ? 'primary' : 'ghost'"
        size="sm"
        @click="activeTab = 'missions'"
      >
        Missions
      </GButton>
    </div>

    <!-- Policies Tab -->
    <div v-if="activeTab === 'policies'" class="tab-content">
      <div class="policy-group">
        <div class="policy-label">Work Intensity</div>
        <div class="policy-buttons">
          <GButton
            v-for="option in policyOptions.workIntensity"
            :key="option"
            :variant="state.policies.workIntensity === option ? 'primary' : 'secondary'"
            size="sm"
            :disabled="state.policyCooldownRemaining > 0 && state.policies.workIntensity !== option"
            @click="setPolicy('workIntensity', option)"
          >
            {{ option }}
          </GButton>
        </div>
      </div>

      <div class="policy-group">
        <div class="policy-label">Resource Priority</div>
        <div class="policy-buttons">
          <GButton
            v-for="option in policyOptions.resourcePriority"
            :key="option"
            :variant="state.policies.resourcePriority === option ? 'primary' : 'secondary'"
            size="sm"
            :disabled="state.policyCooldownRemaining > 0 && state.policies.resourcePriority !== option"
            @click="setPolicy('resourcePriority', option)"
          >
            {{ option }}
          </GButton>
        </div>
      </div>

      <div class="policy-group">
        <div class="policy-label">Exploration Stance</div>
        <div class="policy-buttons">
          <GButton
            v-for="option in policyOptions.explorationStance"
            :key="option"
            :variant="state.policies.explorationStance === option ? 'primary' : 'secondary'"
            size="sm"
            :disabled="state.policyCooldownRemaining > 0 && state.policies.explorationStance !== option"
            @click="setPolicy('explorationStance', option)"
          >
            {{ option }}
          </GButton>
        </div>
      </div>

      <div v-if="state.policyCooldownRemaining > 0" class="cooldown-notice">
        Policy change available in: {{ state.policyCooldownRemaining }} sols
      </div>
    </div>

    <!-- Buildings Tab -->
    <div v-if="activeTab === 'buildings'" class="tab-content">
      <p class="hint">Building modes are set on individual buildings in the Building panel.</p>
      <div class="mode-legend">
        <div><strong>Conservation:</strong> 50% production, 40% consumption</div>
        <div><strong>Normal:</strong> 100% production, 100% consumption</div>
        <div><strong>Overdrive:</strong> 150% production, 200% consumption, breakdown risk</div>
      </div>
    </div>

    <!-- Missions Tab -->
    <div v-if="activeTab === 'missions'" class="tab-content">
      <div class="missions-section">
        <h3>Active Expeditions ({{ state.activeExpeditions.length }}/2)</h3>
        <div v-if="state.activeExpeditions.length === 0" class="empty-message">
          No active expeditions
        </div>
        <div v-for="exp in state.activeExpeditions" :key="exp.id" class="expedition-item">
          <span class="expedition-name">{{ formatExpeditionName(exp.type) }}</span>
          <span class="expedition-time">{{ exp.solsRemaining }} sols remaining</span>
        </div>
      </div>

      <div class="missions-section">
        <h3>Prospecting Sites</h3>
        <div v-if="state.prospectingSites.length === 0" class="empty-message">
          Complete Survey expeditions to discover sites
        </div>

        <div v-for="site in unrevealedSites" :key="site.id" class="site-item unrevealed">
          <span>??? (Unrevealed)</span>
          <GButton size="sm" @click="revealSite(site.id)">Reveal (30 mat)</GButton>
        </div>

        <div v-for="site in revealedSites" :key="site.id" class="site-item revealed">
          <span>{{ site.resourceType }} ({{ site.quality }})</span>
          <GButton size="sm" variant="primary" @click="developSite(site.id)">Develop</GButton>
        </div>

        <div v-for="site in developedSites" :key="site.id" class="site-item developed">
          <span>{{ site.resourceType }} ({{ site.quality }}) - Active</span>
        </div>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-md);
}

.policy-group {
  margin-bottom: var(--g-space-md);
}

.policy-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

.policy-buttons {
  display: flex;
  gap: var(--g-space-xs);
}

.policy-buttons :deep(.g-button) {
  flex: 1;
  text-transform: capitalize;
}

.cooldown-notice {
  margin-top: var(--g-space-md);
  padding: var(--g-space-sm);
  background: oklch(75% 0.15 70 / 0.1);
  border-radius: 4px;
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
  text-align: center;
}

.hint {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  margin-bottom: var(--g-space-md);
}

.mode-legend {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.missions-section {
  margin-bottom: var(--g-space-md);
}

.missions-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.empty-message {
  color: var(--g-color-text-muted);
  font-style: italic;
  font-size: var(--g-font-size-sm);
}

.expedition-item, .site-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  margin-bottom: var(--g-space-xs);
}

.expedition-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.expedition-time {
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
}

.site-item.developed {
  background: oklch(70% 0.17 145 / 0.1);
  border-left: 3px solid var(--g-color-positive);
}
</style>
