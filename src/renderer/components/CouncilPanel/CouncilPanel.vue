<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import { GBadge, GButton, GInput, GPanel } from "../../ui";

const state = gameService.getState();
const api = gameService.api;

const councilName = ref("");
const selectedMembers = ref<string[]>([]);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canCreateCouncil = computed(() => {
  return (
    selectedMembers.value.length >= 2 &&
    councilName.value.trim() !== "" &&
    state.resources.materials >= 50
  );
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function createCouncil(): void {
  if (!councilName.value || selectedMembers.value.length < 2) return;
  const result = api.npc.createCouncil(councilName.value, selectedMembers.value);
  if (!result.success) {
    console.warn(`Council creation failed: ${result.error.type}`, result.error);
  }
  councilName.value = "";
  selectedMembers.value = [];
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function toggleMember(npcId: string) {
  const idx = selectedMembers.value.indexOf(npcId);
  if (idx === -1) {
    selectedMembers.value.push(npcId);
  } else {
    selectedMembers.value.splice(idx, 1);
  }
}
</script>

<template>
  <GPanel title="Councils" accent="slate">
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
        :class="{ selected: selectedMembers.includes(npc.id) }"
        @click="toggleMember(npc.id)"
      >
        {{ npc.name }}
      </div>
    </div>
    <GButton variant="primary" :disabled="!canCreateCouncil" @click="createCouncil">
      Create Council (50 materials)
    </GButton>
  </GPanel>
</template>

<style scoped>
.subsection-title {
  margin: var(--g-space-md) 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.council-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  margin: var(--g-space-sm) 0;
}

.council-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
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
  border: var(--g-border-width) solid var(--g-color-border-strong);
  cursor: pointer;
  transition: background var(--g-transition-fast);
}

.council-member-option:hover {
  background: var(--g-color-bg-surface);
}

.council-member-option.selected {
  background: var(--g-color-bg-surface);
}

.empty-state {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  font-style: italic;
  padding: var(--g-space-sm) 0;
}
</style>
