<template>
  <section class="section deck-discard-panel">
    <h2>Piles</h2>
    <div class="pile-row">
      <button
        class="pile-stack pile-deck"
        @click="$emit('view', 'deck')"
        :disabled="drawCount === 0"
      >
        <div class="pile-label">Deck</div>
        <div class="pile-count">{{ drawCount }}</div>
        <div class="pile-hint">click to review</div>
      </button>
      <button
        class="pile-stack pile-discard"
        @click="$emit('view', 'discard')"
        :disabled="discardCount === 0"
      >
        <div class="pile-label">Discard</div>
        <div class="pile-count">{{ discardCount }}</div>
        <div class="pile-hint">click to review</div>
      </button>
    </div>
    <div v-if="dissentCount > 0" class="dissent-note">Includes {{ dissentCount }} Dissent.</div>
    <button class="market-button" @click="$emit('openMarket')">Market</button>
    <button class="end-turn-big primary" :disabled="ended" @click="$emit('endTurn')">
      End Turn
    </button>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  drawCount: number;
  discardCount: number;
  dissentCount: number;
  ended: boolean;
}>();

defineEmits<{
  view: [which: "deck" | "discard"];
  openMarket: [];
  endTurn: [];
}>();
</script>
