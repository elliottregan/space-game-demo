<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../services/GameService";
import { GPanel, GButton, GProgress, GInput, GSelect, GBadge, GActionCard } from "../ui";
import type { SelectOption } from "../ui/primitives/GSelect.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

const selectedProject = ref<string | null>(null);
const selectedNPCForLobby = ref<string | null>(null);
const lobbyAmount = ref(0.3);
const councilName = ref("");
const selectedCouncilMembers = ref<string[]>([]);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const lobbyOptions: SelectOption[] = [
  { value: 0.1, label: "+10%" },
  { value: 0.2, label: "+20%" },
  { value: 0.3, label: "+30%" },
  { value: 0.5, label: "+50%" },
];

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatProjectCost(cost: Record<string, number>): string {
  return (
    "Cost: " +
    Object.entries(cost)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")
  );
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canProposeProject = computed(() => {
  if (!selectedProject.value) return false;
  return api.npc.canProposeProject(selectedProject.value).allowed;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const lobbyCost = computed(() => {
  if (!selectedNPCForLobby.value) return 0;
  return api.npc.getLobbyCost(selectedNPCForLobby.value, lobbyAmount.value);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canLobby = computed(() => {
  if (!state.npcInfluence.activeProject || !selectedNPCForLobby.value) return false;
  return api.npc.canLobbyNPC(selectedNPCForLobby.value, lobbyAmount.value).allowed;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canCreateCouncil = computed(() => {
  return (
    selectedCouncilMembers.value.length >= 2 &&
    councilName.value.trim() !== "" &&
    state.resources.materials >= 50
  );
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function proposeProject(): void {
  if (!selectedProject.value) return;
  const result = api.npc.proposeProject(selectedProject.value);
  if (!result.success) {
    console.warn(`Proposal failed: ${result.error.type}`, result.error);
  }
  selectedProject.value = null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function lobbyNPC(): void {
  if (!selectedNPCForLobby.value) return;
  const result = api.npc.lobbyNPC(selectedNPCForLobby.value, lobbyAmount.value);
  if (!result.success) {
    console.warn(`Lobbying failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function createCouncil(): void {
  if (!councilName.value || selectedCouncilMembers.value.length < 2) return;
  const result = api.npc.createCouncil(councilName.value, selectedCouncilMembers.value);
  if (!result.success) {
    console.warn(`Council creation failed: ${result.error.type}`, result.error);
  }
  councilName.value = "";
  selectedCouncilMembers.value = [];
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function toggleCouncilMember(npcId: string) {
  const idx = selectedCouncilMembers.value.indexOf(npcId);
  if (idx === -1) {
    selectedCouncilMembers.value.push(npcId);
  } else {
    selectedCouncilMembers.value.splice(idx, 1);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getFactionVariant(faction: string): "info" | "positive" | "warning" | "muted" {
  switch (faction) {
    case "futurist":
      return "info";
    case "progressive":
      return "positive";
    case "traditionalist":
      return "warning";
    default:
      return "muted";
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportVariant(support: number): "positive" | "negative" | "default" {
  if (support > 0.3) return "positive";
  if (support < -0.3) return "negative";
  return "default";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatSupport(support: number): string {
  const pct = (support * 100).toFixed(0);
  return support >= 0 ? `+${pct}%` : `${pct}%`;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const supportPercent = computed(() => {
  if (!state.npcInfluence.activeProject) return 0;
  return Math.max(0, ((state.npcInfluence.activeProject.averageSupport + 1) / 2) * 100);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleLobbyAmountChange(value: string | number) {
  lobbyAmount.value = Number(value);
}
</script>

<template>
  <GPanel title="Council Politics">
    <!-- Active Project Status -->
    <section v-if="state.npcInfluence.activeProject" class="section">
      <h3 class="section-title">Active Proposal</h3>
      <div class="project-status">
        <div class="project-name">
          {{ state.npcInfluence.projects.find(p => p.id === state.npcInfluence.activeProject?.projectId)?.name }}
        </div>
        <div class="status-row">
          <span class="status-label">
            Average Support:
            <span :class="`support-${getSupportVariant(state.npcInfluence.activeProject.averageSupport)}`">
              {{ formatSupport(state.npcInfluence.activeProject.averageSupport) }}
            </span>
          </span>
          <span class="status-label">
            Sols until vote: {{ state.npcInfluence.activeProject.solsRemaining }}
          </span>
        </div>
        <div class="threshold-container">
          <GProgress
            :percent="supportPercent"
            :variant="getSupportVariant(state.npcInfluence.activeProject.averageSupport)"
          />
          <div class="threshold-marker" />
        </div>
        <small class="hint">Need 40% average support to pass</small>
      </div>

      <!-- NPC Support List -->
      <h4 class="subsection-title">Council Members</h4>
      <div class="npc-list">
        <div
          v-for="npc in state.npcInfluence.npcs"
          :key="npc.id"
          class="npc-row"
          :class="{ selected: selectedNPCForLobby === npc.id }"
          @click="selectedNPCForLobby = npc.id"
        >
          <span class="npc-name">{{ npc.name }}</span>
          <GBadge :variant="getFactionVariant(npc.faction)">
            {{ npc.faction }}
          </GBadge>
          <span
            class="support-value"
            :class="`support-${getSupportVariant(state.npcInfluence.activeProject.supportLevels[npc.id] || 0)}`"
          >
            {{ formatSupport(state.npcInfluence.activeProject.supportLevels[npc.id] || 0) }}
          </span>
        </div>
      </div>

      <!-- Lobbying Controls -->
      <div v-if="selectedNPCForLobby" class="lobby-controls">
        <h4 class="subsection-title">
          Lobby {{ state.npcInfluence.npcs.find(n => n.id === selectedNPCForLobby)?.name }}
        </h4>
        <div class="lobby-row">
          <div class="lobby-field">
            <label class="field-label">Boost</label>
            <GSelect
              :model-value="lobbyAmount"
              :options="lobbyOptions"
              size="sm"
              @update:model-value="handleLobbyAmountChange"
            />
          </div>
          <div class="lobby-cost">
            <span class="field-label">Cost</span>
            <span class="cost-value">{{ lobbyCost }} materials</span>
          </div>
          <GButton variant="primary" size="sm" :disabled="!canLobby" @click="lobbyNPC">
            Lobby
          </GButton>
        </div>
      </div>
    </section>

    <!-- Propose New Project -->
    <section v-else class="section">
      <h3 class="section-title">Propose a Project</h3>
      <div class="project-list">
        <GActionCard
          v-for="project in state.npcInfluence.projects"
          :key="project.id"
          :title="project.name"
          :description="project.description"
          :cost="formatProjectCost(project.proposalCost)"
          :selected="selectedProject === project.id"
          @click="selectedProject = project.id"
        >
          <template #tag>
            <GBadge :variant="getFactionVariant(project.type)">
              {{ project.type }}
            </GBadge>
          </template>
        </GActionCard>
      </div>
      <GButton variant="primary" :disabled="!canProposeProject" @click="proposeProject">
        Propose Selected Project
      </GButton>
    </section>

    <!-- Councils -->
    <section class="section">
      <h3 class="section-title">Councils</h3>
      <div v-if="state.npcInfluence.councils.length === 0" class="empty-state">
        No councils formed yet.
      </div>
      <div v-else class="council-list">
        <div v-for="council in state.npcInfluence.councils" :key="council.id" class="council-item">
          <span class="council-name">{{ council.name }}</span>
          <GBadge variant="muted">{{ council.memberIds.length }} members</GBadge>
        </div>
      </div>

      <h4 class="subsection-title">Form New Council</h4>
      <GInput
        v-model="councilName"
        placeholder="Council name"
        size="sm"
      />
      <div class="council-member-select">
        <div
          v-for="npc in state.npcInfluence.npcs"
          :key="npc.id"
          class="council-member-option"
          :class="{ selected: selectedCouncilMembers.includes(npc.id) }"
          @click="toggleCouncilMember(npc.id)"
        >
          {{ npc.name }}
        </div>
      </div>
      <GButton variant="primary" :disabled="!canCreateCouncil" @click="createCouncil">
        Create Council (50 materials)
      </GButton>
    </section>
  </GPanel>
</template>

<style scoped>
.section {
  margin-bottom: var(--g-space-lg);
  padding-bottom: var(--g-space-md);
  border-bottom: 1px solid var(--g-color-border);
}

.section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.section-title {
  margin: 0 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.subsection-title {
  margin: var(--g-space-md) 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.project-status {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.project-name {
  font-weight: 600;
  color: var(--g-color-text);
}

.status-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.status-label {
  color: var(--g-color-text-muted);
}

.threshold-container {
  position: relative;
  margin: var(--g-space-xs) 0;
}

.threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 70%;
  width: 2px;
  background: var(--g-color-text);
  opacity: 0.5;
}

.hint {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.npc-list,
.project-list,
.council-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  margin: var(--g-space-sm) 0;
}

.npc-row,
.council-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color var(--g-transition-fast), background var(--g-transition-fast);
}

.npc-row:hover {
  background: var(--g-color-bg-elevated);
}

.npc-row.selected {
  border-color: var(--g-color-info);
  background: oklch(65% 0.15 250 / 0.1);
}

.npc-name {
  flex: 1;
  font-size: var(--g-font-size-sm);
}

.support-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.support-positive {
  color: var(--g-color-positive);
}

.support-negative {
  color: var(--g-color-negative);
}

.support-default {
  color: var(--g-color-text-muted);
}

.lobby-controls {
  margin-top: var(--g-space-md);
  padding: var(--g-space-sm);
  background: var(--g-color-bg);
  border-radius: 4px;
}

.lobby-row {
  display: flex;
  align-items: flex-end;
  gap: var(--g-space-md);
}

.lobby-field {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.lobby-cost {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.field-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
}

.cost-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-warning);
}

.council-item {
  cursor: default;
}

.council-name {
  flex: 1;
  font-size: var(--g-font-size-sm);
}

.council-member-select {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
  margin: var(--g-space-sm) 0;
}

.council-member-option {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color var(--g-transition-fast), background var(--g-transition-fast);
}

.council-member-option:hover {
  border-color: var(--g-color-border-focus);
}

.council-member-option.selected {
  border-color: var(--g-color-positive);
  background: oklch(70% 0.17 145 / 0.15);
  color: var(--g-color-positive);
}

.empty-state {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  font-style: italic;
  padding: var(--g-space-sm) 0;
}
</style>
