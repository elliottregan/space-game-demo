<template>
  <aside class="sidebar">
    <TerrainSection :terrain="terrain" />
    <MonumentsSection :monuments="monuments" />
    <LegacyCardsSection :cards="legacyCards" />
    <DeckCountsSection :counts="counts" :dissent-threshold="dissentThreshold" />
    <EventLogSection :events="events" />
  </aside>
</template>

<script setup lang="ts">
import TerrainSection from "./sidebar/TerrainSection.vue";
import MonumentsSection from "./sidebar/MonumentsSection.vue";
import LegacyCardsSection from "./sidebar/LegacyCardsSection.vue";
import DeckCountsSection from "./sidebar/DeckCountsSection.vue";
import EventLogSection from "./sidebar/EventLogSection.vue";
import type { GameEvent, IdeologyTerrain, LegacyCard, Monument } from "../../core/types.ts";

defineProps<{
  terrain: IdeologyTerrain;
  monuments: Monument[];
  legacyCards: LegacyCard[];
  counts: { hand: number; draw: number; discard: number; dissent: number };
  events: GameEvent[];
  dissentThreshold: number;
}>();
</script>
