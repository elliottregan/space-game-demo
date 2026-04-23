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
        @retrieve="$emit('retrieve', i)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TableauSlot as TableauSlotT } from "../../core/types.ts";
import TableauSlot from "./TableauSlot.vue";

defineProps<{
  tableau: TableauSlotT[];
  production: number;
  canRetrieve: (slotIndex: number) => boolean;
  retrieveCost: (slotIndex: number) => { inf: number; mat: number } | null;
}>();

defineEmits<{ retrieve: [slotIndex: number] }>();
</script>
