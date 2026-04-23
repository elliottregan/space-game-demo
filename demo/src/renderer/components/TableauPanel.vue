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
            :title="`Retrieve topmost card for ${retrieveCost} Inf`"
            @click="$emit('retrieve', i)"
          >
            Retrieve ({{ retrieveCost }} Inf)
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TableauSlot } from "../../core/types.ts";
import Card from "./Card.vue";

defineProps<{
  tableau: TableauSlot[];
  production: number;
  retrieveCost: number;
  canRetrieve: (slotIndex: number) => boolean;
}>();

defineEmits<{
  retrieve: [slotIndex: number];
}>();

function isImproved(slot: TableauSlot): boolean {
  return slot.lands.length >= 2;
}
</script>
