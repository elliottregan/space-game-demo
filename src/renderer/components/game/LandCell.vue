<template>
  <div class="cell land-cell" :class="{ occupied: cards.length > 0 }">
    <!-- Storage: rotated stack behind the active stack, peeking right. -->
    <div class="storage-layer" :class="{ empty: storage.length === 0 }" v-drop-zone="storageZone">
      <span v-if="storage.length === 0" class="storage-tab-label">Storage</span>
      <CardStack
        v-else
        :cards="storage"
        direction="horizontal"
        :selectable="true"
        :selected-ids="selectedStorageIds"
        @select="(id) => $emit('toggleStorageSelect', id)"
      >
        <button
          v-if="storage.length === 1 && canPlaceStored(storage[0])"
          class="cell-action"
          @click.stop="$emit('playFromStorage', storage[0].id)"
        >
          Play
        </button>
      </CardStack>
    </div>

    <div v-if="cards.length === 0" class="cell-empty land-placeholder" v-drop-zone="landZone">
      <span class="cell-empty-label">Land</span>
    </div>
    <CardStack
      v-else
      :cards="cards"
      direction="horizontal"
      class="land-stack"
      :drop-zone="landZone"
    >
      <button class="cell-action" @click.stop="$emit('discard')">Discard</button>
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
  storage: CardT[];
  selectedStorageIds: string[];
  canPlaceStored: (card: CardT) => boolean;
  acceptsLandDrop: boolean;
}>();

const emit = defineEmits<{
  discard: [];
  place: [cardId: string];
  store: [cardId: string];
  toggleStorageSelect: [cardId: string];
  playFromStorage: [cardId: string];
}>();

const landZone = computed<DropZoneOptions>(() => ({
  accepts: () => props.acceptsLandDrop,
  onDrop: (p) => emit("place", p.cardId),
}));

const storageZone = computed<DropZoneOptions>(() => ({
  onDrop: (p) => emit("store", p.cardId),
}));
</script>

<style scoped>
.land-cell {
  position: relative;
}
.land-stack {
  position: relative;
  z-index: 1;
}
.land-placeholder {
  position: relative;
  z-index: 1;
}
.storage-layer {
  position: absolute;
  top: 50%;
  right: -34px;
  transform: translateY(-50%) rotate(90deg);
  z-index: 0;
  opacity: 0.55;
  transition: opacity 120ms ease;
  transform-origin: center center;
}
.storage-layer:hover,
.storage-layer:focus-within {
  z-index: 2;
  opacity: 1;
}
.storage-layer.empty {
  width: 112px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mat-strong);
  font-size: 10px;
  color: var(--ink-subtle);
}
</style>
