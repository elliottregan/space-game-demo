<template>
  <section class="section tableau-panel">
    <h2>Tableau · produces {{ production }} Mat / turn</h2>
    <div
      class="tableau-grid"
      :style="{ '--col-count': columns.length, '--land-row-height': landRowHeight + 'px' }"
    >
      <div class="row-labels">
        <div class="row-label">Charter</div>
        <div class="row-label">Influence</div>
        <div class="row-label">Land</div>
        <div class="row-label"></div>
      </div>
      <TableauColumn
        v-for="(col, i) in columns"
        :key="i"
        :column="col"
        :buildable="columnBuildable[i] ?? false"
        :build-tooltip="buildTooltip(i)"
        :valid-for-drag="validForDrag(i)"
        @place-card="(cardId) => $emit('placeCard', cardId, i)"
        @discard-land="$emit('discardLand', i)"
        @discard-charter="$emit('discardCharter', i)"
        @recall-influence="$emit('recallInfluence', i)"
        @discard-column="$emit('discardColumn', i)"
        @build="$emit('build', i)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card, Column } from "../../../core/types.ts";
import TableauColumn from "./TableauColumn.vue";
import { dragging } from "../../util/dragState.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand } from "../../../core/engine/column.ts";

const STACK_OFFSET = 28;
const CARD_HEIGHT = 150;

const props = defineProps<{
  columns: Column[];
  production: number;
  columnBuildable: boolean[];
  buildableLabels: string[]; // one label per column (e.g., "Pair → The Commons (+2)")
  getCardFromHand: (cardId: string) => Card | null;
}>();

defineEmits<{
  placeCard: [cardId: string, columnIndex: number];
  discardLand: [columnIndex: number];
  discardCharter: [columnIndex: number];
  recallInfluence: [columnIndex: number];
  discardColumn: [columnIndex: number];
  build: [columnIndex: number];
}>();

const landRowHeight = computed(() => {
  const max = Math.max(1, ...props.columns.map((c) => c.lands.cards.length));
  return CARD_HEIGHT + (max - 1) * STACK_OFFSET;
});

function buildTooltip(i: number): string {
  const label = props.buildableLabels[i] ?? "";
  return label || "Build";
}

function validForDrag(i: number): { land: boolean; influence: boolean; charter: boolean } {
  const card = dragging.value ? props.getCardFromHand(dragging.value.cardId) : null;
  if (!card) return { land: false, influence: false, charter: false };
  const col = props.columns[i];
  return {
    land: card.kind === "land" && canPlaceLand(col, card),
    influence: card.kind === "role" && canPlaceInfluence(col, card),
    charter: card.kind === "charter" && canPlaceCharter(col, card),
  };
}
</script>

<style scoped>
.tableau-grid {
  display: grid;
  grid-template-columns: 80px repeat(var(--col-count), minmax(120px, 1fr));
  gap: 6px;
  align-items: start;
}
.row-labels {
  display: grid;
  /* The Land row grows with the tallest land stack; --land-row-height is
     set on .tableau-grid so all columns and labels stay aligned. */
  grid-template-rows: 150px 150px var(--land-row-height, 150px) auto;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.row-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
}
</style>
