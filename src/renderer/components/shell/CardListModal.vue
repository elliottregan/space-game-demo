<template>
  <div class="eoe-overlay" @click.self="$emit('close')">
    <div class="card-list-panel">
      <div class="card-list-header">
        <h2>{{ title }} · {{ cards.length }} card{{ cards.length === 1 ? "" : "s" }}</h2>
        <button @click="$emit('close')">Close</button>
      </div>

      <div v-if="cards.length === 0" class="card-list-empty">No cards.</div>
      <div v-else class="card-list-grid">
        <Card
          v-for="(card, i) in sortedCards"
          :key="card.id + i"
          :card="card"
          :selectable="false"
        />
      </div>

      <div class="card-list-footer">
        <span class="card-list-hint">
          Note: deck order is hidden — cards shown sorted for review.
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../../core/types.ts";
import Card from "../core/Card.vue";

const props = defineProps<{
  title: string;
  cards: CardT[];
}>();

defineEmits<{ close: [] }>();

const sortedCards = computed(() => {
  const copy = [...props.cards];
  copy.sort((a, b) => {
    // Dissent last, then by ideology, then by rank, then by name.
    const aDis = a.tags.includes("dissent") ? 1 : 0;
    const bDis = b.tags.includes("dissent") ? 1 : 0;
    if (aDis !== bDis) return aDis - bDis;
    if (a.ideology !== b.ideology) return a.ideology.localeCompare(b.ideology);
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.name.localeCompare(b.name);
  });
  return copy;
});
</script>
