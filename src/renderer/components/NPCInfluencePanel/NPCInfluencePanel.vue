<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";
import ActiveProposal from "./ActiveProposal.vue";
import LobbyControls from "./LobbyControls.vue";
import ProjectList from "./ProjectList.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries
const api = gameService.api;

const selectedNPCForLobby = ref<string | null>(null);
const lobbyAmount = ref(0.3);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const lobbyOptions: SelectOption[] = [
  { value: 0.1, label: "+10%" },
  { value: 0.2, label: "+20%" },
  { value: 0.3, label: "+30%" },
  { value: 0.5, label: "+50%" },
];

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
const selectedNPC = computed(() => {
  return state.npcInfluence.npcs.find((n) => n.id === selectedNPCForLobby.value);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function proposeProject(projectId: string): void {
  const result = api.npc.proposeProject(projectId);
  if (!result.success) {
    console.warn(`Proposal failed: ${result.error.type}`, result.error);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function lobbyNPC(): void {
  if (!selectedNPCForLobby.value) return;
  const result = api.npc.lobbyNPC(selectedNPCForLobby.value, lobbyAmount.value);
  if (!result.success) {
    console.warn(`Lobbying failed: ${result.error.type}`, result.error);
  }
}
</script>

<template>
  <GPanel title="Council Politics" accent="slate">
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
      @propose="proposeProject"
    />
  </GPanel>
</template>
