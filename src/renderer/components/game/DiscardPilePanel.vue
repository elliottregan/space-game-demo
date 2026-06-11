<template>
  <Panel class="pile-panel" title="Discard">
    <button
      ref="pileEl"
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
      <div class="pile-count">{{ discardCount }}</div>
      <div class="pile-hint">
        {{ isDragActive ? "drop to discard" : "click to review" }}
      </div>
    </button>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { dragging, endDrag, readDragPayload } from "../../util/dragState.ts";
import { registerPile } from "../../animation/cardFlight.ts";
import Panel from "../core/Panel.vue";

defineProps<{
  discardCount: number;
}>();

const emit = defineEmits<{
  view: [];
  dropCard: [cardId: string];
}>();

const pileEl = ref<HTMLElement | null>(null);
onMounted(() => registerPile("discard", pileEl.value));
onBeforeUnmount(() => registerPile("discard", null));

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
