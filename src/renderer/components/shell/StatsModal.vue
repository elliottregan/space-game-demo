<template>
  <div class="eoe-overlay" @click.self="$emit('close')">
    <div class="card-list-panel">
      <div class="card-list-header">
        <h2>Stats</h2>
        <button @click="$emit('close')">Close</button>
      </div>

      <div class="stats-body">
        <MonumentsSection :monuments="monuments" />
        <LegacyCardsSection :cards="legacyCards" />
        <DeckCountsSection :counts="counts" />
        <EventLogSection :events="events" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameEvent, LegacyCard, Monument } from "../../../core/types.ts";
import MonumentsSection from "./sidebar/MonumentsSection.vue";
import LegacyCardsSection from "./sidebar/LegacyCardsSection.vue";
import DeckCountsSection from "./sidebar/DeckCountsSection.vue";
import EventLogSection from "./sidebar/EventLogSection.vue";

defineProps<{
  monuments: Monument[];
  legacyCards: LegacyCard[];
  counts: { hand: number; draw: number; discard: number; dissent: number };
  events: GameEvent[];
}>();

defineEmits<{ close: [] }>();
</script>

<style scoped>
/* Reuses the global .card-list-panel / .card-list-header modal chrome
   (theme.css), matching CardListModal; only the stacked, scrolling body of
   sections is specific to this modal. */
.stats-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  flex: 1;
}
</style>
