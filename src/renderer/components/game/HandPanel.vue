<template>
  <Panel class="hand-panel" :title="`Hand (${hand.length})`">
    <div class="hand-cards">
      <Card
        v-for="card in hand"
        :key="card.id"
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
      <div v-if="hand.length === 0" style="color: var(--text-subtle); padding: 40px">
        Empty hand
      </div>
    </div>

    <!-- Fixed-height action area. Reserves vertical space whether or not a
         selection is active, so the panel itself never resizes and pushes
         the tableau above. -->
    <div class="hand-actions">
      <span v-if="selectedCards.length === 0" class="hand-hint">
        Click cards to select. Actions apply to all selected.
      </span>

      <template v-else>
        <div class="action-meta">
          <span>{{ selectedIds.length }} selected</span>
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
import { computed } from "vue";
import type { Card as CardT, Column } from "../../../core/types.ts";
import Card from "../core/Card.vue";
import Panel from "../core/Panel.vue";
import { beginDrag, endDrag, dragging } from "../../util/dragState.ts";
import { identifyRowHand, canCommitHand } from "../../../core/engine/rowHands.ts";

const props = defineProps<{
  hand: CardT[];
  selectedIds: string[];
  influence: number;
  columns: Column[];
  validColumnsFor: (cardId: string) => number[];
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

/** Columns where EVERY playable selected card can be placed in order
 * (Land row stacks lands of matching rank; Influence holds one Role;
 * Charter holds one Charter). Simulating sequential placement avoids
 * promising slots where only the first selected card actually fits. */
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
 * For 2+ card selections that form a valid row-hand, return all (columnIndex, row)
 * targets that can accept the hand via commitHand.
 */
const commitTargets = computed<{ columnIndex: number; row: "land" | "influence" }[]>(() => {
  const cards = playableSelection.value;
  if (cards.length < 2) return [];
  const out: { columnIndex: number; row: "land" | "influence" }[] = [];
  for (let i = 0; i < props.columns.length; i++) {
    for (const row of ["land", "influence"] as const) {
      if (canCommitHand(props.columns[i], row, cards)) {
        out.push({ columnIndex: i, row });
      }
    }
  }
  return out;
});

/** Label for the row-hand the selection forms (first matching row type). */
const rowHandLabel = computed<string | null>(() => {
  const cards = playableSelection.value;
  if (cards.length === 0) return null;
  const landHand = rowHandForRow("land");
  if (landHand) return formatHand(landHand);
  const influenceHand = rowHandForRow("influence");
  if (influenceHand) return formatHand(influenceHand);
  return null;
});

function rowHandForRow(row: "land" | "influence"): string | null {
  const cards = playableSelection.value;
  if (cards.length === 0) return null;
  const requiredKind = row === "land" ? "land" : "role";
  if (cards.some((c) => c.kind !== requiredKind)) return null;
  return identifyRowHand(cards);
}

function formatHand(hand: string): string {
  return hand
    .split("-")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

function canPlaceAllSequentially(cards: CardT[], col: Column): boolean {
  let landCount = col.lands.cards.length;
  let landRank: number | null = col.lands.cards[0]?.rank ?? null;
  let influenceFilled = col.influence.cards.length > 0;
  let charterFilled = col.charter.card !== null;
  for (const c of cards) {
    if (c.kind === "land") {
      if (landCount >= 4) return false;
      if (landRank !== null && landRank !== c.rank) return false;
      landCount++;
      landRank = c.rank;
    } else if (c.kind === "role") {
      if (influenceFilled) return false;
      if (landCount < 1) return false;
      influenceFilled = true;
    } else if (c.kind === "charter") {
      if (charterFilled) return false;
      if (!influenceFilled) return false;
      charterFilled = true;
    } else {
      return false;
    }
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
</script>
