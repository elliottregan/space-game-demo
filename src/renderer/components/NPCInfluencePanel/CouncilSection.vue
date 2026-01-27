<script setup lang="ts">
import type { Council, NPC } from "../../../core/models/types";
import { GBadge, GButton, GInput } from "../../ui";

defineProps<{
  councils: Council[];
  npcs: NPC[];
  councilName: string;
  selectedMembers: string[];
  canCreate: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  "update:councilName": [name: string];
  "toggle-member": [npcId: string];
  create: [];
}>();
</script>

<template>
  <section class="section">
    <h3 class="section-title">Councils</h3>
    <div v-if="councils.length === 0" class="empty-state">No councils formed yet.</div>
    <div v-else class="council-list">
      <div v-for="council in councils" :key="council.id" class="council-item">
        <span class="council-name">{{ council.name }}</span>
        <GBadge variant="muted">{{ council.memberIds.length }} members</GBadge>
      </div>
    </div>

    <h4 class="subsection-title">Form New Council</h4>
    <GInput
      :model-value="councilName"
      placeholder="Council name"
      size="sm"
      @update:model-value="emit('update:councilName', $event)"
    />
    <div class="council-member-select">
      <div
        v-for="npc in npcs"
        :key="npc.id"
        class="council-member-option"
        :class="{ selected: selectedMembers.includes(npc.id) }"
        @click="emit('toggle-member', npc.id)"
      >
        {{ npc.name }}
      </div>
    </div>
    <GButton variant="primary" :disabled="!canCreate" @click="emit('create')">
      Create Council (50 materials)
    </GButton>
  </section>
</template>

<style scoped>
.section {
  margin-bottom: var(--g-space-lg);
  padding-bottom: var(--g-space-md);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
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
  letter-spacing: 0.1em;
}

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
