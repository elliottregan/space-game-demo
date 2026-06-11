<template>
  <div
    :class="[
      'cell influence-cell',
      {
        occupied: cards.length > 0,
        locked: locked,
      },
    ]"
  >
    <div v-if="locked" class="cell-locked">
      <span class="lock-hint">place a Land first</span>
    </div>
    <div v-else-if="cards.length === 0" class="cell-empty" v-drop-zone="dropZone">
      <span class="cell-empty-label">Influence</span>
    </div>
    <CardStack v-else :cards="cards" direction="horizontal" :drop-zone="dropZone">
      <button class="cell-action" @click.stop="$emit('recall')">Recall</button>
    </CardStack>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../../core/types.ts";
import CardStack from "../core/CardStack.vue";
import { vDropZone, type DropZoneOptions } from "../../util/dropZone.ts";

const props = defineProps<{
  cards: CardT[];
  locked: boolean;
  acceptsDrop: boolean;
}>();

const emit = defineEmits<{
  recall: [];
  place: [cardId: string];
}>();

const dropZone = computed<DropZoneOptions>(() => ({
  accepts: () => props.acceptsDrop,
  onDrop: (p) => emit("place", p.cardId),
}));
</script>
