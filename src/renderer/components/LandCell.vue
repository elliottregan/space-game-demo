<template>
  <div
    :class="[
      'cell land-cell',
      { occupied: cards.length > 0, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="cards.length === 0" class="cell-empty">place a Land</div>
    <div v-else class="land-stack">
      <Card
        v-for="(card, i) in cards"
        :key="card.id + '@' + i"
        :card="card"
        :selectable="false"
      />
      <button v-if="cards.length > 0" class="cell-action" @click.stop="$emit('discard')">
        Discard
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";

defineProps<{
  cards: CardT[];
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ discard: [] }>();
</script>
