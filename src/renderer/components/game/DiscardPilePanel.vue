<template>
  <Panel class="pile-panel" title="Discard">
    <div class="pile-zone">
      <button
        :class="[
          'pile-stack',
          'pile-discard',
          { 'drop-target': isDragActive, 'drag-over': isDragOver },
        ]"
        @click="$emit('view')"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <!-- Flight anchor: the top card's footprint, so discards land
             exactly on the visible top of the stack. -->
        <span ref="pileEl" class="pile-card-area" aria-hidden="true"></span>
        <span
          v-for="i in underLayers"
          :key="i"
          class="pile-layer"
          :style="{ translate: `${i * 2.5}px ${i * 2.5}px`, rotate: JITTER[i - 1] }"
        ></span>
        <CardBack v-if="discardCount > 0" class="pile-top-card" />
        <span v-else class="pile-silhouette"></span>
        <span v-if="discardCount > 0" class="pile-count-badge">{{ discardCount }}</span>
      </button>
      <div class="pile-hint">
        {{ isDragActive ? "drop to discard" : discardCount > 0 ? "click to review" : "empty" }}
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dragging, endDrag, readDragPayload } from "../../util/dragState.ts";
import { registerPile } from "../../animation/cardFlight.ts";
import Panel from "../core/Panel.vue";
import CardBack from "../core/CardBack.vue";

const props = defineProps<{
  discardCount: number;
}>();

const emit = defineEmits<{
  view: [];
  dropCard: [cardId: string];
}>();

/** Tossed-on jitter so the discard reads as a heap, not a squared deck. */
const JITTER = ["-2.2deg", "1.6deg", "-1.1deg"];

const pileEl = ref<HTMLElement | null>(null);
onMounted(() => registerPile("discard", pileEl.value));
onBeforeUnmount(() => registerPile("discard", null));

const underLayers = computed(() => {
  if (props.discardCount <= 1) return 0;
  if (props.discardCount <= 5) return 1;
  if (props.discardCount <= 15) return 2;
  return 3;
});

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
