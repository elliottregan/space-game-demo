<template>
  <!-- Two labeled 2x2 grids of small landscape policy-pile tiles, one per
       ideology. Deck tiles show a CardBack face; discard tiles show the
       ideology accent. Each tile registers itself as a card-flight pile so
       enact choreography can fly cards to/from the right tile. -->
  <div class="policy-piles">
    <PileGrid label="Policy decks" :tiles="deckTiles" face="back" />
    <PileGrid label="Discards" :tiles="discardTiles" face="accent" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ideology, PolicyCard } from "../../../core/types.ts";
import { IDEOLOGIES } from "../../../core/data/ideologies.ts";
import { policyDeckPile, policyDiscardPile, type PileKind } from "../../animation/cardFlight.ts";
import PileGrid from "./PolicyPileGrid.vue";

const props = defineProps<{
  decks: Record<Ideology, PolicyCard[]>;
  discards: Record<Ideology, PolicyCard[]>;
}>();

interface Tile {
  ideology: Ideology;
  count: number;
  pile: PileKind;
}

const deckTiles = computed<Tile[]>(() =>
  IDEOLOGIES.map((ideology) => ({
    ideology,
    count: props.decks[ideology].length,
    pile: policyDeckPile(ideology),
  })),
);

const discardTiles = computed<Tile[]>(() =>
  IDEOLOGIES.map((ideology) => ({
    ideology,
    count: props.discards[ideology].length,
    pile: policyDiscardPile(ideology),
  })),
);
</script>

<style scoped>
.policy-piles {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}
</style>
