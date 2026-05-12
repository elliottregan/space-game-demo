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
    <div v-else class="land-stack">
      <Card :card="topCard" :selectable="false" />
      <div v-if="cards.length > 1" class="depth-badge">×{{ cards.length }}</div>
      <button class="cell-action" @click.stop="$emit('discard')">Discard</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../../core/types.ts";
import Card from "../core/Card.vue";

const props = defineProps<{
  cards: CardT[];
  isDropTarget: boolean;
  isDragOver: boolean;
}>();

defineEmits<{ discard: [] }>();

const topCard = computed(() => props.cards[props.cards.length - 1]!);
</script>
