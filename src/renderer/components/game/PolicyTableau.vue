<template>
  <div class="policy-tableau">
    <template v-for="(slot, i) in slots" :key="i">
      <PolicyCard
        v-if="slot"
        :data-policy-id="slot.card.id"
        :card="slot.card"
        :stacks="slot.stacks"
        removable
        @remove="$emit('remove', i)"
      />
      <div v-else class="policy-slot-empty" aria-hidden="true"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PolicySlot } from "../../../core/types.ts";
import PolicyCard from "./PolicyCard.vue";

const SLOT_COUNT = 5;

const props = defineProps<{
  tableau: PolicySlot[];
}>();

defineEmits<{
  remove: [slotIndex: number];
}>();

/** Always render SLOT_COUNT cells; trailing nulls are empty placeholders. */
const slots = computed<(PolicySlot | null)[]>(() =>
  Array.from({ length: SLOT_COUNT }, (_, i) => props.tableau[i] ?? null),
);
</script>

<style scoped>
.policy-tableau {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--space-2);
  min-width: 0;
}

/* Empty placeholder mirrors PolicyCard's landscape footprint. */
.policy-slot-empty {
  width: 180px;
  aspect-ratio: 3 / 2;
  flex-shrink: 0;
  background: var(--mat-strong);
  box-shadow: inset 0 0 0 1px var(--rule);
}
</style>
