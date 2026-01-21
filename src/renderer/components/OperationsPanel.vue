<script setup lang="ts">
import { ref, computed } from "vue";
import { gameService } from "../services/GameService";
import {
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
  EXPEDITIONS,
} from "../../core/balance/OperationsBalance";

const state = gameService.getState();
// biome-ignore lint/correctness/noUnusedVariables: reserved for future tab-based UI
const activeTab = ref<"policies" | "buildings" | "missions">("policies");

// Policy helpers
// biome-ignore lint/correctness/noUnusedVariables: used in template
const policyOptions = {
  workIntensity: Object.keys(WORK_INTENSITY) as Array<"relaxed" | "standard" | "crunch">,
  resourcePriority: Object.keys(RESOURCE_PRIORITY) as Array<"stockpile" | "balanced" | "burn">,
  explorationStance: Object.keys(EXPLORATION_STANCE) as Array<"cautious" | "standard" | "aggressive">,
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
function setPolicy(type: "workIntensity" | "resourcePriority" | "explorationStance", value: string) {
  gameService.setPolicy(type, value);
}

// Expedition helpers
// biome-ignore lint/correctness/noUnusedVariables: used in template
const expeditionTypes = Object.keys(EXPEDITIONS) as Array<"survey" | "salvage" | "science" | "deep">;

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
const unrevealedSites = computed(() => state.prospectingSites.filter(s => !s.revealed));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const revealedSites = computed(() => state.prospectingSites.filter(s => s.revealed && !s.developed));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const developedSites = computed(() => state.prospectingSites.filter(s => s.developed));
</script>

<template>
  <div class="panel operations-panel">
    <h2>Operations</h2>

    <div class="tabs">
      <button
        :class="{ active: activeTab === 'policies' }"
        @click="activeTab = 'policies'"
      >Policies</button>
      <button
        :class="{ active: activeTab === 'buildings' }"
        @click="activeTab = 'buildings'"
      >Buildings</button>
      <button
        :class="{ active: activeTab === 'missions' }"
        @click="activeTab = 'missions'"
      >Missions</button>
    </div>

    <!-- Policies Tab -->
    <div v-if="activeTab === 'policies'" class="tab-content">
      <div class="policy-group">
        <div class="policy-label">Work Intensity</div>
        <div class="policy-buttons">
          <button
            v-for="option in policyOptions.workIntensity"
            :key="option"
            :class="{ selected: state.policies.workIntensity === option }"
            :disabled="state.policyCooldownRemaining > 0 && state.policies.workIntensity !== option"
            @click="setPolicy('workIntensity', option)"
          >{{ option }}</button>
        </div>
      </div>

      <div class="policy-group">
        <div class="policy-label">Resource Priority</div>
        <div class="policy-buttons">
          <button
            v-for="option in policyOptions.resourcePriority"
            :key="option"
            :class="{ selected: state.policies.resourcePriority === option }"
            :disabled="state.policyCooldownRemaining > 0 && state.policies.resourcePriority !== option"
            @click="setPolicy('resourcePriority', option)"
          >{{ option }}</button>
        </div>
      </div>

      <div class="policy-group">
        <div class="policy-label">Exploration Stance</div>
        <div class="policy-buttons">
          <button
            v-for="option in policyOptions.explorationStance"
            :key="option"
            :class="{ selected: state.policies.explorationStance === option }"
            :disabled="state.policyCooldownRemaining > 0 && state.policies.explorationStance !== option"
            @click="setPolicy('explorationStance', option)"
          >{{ option }}</button>
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
          <button @click="revealSite(site.id)">Reveal (30 mat)</button>
        </div>

        <div v-for="site in revealedSites" :key="site.id" class="site-item revealed">
          <span>{{ site.resourceType }} ({{ site.quality }})</span>
          <button @click="developSite(site.id)">Develop</button>
        </div>

        <div v-for="site in developedSites" :key="site.id" class="site-item developed">
          <span>{{ site.resourceType }} ({{ site.quality }}) - Active</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.operations-panel {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tabs button {
  flex: 1;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #ccc;
  cursor: pointer;
}

.tabs button.active {
  background: rgba(74, 222, 128, 0.2);
  border-color: var(--color-positive);
  color: var(--color-positive);
}

.policy-group {
  margin-bottom: 1rem;
}

.policy-label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.policy-buttons {
  display: flex;
  gap: 0.25rem;
}

.policy-buttons button {
  flex: 1;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #aaa;
  cursor: pointer;
  text-transform: capitalize;
}

.policy-buttons button.selected {
  background: rgba(74, 222, 128, 0.2);
  border-color: var(--color-positive);
  color: var(--color-positive);
}

.policy-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cooldown-notice {
  margin-top: 1rem;
  padding: 0.5rem;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 4px;
  color: var(--color-warning);
  font-size: 0.875rem;
  text-align: center;
}

.hint {
  color: #888;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.mode-legend {
  font-size: 0.8rem;
  color: #aaa;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.missions-section {
  margin-bottom: 1rem;
}

.missions-section h3 {
  font-size: 0.875rem;
  color: #aaa;
  margin-bottom: 0.5rem;
}

.empty-message {
  color: #666;
  font-style: italic;
  font-size: 0.875rem;
}

.expedition-item, .site-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  margin-bottom: 0.25rem;
}

.expedition-name {
  font-weight: bold;
}

.expedition-time {
  color: var(--color-warning);
  font-size: 0.875rem;
}

.site-item button {
  padding: 0.25rem 0.5rem;
  background: rgba(74, 222, 128, 0.2);
  border: 1px solid var(--color-positive);
  border-radius: 4px;
  color: var(--color-positive);
  cursor: pointer;
  font-size: 0.75rem;
}

.site-item.developed {
  background: rgba(74, 222, 128, 0.1);
  border-left: 3px solid var(--color-positive);
}
</style>
