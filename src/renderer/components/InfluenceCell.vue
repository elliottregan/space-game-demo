<template>
  <div
    :class="[
      'cell influence-cell',
      { occupied: !!card, locked: locked, 'drop-target': isDropTarget, 'drag-over': isDragOver },
    ]"
  >
    <div v-if="locked" class="cell-locked">
      <span class="lock-glyph">🔒</span>
      <span class="lock-hint">place a Land first</span>
    </div>
    <div v-else-if="!card" class="cell-empty">place a Role</div>
    <div v-else class="cell-content">
      <Card :card="card" :selectable="false" />
      <button class="cell-action" @click.stop="$emit('recall')">Recall</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";

defineProps<{
  card: CardT | null;
  locked: boolean;
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ recall: [] }>();
</script>
