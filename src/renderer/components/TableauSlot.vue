<template>
  <div :class="['tableau-slot', { improved: isImproved }]">
    <div class="slot-header">
      Slot {{ index + 1 }}
      <span v-if="slot.lands.length > 0" :class="['slot-status', { improved: isImproved }]">
        {{ statusLabel }}
      </span>
      <span v-else class="slot-status slot-empty-text">empty</span>
    </div>

    <div v-if="slot.lands.length === 0 && !slot.topper" class="tableau-slot-empty">
      place any Land
    </div>
    <div v-else class="stack">
      <Card
        v-for="(card, j) in slot.lands"
        :key="'l-' + card.id + j"
        :card="card"
        :selectable="false"
      />
      <Card v-if="slot.topper" :card="slot.topper" :selectable="false" class="topper-card" />
    </div>

    <div v-if="slot.lands.length > 0 || slot.topper" class="slot-actions">
      <button :disabled="!canRetrieve" :title="retrieveTitle" @click="$emit('retrieve')">
        {{ retrieveLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TableauSlot } from "../../core/types.ts";
import Card from "./Card.vue";

const props = defineProps<{
  slot: TableauSlot;
  index: number;
  canRetrieve: boolean;
  retrieveCost: { inf: number; mat: number } | null;
}>();

defineEmits<{ retrieve: [] }>();

const isImproved = computed(() => props.slot.lands.length >= 2);

const statusLabel = computed(() => {
  const rank = props.slot.lands[0]?.rank;
  const n = props.slot.lands.length;
  if (!rank) return "empty";
  if (n === 1) return `Rank ${rank} · needs another to improve`;
  if (n === 2) return `Rank ${rank} · pair (improved)`;
  if (n === 3) return `Rank ${rank} · three of a kind`;
  if (n >= 4) return `Rank ${rank} · four of a kind`;
  return `Rank ${rank}`;
});

const retrieveLabel = computed(() => {
  const c = props.retrieveCost;
  if (!c) return "Retrieve";
  if (c.mat > 0) return `Retrieve (${c.inf} Inf + ${c.mat} Mat)`;
  return `Retrieve (${c.inf} Inf)`;
});

const retrieveTitle = computed(() => {
  const c = props.retrieveCost;
  if (!c) return "Retrieve topmost card";
  if (c.mat > 0) return "Retrieving this Land also generates 1 Quiet Dissent on top of the deck.";
  return "Retrieve topmost card";
});
</script>
