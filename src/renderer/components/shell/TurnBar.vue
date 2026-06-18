<template>
  <div class="turn-bar">
    <div class="meta">
      <b>Epoch {{ epochNumber }}</b> · {{ settingName }}
    </div>
    <div
      class="turn-progress"
      :class="{ near: turn / maxTurns >= 0.66, edge: turn / maxTurns >= 0.85 }"
    >
      Turn {{ turn }} / {{ maxTurns }} · Crisis after T{{ maxTurns }}
    </div>
    <div class="resources">Inf {{ influence }} · Dissent {{ dissentCount }}</div>
    <div class="effective" title="Active rules after policy modifiers">
      Hand {{ effective.handSize
      }}<span v-if="handDelta" class="delta">({{ signed(handDelta) }})</span> · Inf
      {{ effective.influenceBaseline
      }}<span v-if="infDelta" class="delta">({{ signed(infDelta) }})</span> · Storage
      {{ effective.storageCapacity
      }}<span v-if="storageDelta" class="delta">({{ signed(storageDelta) }})</span>
    </div>
    <button :disabled="ended" @click="$emit('end-turn')">End turn</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EffectiveRules } from "../../../core/types.ts";

const props = defineProps<{
  epochNumber: number;
  settingName: string;
  turn: number;
  maxTurns: number;
  influence: number;
  dissentCount: number;
  ended: boolean;
  /** Active rules after policy modifiers. */
  effective: EffectiveRules;
  /** Base setting rules — for computing (+N) deltas. */
  baseHandSize: number;
  baseInfluenceBaseline: number;
  baseStorageCapacity: number;
}>();
defineEmits<{ "end-turn": [] }>();

const handDelta = computed(() => props.effective.handSize - props.baseHandSize);
const infDelta = computed(() => props.effective.influenceBaseline - props.baseInfluenceBaseline);
const storageDelta = computed(() => props.effective.storageCapacity - props.baseStorageCapacity);

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
</script>

<style scoped>
.turn-progress.near {
  color: var(--status-warning);
}
.turn-progress.edge {
  color: var(--status-negative);
}
.effective {
  font-size: 11px;
  color: var(--ink-muted);
}
.effective .delta {
  margin-left: 2px;
  color: var(--ink-subtle);
}
</style>
