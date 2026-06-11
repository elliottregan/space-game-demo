<template>
  <div
    :class="[
      'cell storage-cell',
      { occupied: cards.length > 0, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="cards.length === 0" class="cell-empty">
      <span class="cell-empty-label">Storage</span>
    </div>
    <div v-else class="storage-cards">
      <div v-for="card in cards" :key="card.id" class="storage-card">
        <Card
          :card="card"
          :compact="true"
          :selectable="true"
          :selected="selectedIds.includes(card.id)"
          @select="$emit('toggleSelect', card.id)"
        />
        <button
          v-if="canPlace(card)"
          class="cell-action"
          @click.stop="$emit('placeFromStorage', card.id)"
        >
          Play
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../../core/types.ts";
import Card from "../core/Card.vue";

defineProps<{
  cards: CardT[];
  selectedIds: string[];
  isDropTarget: boolean;
  isDragOver: boolean;
  /** Per-card: can this stored card be single-placed into this column right now? */
  canPlace: (card: CardT) => boolean;
}>();

defineEmits<{
  toggleSelect: [cardId: string];
  placeFromStorage: [cardId: string];
}>();
</script>

<style scoped>
/* Stored cards are plans, not assets: dimmed until attention lands on them. */
.storage-card {
  opacity: 0.55;
  transition: opacity 120ms ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.storage-card:hover,
.storage-card:focus-within {
  opacity: 1;
}
.storage-cards {
  display: flex;
  gap: var(--space-1);
}
</style>
