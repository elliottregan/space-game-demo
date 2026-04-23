<template>
  <div style="display: flex; align-items: center; gap: 8px">
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
    <div class="spacer" style="flex: 1"></div>
    <button v-if="canPurge" @click="$emit('purge')" :disabled="materials < 5">
      Purge Dissent (5 Mat)
    </button>
    <button class="primary" @click="$emit('endTurn')" :disabled="ended">End Turn</button>
    <button @click="$emit('restart')" title="Restart campaign">New Campaign</button>
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
  canPurge: boolean;
  ended: boolean;
}>();

defineEmits<{
  endTurn: [];
  purge: [];
  restart: [];
}>();
</script>
