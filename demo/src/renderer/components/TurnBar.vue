<template>
  <div class="turn-bar">
    <span class="stat-pill">
      <span class="stat-label">Epoch</span>
      <span class="stat-value">{{ epochNumber }}</span>
    </span>
    <span class="stat-pill">
      <span class="stat-label">Setting</span>
      <span class="stat-value" style="text-transform: none">{{ settingName }}</span>
    </span>
    <span class="stat-pill">
      <span class="stat-label">Turn</span>
      <span class="stat-value">{{ turn }} / {{ turnLimit }}</span>
    </span>
    <span class="stat-pill">
      <span class="stat-label">Inf</span>
      <span class="stat-value">{{ influence }}</span>
    </span>
    <span class="stat-pill">
      <span class="stat-label">Mat</span>
      <span class="stat-value">{{ materials }}</span>
    </span>
    <span
      class="stat-pill"
      :class="{ danger: dissentFraction > 0.4 }"
      :title="`${Math.round(dissentFraction * 100)}% of deck`"
    >
      <span class="stat-label">Dissent</span>
      <span class="stat-value">{{ dissentCount }}</span>
    </span>
    <button class="primary" @click="$emit('endTurn')" :disabled="ended">End Turn</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  epochNumber: number;
  settingName: string;
  turn: number;
  turnLimit: number;
  influence: number;
  materials: number;
  dissentCount: number;
  dissentFraction: number;
  ended: boolean;
}>();

defineEmits<{
  endTurn: [];
}>();
</script>
