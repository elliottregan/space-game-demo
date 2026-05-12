<template>
  <section class="section hand-panel">
    <div class="hand-header">
      <h2>Hand ({{ hand.length }})</h2>
      <div v-if="selectedIds.length > 0" class="selection-meta">
        {{ selectedIds.length }} selected
        <button class="linklike" @click="$emit('clearSelection')">clear</button>
      </div>
    </div>
    <div class="hand-cards">
      <Card
        v-for="card in hand"
        :key="card.id"
        :card="card"
        :selectable="true"
        :selected="selectedIds.includes(card.id)"
        :unaffordable="!canPlay(card)"
        :influence-cost-override="getEffectiveCost(card)"
        :alignment="getAlignment(card)"
        :draggable="true"
        :is-dragging="dragging?.cardId === card.id"
        @select="$emit('toggleSelect', card.id)"
        @dragstart="onCardDragStart(card, $event)"
        @dragend="onCardDragEnd"
      />
      <div v-if="hand.length === 0" style="color: var(--text-subtle); padding: 40px">Empty hand</div>
    </div>

    <div class="hand-actions">
      <template v-if="selectedCards.length === 0">
        <span style="color: var(--text-subtle)"
          >Click cards to select. Actions apply to all selected.</span
        >
      </template>

      <template v-else>
        <!-- Play: only when every selected card is playable AND has a common slot -->
        <template
          v-if="playableSelection.length === selectedCards.length && validSharedSlots.length > 0"
        >
          <button
            v-for="idx in validSharedSlots"
            :key="idx"
            class="primary"
            :disabled="!allAffordable"
            @click="$emit('place-cards', selectedIds, idx)"
          >
            {{ playVerb }} {{ selectedCards.length }} → Col {{ idx + 1 }}
          </button>
        </template>
        <span
          v-else-if="
            playableSelection.length === selectedCards.length && validSharedSlots.length === 0
          "
          style="color: var(--text-muted)"
        >
          No slot fits all selected cards.
        </span>
        <span v-else-if="playableSelection.length > 0" style="color: var(--text-muted)">
          Selection mixes playable and un-playable cards — Play disabled.
        </span>
        <span v-else style="color: var(--text-muted)">Selection has no playable cards.</span>

        <button
          class="secondary"
          title="Discards the selected cards. Each adds 1 Quiet Dissent to the deck."
          @click="$emit('discard-from-hand', selectedIds)"
        >
          Discard (+1 Dissent)
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";
import { beginDrag, endDrag, dragging } from "../util/dragState.ts";

const props = defineProps<{
  hand: CardT[];
  selectedIds: string[];
  influence: number;
  getEffectiveCost: (card: CardT) => number;
  getAlignment: (card: CardT) => "aligned" | "opposed" | "neutral";
  validColumnsFor: (cardId: string) => number[];
}>();

defineEmits<{
  toggleSelect: [cardId: string];
  clearSelection: [];
  "place-cards": [cardIds: string[], columnIndex: number];
  "discard-from-hand": [cardIds: string[]];
}>();

const selectedCards = computed(() =>
  props.selectedIds.map((id) => props.hand.find((c) => c.id === id)!).filter(Boolean),
);

const playableSelection = computed(() => selectedCards.value.filter((c) => !isDissent(c)));

/** Slots where EVERY playable selected card can be played. */
const validSharedSlots = computed(() => {
  const cards = playableSelection.value;
  if (cards.length === 0) return [];
  const slotSets = cards.map((c) => new Set(props.validColumnsFor(c.id)));
  const first = slotSets[0];
  if (!first) return [];
  const intersection: number[] = [];
  for (const s of first) {
    if (slotSets.every((set) => set.has(s))) intersection.push(s);
  }
  return intersection.sort((a, b) => a - b);
});

const allAffordable = computed(() => {
  // Lands are free; Roles/Keystones cost Influence. Sum non-Land costs.
  let total = 0;
  for (const c of playableSelection.value) {
    if (c.kind !== "land") total += props.getEffectiveCost(c);
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
  return props.influence >= props.getEffectiveCost(card);
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
