<template>
  <section v-if="candidates.length > 0" class="policy-draw">
    <header class="draw-head">
      <span class="draw-title">Policy candidates</span>
      <span class="draw-counts" aria-label="Policy draws by ideology this turn">
        <span
          v-for="entry in drawCounts"
          :key="entry.ideology"
          class="draw-count"
          :style="{ '--count-accent': cssColorFor(entry.ideology) }"
          :title="`${entry.label}: ${entry.count} ${entry.count === 1 ? 'draw' : 'draws'} this turn`"
        >
          <span class="count-dot" aria-hidden="true"></span>
          <span class="count-num">{{ entry.count }}</span>
        </span>
      </span>
    </header>

    <ul class="draw-list">
      <li
        v-for="card in candidates"
        :key="card.id"
        class="draw-card"
        :style="{ '--card-accent': cssColorFor(card.ideology) }"
      >
        <div class="card-accent" aria-hidden="true"></div>
        <div class="card-body">
          <div class="card-name">{{ card.name }}</div>
          <div class="card-desc">{{ describePolicy(card) }}</div>
          <div v-if="card.flavor" class="card-flavor">{{ card.flavor }}</div>
        </div>
        <div class="card-actions">
          <button
            type="button"
            class="primary"
            :disabled="!canSlot(card.id)"
            :title="canSlot(card.id) ? `Slot ${card.name}` : 'Tableau full'"
            @click="$emit('slot', card.id)"
          >
            Slot
          </button>
          <button
            type="button"
            class="linklike"
            :title="`Discard ${card.name}`"
            @click="$emit('discard', card.id)"
          >
            Discard
          </button>
        </div>
      </li>
    </ul>

    <p class="draw-caption">Unslotted candidates auto-discard at end of turn.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PolicyCard, PolicySlot, Ideology } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { describePolicy } from "../../util/policies.ts";

const MAX_SLOTS = 5;

const props = defineProps<{
  candidates: PolicyCard[];
  /** Current tableau — used to compute whether a candidate can still be slotted. */
  tableau: PolicySlot[];
  /** Per-ideology majority-counter tally = this turn's per-deck draw counts. */
  influence: Record<Ideology, number>;
}>();

defineEmits<{
  slot: [cardId: string];
  discard: [cardId: string];
}>();

/**
 * A candidate can be slotted when the tableau has a free slot, OR when its id
 * already occupies a slot (in which case it stacks and consumes no new slot).
 */
function canSlot(cardId: string): boolean {
  if (props.tableau.length < MAX_SLOTS) return true;
  return props.tableau.some((slot) => slot.card.id === cardId);
}

/** Ideology-colored draw counts, only for ideologies that drew this turn. */
const drawCounts = computed(() =>
  IDEOLOGIES.filter((ideology) => props.influence[ideology] > 0).map((ideology) => ({
    ideology,
    count: props.influence[ideology],
    label: IDEOLOGY_DISPLAY[ideology].name,
  })),
);
</script>

<style scoped>
.policy-draw {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.draw-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.draw-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}
.draw-counts {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.draw-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.count-dot {
  width: 8px;
  height: 8px;
  background: var(--count-accent, var(--ink-subtle));
}
.count-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-muted);
}

.draw-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.draw-card {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--paper);
  box-shadow: var(--shadow-interactive);
}
.card-accent {
  flex: 0 0 4px;
  background: var(--card-accent, var(--ink-subtle));
}
.card-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
}
.card-desc {
  font-size: 10px;
  line-height: 1.3;
  color: var(--ink-muted);
}
.card-flavor {
  font-size: 10px;
  line-height: 1.3;
  font-style: italic;
  color: var(--ink-subtle);
}
.card-actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
}
.card-actions button {
  white-space: nowrap;
}

.draw-caption {
  margin: 0;
  font-size: 10px;
  line-height: 1.3;
  color: var(--ink-subtle);
}
</style>
