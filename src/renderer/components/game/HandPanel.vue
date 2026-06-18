<template>
  <Panel class="hand-panel" :title="`Hand (${hand.length})`">
    <TransitionGroup
      ref="handList"
      tag="div"
      class="hand-cards"
      :css="false"
      move-class="hand-move"
      @enter="onCardEnter"
      @leave="onCardLeave"
    >
      <Card
        v-for="card in hand"
        :key="card.id"
        :data-card-id="card.id"
        :card="card"
        :selectable="true"
        :selected="selectedIds.includes(card.id)"
        :unaffordable="!canPlay(card)"
        :draggable="true"
        :is-dragging="dragging?.cardId === card.id"
        @select="$emit('toggleSelect', card.id)"
        @dragstart="onCardDragStart(card, $event)"
        @dragend="onCardDragEnd"
      />
      <div v-if="hand.length === 0" key="empty-hand" class="hand-empty">Empty hand</div>
    </TransitionGroup>

    <!-- Fixed-height action area. Reserves vertical space whether or not a
         selection is active, so the panel itself never resizes and pushes
         the tableau above. -->
    <div class="hand-actions">
      <span v-if="selectedCards.length === 0 && !storageSelection" class="hand-hint">
        Click cards to select. Actions apply to all selected.
      </span>

      <template v-else>
        <div class="action-meta">
          <span
            >{{ selectedIds.length }} selected<template v-if="storageSelection">
              + {{ storageSelection.cards.length }} stored (Col
              {{ storageSelection.columnIndex + 1 }})</template
            ></span
          >
          <button class="linklike" @click="$emit('clearSelection')">clear</button>
          <span v-if="rowHandLabel" class="action-handlabel">
            · Hand: <strong>{{ rowHandLabel }}</strong>
          </span>
        </div>

        <div class="action-buttons">
          <template v-if="validSharedSlots.length > 0">
            <button
              v-for="idx in validSharedSlots"
              :key="'place-' + idx"
              class="primary"
              :disabled="!allAffordable"
              @click="$emit('place-cards', selectedIds, idx)"
            >
              {{ playVerb }} {{ selectedCards.length }} → Col {{ idx + 1 }}
            </button>
          </template>

          <template v-if="commitTargets.length > 0">
            <button
              v-for="t in commitTargets"
              :key="'commit-' + t.row + '-' + t.columnIndex"
              class="primary"
              @click="$emit('commit-to-row', t.columnIndex, t.row)"
            >
              Lay down as {{ t.row === "land" ? "Land" : "Influence" }} → Col
              {{ t.columnIndex + 1 }}
            </button>
          </template>

          <span
            v-if="validSharedSlots.length === 0 && commitTargets.length === 0"
            class="action-empty"
          >
            No valid placement for this selection.
          </span>
        </div>
      </template>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onBeforeUpdate, ref } from "vue";
import type { Card as CardT, Column } from "../../../core/types.ts";
import Card from "../core/Card.vue";
import Panel from "../core/Panel.vue";
import { beginDrag, endDrag, dragging } from "../../util/dragState.ts";
import { identifyRowHand, canCommitHand } from "../../../core/engine/rowHands.ts";
import { canPlaceLand, canPlaceInfluence } from "../../../core/engine/column.ts";
import { canOccupyRow } from "../../../core/engine/countsAs.ts";
import { animateDiscard, animateDraw, animatePlaced } from "../../animation/cardFlight.ts";

const props = defineProps<{
  hand: CardT[];
  selectedIds: string[];
  influence: number;
  columns: Column[];
  validColumnsFor: (cardId: string) => number[];
  /** Ids currently in the discard pile — tells the leave hook whether a
   * departing card flies to the discard or was placed on the tableau. */
  discardIds: string[];
  storageSelection: { columnIndex: number; cards: CardT[] } | null;
}>();

defineEmits<{
  toggleSelect: [cardId: string];
  clearSelection: [];
  "place-cards": [cardIds: string[], columnIndex: number];
  "commit-to-row": [columnIndex: number, row: "land" | "influence"];
}>();

const selectedCards = computed(() =>
  props.selectedIds.flatMap((id) => {
    const card = props.hand.find((c) => c.id === id);
    return card ? [card] : [];
  }),
);

const playableSelection = computed(() => selectedCards.value.filter((c) => !isDissent(c)));

/** Combined selection: hand cards + storage cards (storage pre-filtered to non-dissent). */
const combinedSelection = computed(() => [
  ...playableSelection.value,
  ...(props.storageSelection?.cards.filter((c) => !isDissent(c)) ?? []),
]);

/** Columns where EVERY playable selected card can be placed in order,
 * as determined by the core placement rules. Simulating sequential placement
 * avoids promising slots where only the first selected card actually fits. */
const validSharedSlots = computed(() => {
  const cards = playableSelection.value;
  if (cards.length === 0) return [];
  // Multi-card lay-down-hand: if the selection forms a valid row-hand for
  // land or influence, those are handled by commitTargets instead.
  if (cards.length > 1 && rowHandForRow("land") !== null) return [];
  if (cards.length > 1 && rowHandForRow("influence") !== null) return [];
  const out: number[] = [];
  for (let i = 0; i < props.columns.length; i++) {
    if (canPlaceAllSequentially(cards, props.columns[i])) out.push(i);
  }
  return out;
});

