<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";
import ActiveProposal from "./ActiveProposal.vue";
import LobbyControls from "./LobbyControls.vue";
import ProjectList from "./ProjectList.vue";
import CouncilSection from "./CouncilSection.vue";

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
const selectedNPC = computed(() => {
  return state.npcInfluence.npcs.find(n => n.id === selectedNPCForLobby.value);
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
</script>

<template>
  <GPanel title="Council Politics">
    <!-- Active Project Status -->
    <ActiveProposal
      v-if="state.npcInfluence.activeProject"
      :active-project="state.npcInfluence.activeProject"
      :npcs="state.npcInfluence.npcs"
      :projects="state.npcInfluence.projects"
      :selected-n-p-c-for-lobby="selectedNPCForLobby"
      @select-npc="selectedNPCForLobby = $event"
    />

    <!-- Lobbying Controls -->
    <LobbyControls
      v-if="state.npcInfluence.activeProject"
      :npc="selectedNPC"
      :lobby-amount="lobbyAmount"
      :lobby-cost="lobbyCost"
      :can-lobby="canLobby"
      :lobby-options="lobbyOptions"
      @lobby="lobbyNPC"
      @update:lobby-amount="lobbyAmount = $event"
    />

    <!-- Propose New Project -->
    <ProjectList
      v-if="!state.npcInfluence.activeProject"
      :projects="state.npcInfluence.projects"
      :selected-project="selectedProject"
      :can-propose="canProposeProject"
      @select="selectedProject = $event"
      @propose="proposeProject"
    />

    <!-- Councils -->
    <CouncilSection
      :councils="state.npcInfluence.councils"
      :npcs="state.npcInfluence.npcs"
      :council-name="councilName"
      :selected-members="selectedCouncilMembers"
      :can-create="canCreateCouncil"
      @update:council-name="councilName = $event"
      @toggle-member="toggleCouncilMember"
      @create="createCouncil"
    />
  </GPanel>
</template>
