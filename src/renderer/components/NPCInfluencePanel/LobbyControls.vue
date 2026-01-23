<script setup lang="ts">
import { GButton, GSelect } from "../../ui";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";
import type { NPC } from "../../../core/models/types";

defineProps<{
  npc: NPC | undefined;
  lobbyAmount: number;
  lobbyCost: number;
  canLobby: boolean;
  lobbyOptions: SelectOption[];
}>();

const emit = defineEmits<{
  lobby: [];
  "update:lobbyAmount": [value: number];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function handleLobbyAmountChange(value: string | number) {
  emit("update:lobbyAmount", Number(value));
}
</script>

<template>
  <div v-if="npc" class="lobby-controls">
    <h4 class="subsection-title">
      Lobby {{ npc.name }}
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
      <GButton variant="primary" size="sm" :disabled="!canLobby" @click="$emit('lobby')">
        Lobby
      </GButton>
    </div>
  </div>
</template>

<style scoped>
.subsection-title {
  margin: var(--g-space-md) 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
</style>