/**
 * For 2+ combined-card selections (hand + storage) that form a valid row-hand,
 * return all (columnIndex, row) targets that can accept the hand via commitHand.
 * When storage is selected, only the matching column is tested.
 */
const commitTargets = computed<{ columnIndex: number; row: "land" | "influence" }[]>(() => {
  const all = combinedSelection.value;
  if (all.length < 2) return [];
  const storSel = props.storageSelection;
  const out: { columnIndex: number; row: "land" | "influence" }[] = [];
  // Restrict to the storage column when storage is in play.
  const colIndices = storSel ? [storSel.columnIndex] : props.columns.map((_, i) => i);
  for (const i of colIndices) {
    for (const row of ["land", "influence"] as const) {
      if (canCommitHand(props.columns[i], row, all)) {
        out.push({ columnIndex: i, row });
      }
    }
  }
  return out;
});

/** Label for the row-hand the combined selection forms (first matching row type). */
const rowHandLabel = computed<string | null>(() => {
  const cards = combinedSelection.value;
  if (cards.length === 0) return null;
  const landHand = rowHandForRow("land");
  if (landHand) return formatHand(landHand);
  const influenceHand = rowHandForRow("influence");
  if (influenceHand) return formatHand(influenceHand);
  return null;
});

function rowHandForRow(row: "land" | "influence"): string | null {
  const cards = combinedSelection.value;
  if (cards.length === 0) return null;
  const requiredRow = row === "land" ? "land" : "role";
  if (cards.some((c) => !canOccupyRow(c, requiredRow))) return null;
  return identifyRowHand(cards);
}

function formatHand(hand: string): string {
  return hand
    .split("-")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

/**
 * Returns true if every card in `cards` can be placed onto `col` one after
 * another. Delegates to the real core helpers (`canPlaceLand`,
 * `canPlaceInfluence`) on a shallow column copy so this function can never
 * drift from the authoritative placement rules. A full joker (literal
 * kind:"role") is tried against the land row first, then influence, so it
 * routes into whichever row its row-eligibility allows.
 */
function canPlaceAllSequentially(cards: CardT[], col: Column): boolean {
  // Simulate sequential single-card placement with the real core rules.
  const sim: Column = {
    lands: { cards: [...col.lands.cards] },
    influence: { cards: [...col.influence.cards] },
    storage: [...col.storage],
  };
  for (const c of cards) {
    if (canPlaceLand(sim, c)) sim.lands.cards.push(c);
    else if (canPlaceInfluence(sim, c)) sim.influence.cards.push(c);
    else return false;
  }
  return true;
}

const allAffordable = computed(() => {
  // Lands are free; Roles/Keystones cost Influence. Sum non-Land costs.
  let total = 0;
  for (const c of playableSelection.value) {
    if (c.kind !== "land") total += c.influenceCost;
  }
  return props.influence >= total;
});

const playVerb = computed(() => {
  const kinds = new Set(playableSelection.value.map((c) => c.kind));
  if (kinds.size === 1 && kinds.has("land")) return "Place";
  return "Play";
});

function isDissent(card: CardT): boolean {
  return card.tags.includes("dissent");
}

function canPlay(card: CardT): boolean {
  if (isDissent(card)) return false;
  if (card.kind === "land") return true;
  return props.influence >= card.influenceCost;
}

function onCardDragStart(card: CardT, e: DragEvent): void {
  if (!e.dataTransfer) return;
  const payload = { cardId: card.id, source: "hand" as const };
  e.dataTransfer.setData("application/json", JSON.stringify(payload));
  e.dataTransfer.setData("text/plain", card.name);
  e.dataTransfer.effectAllowed = "move";
  beginDrag(payload);
}

function onCardDragEnd(): void {
  endDrag();
}

const handList = ref<{ $el?: HTMLElement } | null>(null);

/** Card rects captured just before each patch (Vue's own FLIP trick). Leave
 * hooks pin departing cards at these positions: by the time a given leave
 * fires, earlier leavers from the same update are already out of flow and
 * the centered row has reflowed, so a live rect would start the flight from
 * a shifted, gap-collapsed spot. */
const preUpdateRects = new Map<string, DOMRect>();
onBeforeUpdate(() => {
  preUpdateRects.clear();
  const root = handList.value?.$el;
  if (!root) return;
  for (const el of root.querySelectorAll<HTMLElement>("[data-card-id]")) {
    const id = el.dataset.cardId;
    if (id && el.style.position !== "fixed") preUpdateRects.set(id, el.getBoundingClientRect());
  }
});

function onCardEnter(el: Element, done: () => void): void {
  if (!(el instanceof HTMLElement) || !el.dataset.cardId) return done();
  animateDraw(el, done);
}

function onCardLeave(el: Element, done: () => void): void {
  if (!(el instanceof HTMLElement) || !el.dataset.cardId) return done();
  const from = preUpdateRects.get(el.dataset.cardId);
  if (props.discardIds.includes(el.dataset.cardId)) animateDiscard(el, done, from);
  else animatePlaced(el, done, from);
}
</script>
