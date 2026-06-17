<template>
  <div class="policy-tableau">
    <div
      v-for="(slot, i) in slots"
      :key="i"
      class="policy-slot"
      :class="{ filled: slot !== null }"
      :style="slot ? { '--slot-accent': cssColorFor(slot.card.ideology) } : undefined"
    >
      <template v-if="slot">
        <div class="slot-accent" aria-hidden="true"></div>
        <div class="slot-body">
          <div class="slot-header">
            <span class="slot-name">{{ slot.card.name }}</span>
            <span v-if="slot.stacks > 1" class="slot-stacks">×{{ slot.stacks }}</span>
          </div>
          <div class="slot-desc">{{ describePolicy(slot.card) }}</div>
        </div>
        <button
          type="button"
          class="slot-remove"
          :title="`Remove ${slot.card.name}`"
          :aria-label="`Remove ${slot.card.name}`"
          @click="$emit('remove', i)"
        >
          ×
        </button>
      </template>
      <span v-else class="slot-empty-label">Empty</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PolicySlot } from "../../../core/types.ts";
import { cssColorFor } from "../../../core/data/ideologies.ts";
import { describePolicy } from "../../util/policies.ts";

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
  gap: var(--space-2);
  min-width: 0;
}
.policy-slot {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 64px;
  display: flex;
  align-items: stretch;
  background: var(--mat-strong);
}
.policy-slot.filled {
  background: var(--paper);
  box-shadow: var(--shadow-interactive);
}
.slot-accent {
  flex: 0 0 4px;
  background: var(--slot-accent, var(--ink-subtle));
}
.slot-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.slot-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1);
}
.slot-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slot-stacks {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--slot-accent, var(--ink-muted));
}
.slot-desc {
  font-size: 10px;
  line-height: 1.3;
  color: var(--ink-muted);
}
.slot-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--ink-subtle);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.slot-remove:hover {
  color: var(--ink);
  background: var(--paper-hover);
}
.slot-empty-label {
  margin: auto;
  font-size: 10px;
  color: var(--ink-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
