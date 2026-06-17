<template>
  <!-- One labeled 2x2 grid of small landscape pile tiles (one per ideology).
       Iterates the supplied tiles (already in stable IDEOLOGIES order). -->
  <section class="pile-grid">
    <h3 class="pile-grid-label">{{ label }}</h3>
    <div class="pile-grid-tiles">
      <PolicyPileTile
        v-for="tile in tiles"
        :key="tile.ideology"
        :ideology="tile.ideology"
        :count="tile.count"
        :pile="tile.pile"
        :face="face"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Ideology } from "../../../core/types.ts";
import type { PileKind } from "../../animation/cardFlight.ts";
import PolicyPileTile from "./PolicyPileTile.vue";

defineProps<{
  label: string;
  /** Deck tiles show a card back; discard tiles show the ideology accent. */
  face: "back" | "accent";
  tiles: { ideology: Ideology; count: number; pile: PileKind }[];
}>();
</script>

<style scoped>
.pile-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.pile-grid-label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}

.pile-grid-tiles {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: var(--space-1);
}
</style>
