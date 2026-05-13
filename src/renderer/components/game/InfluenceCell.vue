<template>
  <div
    :class="[
      'cell influence-cell',
      {
        occupied: cards.length > 0,
        locked: locked,
        'drop-target': isDropTarget,
        'drag-over': isDragOver,
      },
    ]"
  >
    <div v-if="locked" class="cell-locked">
      <span class="lock-glyph">🔒</span>
      <span class="lock-hint">place a Land first</span>
    </div>
    <div v-else-if="cards.length === 0" class="cell-empty">
      <span class="cell-empty-label">Influence</span>
    </div>
    <CardStack v-else :cards="cards">
      <button class="cell-action" @click.stop="$emit('recall')">Recall</button>
    </CardStack>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../../core/types.ts";
import CardStack from "../core/CardStack.vue";

defineProps<{
  cards: CardT[];
  locked: boolean;
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ recall: [] }>();
</script>
