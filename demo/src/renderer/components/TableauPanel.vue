<template>
  <section class="section tableau-panel">
    <h2>Tableau · produces {{ production }} Mat / turn</h2>
    <div class="tableau-slots">
      <div
        v-for="(slot, i) in tableau"
        :key="i"
        :class="['tableau-slot', { improved: isImproved(slot) }]"
      >
        <div class="slot-header">
          Slot {{ i + 1 }}
          <span v-if="slot.lands.length > 0" class="slot-status">
            rank {{ slot.lands[0]!.rank }} × {{ slot.lands.length
            }}<span v-if="isImproved(slot)"> · improved</span>
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
          <button
            :disabled="!canRetrieve(i)"
            :title="retrieveTitle(i)"
            @click="$emit('retrieve', i)"
          >
            {{ retrieveLabel(i) }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TableauSlot } from "../../core/types.ts";
import Card from "./Card.vue";

const props = defineProps<{
  tableau: TableauSlot[];
  production: number;
  canRetrieve: (slotIndex: number) => boolean;
  retrieveCost: (slotIndex: number) => { inf: number; mat: number } | null;
}>();

defineEmits<{
  retrieve: [slotIndex: number];
}>();

function isImproved(slot: TableauSlot): boolean {
  return slot.lands.length >= 2;
}

function retrieveLabel(i: number): string {
  const c = props.retrieveCost(i);
  if (!c) return "Retrieve";
  if (c.mat > 0) return `Retrieve (${c.inf} Inf + ${c.mat} Mat)`;
  return `Retrieve (${c.inf} Inf)`;
}

function retrieveTitle(i: number): string {
  const c = props.retrieveCost(i);
  if (!c) return "Retrieve topmost card";
  if (c.mat > 0) {
    return `Retrieving this Land also generates 1 Quiet Dissent on top of the deck.`;
  }
  return `Retrieve topmost card`;
}
</script>
