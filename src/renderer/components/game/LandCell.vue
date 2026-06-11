<template>
  <div class="cell land-cell" :class="{ occupied: cards.length > 0 }">
    <!-- fit-content wrapper: storage anchors to the actual stack/placeholder
         edge, not the (column-wide) cell, so the peek survives wide stacks. -->
    <div class="land-content">
      <!-- Storage: rotated stack behind the active stack, peeking right.
           Only offered once the column holds a Land (storage is unlocked by
           play) — but always shown while it still holds cards. -->
      <div
        v-if="storage.length > 0 || cards.length > 0"
        class="storage-layer"
        :class="{ empty: storage.length === 0 }"
        v-drop-zone="storageZone"
      >
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
  // Core enforces the Land prerequisite too; this gate keeps the highlight
  // and drop affordance honest.
  accepts: () => props.cards.length > 0,
  onDrop: (p) => emit("store", p.cardId),
}));
</script>

<style scoped>
.land-cell {
  position: relative;
}
.land-content {
  position: relative;
  width: fit-content;
  margin: auto;
}
.land-stack {
  position: relative;
  z-index: 1;
}
.land-placeholder {
  position: relative;
  z-index: 1;
}
/* A stored card lurking behind a (translucent) empty placeholder would ghost
   through it — solidify the placeholder when storage is occupied. */
.storage-layer:not(.empty) + .land-placeholder {
  background: var(--mat-strong);
}
.storage-layer {
  position: absolute;
  top: 50%;
  /* Original (unrotated) box sits 16px past the wrapper's right edge; after
     the 90° spin about its center the visual box peeks ~35px out, showing
     the cards' header strip (rank + suit) along the right side. */
  right: -16px;
  transform: translateY(-50%) rotate(90deg);
  transform-origin: center center;
  z-index: 0;
  opacity: 0.55;
  transition: opacity 120ms ease;
}
.storage-layer:hover,
.storage-layer:focus-within {
  z-index: 2;
  opacity: 1;
}
.storage-layer.empty {
  width: 112px;
  height: 28px;
  /* Tab needs a bigger throw: its rotated box is only 28px wide, so push it
     fully clear of the wrapper edge to stay visible and hittable. */
  right: -72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mat-strong);
  font-size: 10px;
  color: var(--ink-subtle);
}
</style>
