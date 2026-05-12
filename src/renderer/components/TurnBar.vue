<template>
  <div class="turn-bar">
    <div class="meta">
      <b>Epoch {{ epochNumber }}</b> · {{ settingName }}
    </div>
    <div class="turn-progress" :class="{ near: turn / maxTurns >= 0.66, edge: turn / maxTurns >= 0.85 }">
      Turn {{ turn }} / {{ maxTurns }} · Crisis after T{{ maxTurns }}
    </div>
    <div class="resources">
      Inf {{ influence }} · Mat {{ materials }} · Dissent {{ dissentCount }}
    </div>
    <button :disabled="ended" @click="$emit('end-turn')">End turn</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  epochNumber: number;
  settingName: string;
  turn: number;
  maxTurns: number;
  influence: number;
  materials: number;
  dissentCount: number;
  dissentFraction: number;
  ended: boolean;
}>();
defineEmits<{ "end-turn": [] }>();
</script>

<style scoped>
.turn-progress.near { color: var(--warn, #c80); }
.turn-progress.edge { color: var(--danger, #c33); }
</style>
