<template>
  <section class="section tableau-panel">
    <h2>Tableau · produces {{ production }} Mat / turn</h2>
    <div class="tableau-slots">
      <TableauSlot
        v-for="(slot, i) in tableau"
        :key="i"
        :slot="slot"
        :index="i"
        :can-retrieve="canRetrieve(i)"
        :retrieve-cost="retrieveCost(i)"
        :valid-slots-for-drag="validSlotsForDraggedCard"
        @retrieve="$emit('retrieve', i)"
        @drop-card="(cardId) => $emit('dropCard', cardId, i)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TableauSlot as TableauSlotT } from "../../core/types.ts";
import TableauSlot from "./TableauSlot.vue";
import { dragging } from "../util/dragState.ts";

const props = defineProps<{
  tableau: TableauSlotT[];
  production: number;
  canRetrieve: (slotIndex: number) => boolean;
  retrieveCost: (slotIndex: number) => { inf: number; mat: number } | null;
  validSlotsFor: (cardId: string) => number[];
}>();

defineEmits<{
  retrieve: [slotIndex: number];
  dropCard: [cardId: string, slotIndex: number];
}>();

const validSlotsForDraggedCard = computed(() =>
  dragging.value ? props.validSlotsFor(dragging.value.cardId) : [],
);
</script>
