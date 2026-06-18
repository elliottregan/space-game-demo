<template>
  <div class="tableau-column">
    <InfluenceCell
      :cards="column.influence.cards"
      :locked="column.lands.cards.length === 0"
      :accepts-drop="validForDrag.influence"
      @place="(id) => $emit('place-card', id)"
      @recall="$emit('recall-influence')"
    />
    <LandCell
      :cards="column.lands.cards"
      :storage="column.storage"
      :selected-storage-ids="selectedStorageIds"
      :can-place-stored="canPlaceFromStorage"
      :accepts-land-drop="validForDrag.land"
      @place="(id) => $emit('place-card', id)"
      @store="(id) => $emit('store-card', id)"
      @toggle-storage-select="(id) => $emit('toggle-storage-select', id)"
      @play-from-storage="(id) => $emit('place-from-storage', id)"
      @discard="$emit('discard-land')"
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
import { computed } from "vue";
import type { Card as CardT, Column } from "../../../core/types.ts";
import InfluenceCell from "./InfluenceCell.vue";
import LandCell from "./LandCell.vue";
import ColumnFooter from "./ColumnFooter.vue";

const props = defineProps<{
  column: Column;
  buildable: boolean;
  buildTooltip: string;
  validForDrag: { land: boolean; influence: boolean };
  selectedStorageIds: string[];
  canPlaceFromStorage: (card: CardT) => boolean;
}>();

defineEmits<{
  "place-card": [cardId: string];
  "store-card": [cardId: string];
  "toggle-storage-select": [cardId: string];
  "place-from-storage": [cardId: string];
  "discard-land": [];
  "recall-influence": [];
  "discard-column": [];
  build: [];
}>();

const empty = computed(
  () => props.column.lands.cards.length === 0 && props.column.influence.cards.length === 0,
);
</script>

<style scoped>
.tableau-column {
  display: grid;
  /* Matches the row heights in TableauPanel's row-labels so rows align
     across all columns and the row labels in the left margin. */
  grid-template-rows: 150px 150px auto;
  gap: 6px;
}
</style>
