<template>
  <div
    :class="[
      'cell land-cell',
      { occupied: cards.length > 0, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="cards.length === 0" class="cell-empty">
      <span class="cell-empty-label">Land</span>
    </div>
    <CardStack v-else :cards="cards">
      <button class="cell-action" @click.stop="$emit('discard')">Discard</button>
    </CardStack>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../../core/types.ts";
import CardStack from "../core/CardStack.vue";

defineProps<{
  cards: CardT[];
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ discard: [] }>();
</script>
