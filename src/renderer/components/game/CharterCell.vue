<template>
  <div :class="['cell charter-cell', { occupied: !!card, locked: locked }]">
    <div v-if="locked" class="cell-locked">
      <span class="lock-hint">fill Influence first</span>
    </div>
    <div v-else-if="!card" class="cell-empty" v-drop-zone="dropZone">
      <span class="cell-empty-label">Charter</span>
    </div>
    <div v-else class="cell-content" v-drop-zone="dropZone">
      <Card :card="card" :selectable="false" />
      <button class="cell-action" @click.stop="$emit('discard')">Discard</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../../core/types.ts";
import Card from "../core/Card.vue";
import { vDropZone, type DropZoneOptions } from "../../util/dropZone.ts";

const props = defineProps<{
  card: CardT | null;
  locked: boolean;
  acceptsDrop: boolean;
}>();

const emit = defineEmits<{
  discard: [];
  place: [cardId: string];
}>();

const dropZone = computed<DropZoneOptions>(() => ({
  accepts: () => props.acceptsDrop,
  onDrop: (p) => emit("place", p.cardId),
}));
</script>
