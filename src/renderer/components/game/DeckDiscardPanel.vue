<template>
  <Panel class="deck-discard-panel" title="Deck & Discard">
    <div class="pile-row">
      <button
        class="pile-stack pile-deck"
        @click="$emit('view', 'deck')"
        :disabled="drawCount === 0"
      >
        <div class="pile-label">Deck</div>
        <div class="pile-count">{{ drawCount }}</div>
        <div class="pile-hint">click to review</div>
      </button>
      <button
        :class="[
          'pile-stack',
          'pile-discard',
          { 'drop-target': isDragActive, 'drag-over': isDragOver },
        ]"
        @click="$emit('view', 'discard')"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <div class="pile-label">Discard</div>
        <div class="pile-count">{{ discardCount }}</div>
        <div class="pile-hint">
          {{ isDragActive ? "drop to discard" : "click to review" }}
        </div>
      </button>
    </div>
    <button class="market-button" @click="$emit('openMarket')">Market</button>
    <button class="end-turn-big primary" :disabled="ended" @click="$emit('endTurn')">
      End Turn
    </button>
  </Panel>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { dragging, endDrag, readDragPayload } from "../../util/dragState.ts";
import Panel from "../core/Panel.vue";

defineProps<{
  drawCount: number;
  discardCount: number;
  ended: boolean;
}>();

const emit = defineEmits<{
  view: [which: "deck" | "discard"];
  openMarket: [];
  endTurn: [];
  dropCard: [cardId: string];
}>();

const isDragActive = computed(() => dragging.value !== null);
const isDragOver = ref(false);

function onDragEnter(): void {
  if (isDragActive.value) isDragOver.value = true;
}
function onDragOver(e: DragEvent): void {
  if (!isDragActive.value) return;
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}
function onDragLeave(): void {
  isDragOver.value = false;
}
function onDrop(e: DragEvent): void {
  isDragOver.value = false;
  const payload = readDragPayload(e);
  if (!payload) return;
  emit("dropCard", payload.cardId);
  endDrag();
}
</script>
