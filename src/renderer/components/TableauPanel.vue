<template>
  <section class="section tableau-panel">
    <h2>Tableau · produces {{ production }} Mat / turn</h2>
    <div class="tableau-grid" :style="{ '--col-count': columns.length }">
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
import type { Card, Column } from "../../core/types.ts";
import TableauColumn from "./TableauColumn.vue";
import { dragging } from "../util/dragState.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand } from "../../core/column.ts";

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

function buildTooltip(i: number): string {
  const label = props.buildableLabels[i] ?? "";
  return label || "Build";
}

function validForDrag(i: number): { land: boolean; influence: boolean; charter: boolean } {
  const card = dragging.value ? props.getCardFromHand(dragging.value.cardId) : null;
  if (!card) return { land: false, influence: false, charter: false };
  const col = props.columns[i]!;
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
  grid-template-columns: 80px repeat(var(--col-count), 1fr);
  gap: 6px;
}
.row-labels {
  display: grid;
  grid-template-rows: auto auto auto auto;
  font-size: 12px;
  color: var(--text-muted);
}
.row-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
