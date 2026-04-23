<template>
  <section class="section hand-panel">
    <h2>Hand ({{ hand.length }})</h2>
    <div class="hand-cards">
      <Card
        v-for="(card, idx) in hand"
        :key="card.id + idx"
        :card="card"
        :selectable="!isDissent(card)"
        :selected="selectedIndex === idx"
        :unaffordable="!canPlay(card)"
        :influence-cost-override="getEffectiveCost(card)"
        :alignment="getAlignment(card)"
        @select="$emit('selectCard', idx)"
      />
      <div v-if="hand.length === 0" style="color: var(--fg-muted); padding: 40px">Empty hand</div>
    </div>

    <div class="hand-actions">
      <template v-if="selectedCard && !isDissent(selectedCard)">
        <template v-if="validSlots.length > 0">
          <button
            v-for="idx in validSlots"
            :key="idx"
            class="primary"
            :disabled="!canPlay(selectedCard)"
            @click="$emit('playCard', selectedIndex!, idx)"
          >
            {{ selectedCard.kind === "land" ? "Place" : "Play" }} → Slot {{ idx + 1 }}
          </button>
        </template>
        <span v-else style="color: var(--fg-dim)">
          {{
            selectedCard.kind === "land"
              ? "No valid slot (sealed or rank mismatch)."
              : "No improved slot available — stack a matching-rank Land first."
          }}
        </span>
        <button
          class="secondary"
          :title="`Discard for +${discardGain} Mat`"
          @click="$emit('discardForMaterial', selectedIndex!)"
        >
          Discard (+{{ discardGain }} Mat)
        </button>
      </template>
      <template v-else-if="selectedCard && isDissent(selectedCard)">
        <span style="color: var(--fg-dim)">Dissent cannot be played.</span>
        <button
          class="secondary"
          :title="`Discard for +${discardGain} Mat`"
          @click="$emit('discardForMaterial', selectedIndex!)"
        >
          Discard (+{{ discardGain }} Mat)
        </button>
      </template>
      <span v-else style="color: var(--fg-muted)">Select a card to see valid slots.</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../core/types.ts";
import Card from "./Card.vue";

const props = defineProps<{
  hand: CardT[];
  selectedIndex: number | null;
  influence: number;
  validSlots: number[]; // valid slot indices for the currently selected card
  discardGain: number;
  getEffectiveCost: (card: CardT) => number;
  getAlignment: (card: CardT) => "aligned" | "opposed" | "neutral";
}>();

defineEmits<{
  selectCard: [index: number];
  playCard: [handIndex: number, slotIndex: number];
  discardForMaterial: [handIndex: number];
}>();

const selectedCard = computed(() =>
  props.selectedIndex !== null ? (props.hand[props.selectedIndex] ?? null) : null,
);

function isDissent(card: CardT): boolean {
  return card.tags.includes("dissent");
}

function canPlay(card: CardT): boolean {
  if (isDissent(card)) return false;
  if (card.kind === "land") return true;
  return props.influence >= props.getEffectiveCost(card);
}
</script>
