<template>
  <Panel class="tableau-panel" :title="`Tableau · produces ${production} Mat / turn`">
    <div class="tableau-scroll">
      <div
        class="tableau-grid"
        :style="{ '--col-count': columns.length, '--col-min-width': colMinWidth + 'px' }"
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
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card, Column } from "../../../core/types.ts";
import TableauColumn from "./TableauColumn.vue";
import Panel from "../core/Panel.vue";
import { dragging } from "../../util/dragState.ts";
import { canPlaceCharter, canPlaceInfluence, canPlaceLand } from "../../../core/engine/column.ts";

const STACK_OFFSET = 28;
const CARD_WIDTH = 112;

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

const colMinWidth = computed(() => {
  const max = Math.max(
    1,
    ...props.columns.flatMap((c) => [c.lands.cards.length, c.influence.cards.length]),
  );
  return CARD_WIDTH + (max - 1) * STACK_OFFSET;
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
.tableau-scroll {
  overflow-x: auto;
  min-width: 0;
}
.tableau-grid {
  display: grid;
  /* Column tracks grow with the widest horizontal land stack;
     --col-min-width is set on this grid so all columns match. */
  grid-template-columns: 80px repeat(var(--col-count), minmax(var(--col-min-width, 120px), 1fr));
  gap: var(--space-1);
  align-items: start;
}
.row-labels {
  display: grid;
  grid-template-rows: 150px 150px 150px auto;
  gap: var(--space-1);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  /* Pin to the left edge as the tableau scrolls horizontally, and keep
     them above stacked cards (max ~hover 9999) and cell buttons (10000). */
  position: sticky;
  left: 0;
  z-index: 10001;
  background: var(--surface-raised);
}
.row-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: var(--space-2);
}
</style>
