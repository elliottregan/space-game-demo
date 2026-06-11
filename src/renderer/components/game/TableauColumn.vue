<template>
  <div :class="['tableau-column', { 'drop-target': anyDropTarget, 'drag-over': isAnyDragOver }]">
    <CharterCell
      :card="column.charter.card"
      :locked="column.influence.cards.length === 0"
      :is-drop-target="charterDropTarget"
      :is-drag-over="dragOver === 'charter'"
      @dragenter.prevent="dragOver = charterDropTarget ? 'charter' : null"
      @dragover.prevent="onDragOver($event, 'charter')"
      @dragleave="dragOver = null"
      @drop.prevent="onDrop($event)"
      @discard="$emit('discard-charter')"
    />
    <InfluenceCell
      :cards="column.influence.cards"
      :locked="column.lands.cards.length === 0"
      :is-drop-target="influenceDropTarget"
      :is-drag-over="dragOver === 'influence'"
      @dragenter.prevent="dragOver = influenceDropTarget ? 'influence' : null"
      @dragover.prevent="onDragOver($event, 'influence')"
      @dragleave="dragOver = null"
      @drop.prevent="onDrop($event)"
      @recall="$emit('recall-influence')"
    />
    <LandCell
      :cards="column.lands.cards"
      :is-drop-target="landDropTarget"
      :is-drag-over="dragOver === 'land'"
      @dragenter.prevent="dragOver = landDropTarget ? 'land' : null"
      @dragover.prevent="onDragOver($event, 'land')"
      @dragleave="dragOver = null"
      @drop.prevent="onDrop($event)"
      @discard="$emit('discard-land')"
    />
    <StorageCell
      :cards="column.storage"
      :selected-ids="selectedStorageIds"
      :is-drop-target="storageDropTarget"
      :is-drag-over="dragOver === 'storage'"
      :can-place="canPlaceFromStorage"
      @dragenter.prevent="dragOver = storageDropTarget ? 'storage' : null"
      @dragover.prevent="onDragOver($event, 'storage')"
      @dragleave="dragOver = null"
      @drop.prevent="onStorageDrop($event)"
      @toggle-select="(id) => $emit('toggle-storage-select', id)"
      @place-from-storage="(id) => $emit('place-from-storage', id)"
    />
    <ColumnFooter
      :empty="empty"
      :buildable="buildable"
      :build-tooltip="buildTooltip"
      @discard-column="$emit('discard-column')"
      @build="$emit('build')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Card as CardT, Column } from "../../../core/types.ts";
import CharterCell from "./CharterCell.vue";
import InfluenceCell from "./InfluenceCell.vue";
import LandCell from "./LandCell.vue";
import StorageCell from "./StorageCell.vue";
import ColumnFooter from "./ColumnFooter.vue";
import { dragging, endDrag, readDragPayload } from "../../util/dragState.ts";

const props = defineProps<{
  column: Column;
  buildable: boolean;
  buildTooltip: string;
  validForDrag: { land: boolean; influence: boolean; charter: boolean };
  selectedStorageIds: string[];
  storageCapacity: number;
  canPlaceFromStorage: (card: CardT) => boolean;
}>();

const emit = defineEmits<{
  "place-card": [cardId: string];
  "store-card": [cardId: string];
  "toggle-storage-select": [cardId: string];
  "place-from-storage": [cardId: string];
  "discard-land": [];
  "discard-charter": [];
  "recall-influence": [];
  "discard-column": [];
  build: [];
}>();

const dragOver = ref<"land" | "influence" | "charter" | "storage" | null>(null);

const landDropTarget = computed(() => dragging.value !== null && props.validForDrag.land);
const influenceDropTarget = computed(() => dragging.value !== null && props.validForDrag.influence);
const charterDropTarget = computed(() => dragging.value !== null && props.validForDrag.charter);
// Storage accepts ANY dragged card; a full slot still accepts (replace).
const storageDropTarget = computed(() => dragging.value !== null);
const anyDropTarget = computed(
  () =>
    landDropTarget.value ||
    influenceDropTarget.value ||
    charterDropTarget.value ||
    storageDropTarget.value,
);
const isAnyDragOver = computed(() => dragOver.value !== null);
const empty = computed(
  () =>
    props.column.lands.cards.length === 0 &&
    props.column.influence.cards.length === 0 &&
    props.column.charter.card === null,
);

function onDragOver(e: DragEvent, row: "land" | "influence" | "charter" | "storage"): void {
  if (e.dataTransfer && rowAcceptsDrag(row)) e.dataTransfer.dropEffect = "move";
}
function rowAcceptsDrag(row: "land" | "influence" | "charter" | "storage"): boolean {
  if (row === "storage") return storageDropTarget.value;
  return row === "land"
    ? props.validForDrag.land
    : row === "influence"
      ? props.validForDrag.influence
      : props.validForDrag.charter;
}
function onDrop(e: DragEvent): void {
  dragOver.value = null;
  // Any drop in this column routes via card kind (core decides row).
  if (!anyDropTarget.value) return;
  const payload = readDragPayload(e);
  if (!payload) return;
  emit("place-card", payload.cardId);
  endDrag();
}
function onStorageDrop(e: DragEvent): void {
  dragOver.value = null;
  const payload = readDragPayload(e);
  if (!payload) return;
  emit("store-card", payload.cardId);
  endDrag();
}
</script>

<style scoped>
.tableau-column {
  display: grid;
  /* Matches the row heights in TableauPanel's row-labels so rows align
     across all columns and the row labels in the left margin. */
  grid-template-rows: 150px 150px 150px auto auto;
  gap: 6px;
}
</style>
