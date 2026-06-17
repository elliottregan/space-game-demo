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
        v-for="(card, index) in candidates"
        :key="`${card.id}-${index}`"
        class="draw-card"
        :class="{ kept: isKept(card.id) }"
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
            :disabled="!isKept(card.id) && !canKeep(card.id)"
            :title="keepTitle(card)"
            @click="toggleKeep(card.id)"
          >
            {{ isKept(card.id) ? "Keep ✓" : "Keep" }}
          </button>
        </div>
      </li>
    </ul>

    <div class="draw-foot">
      <button type="button" class="primary enact" @click="emitEnact">Enact policies</button>
      <p class="draw-caption">Unkept candidates discard to their ideology pile.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

const emit = defineEmits<{
  enact: [keepIds: string[]];
}>();

/** Ids the player has chosen to keep this turn (select-then-enact). */
const keep = ref<Set<string>>(new Set());
// Reset the selection whenever a new batch of candidates is drawn.
watch(
  () => props.candidates,
  () => {
    keep.value = new Set();
  },
);

function isKept(cardId: string): boolean {
  return keep.value.has(cardId);
}

/** Ids already occupying a tableau slot (stacking onto these costs no new slot). */
const slottedIds = computed(() => new Set(props.tableau.map((s) => s.card.id)));

/** Distinct kept ids that would need a brand-new tableau slot. */
const projectedNewSlots = computed(
  () => [...keep.value].filter((id) => !slottedIds.value.has(id)).length,
);

/**
 * A candidate can be newly kept when keeping it would not exceed the 5-slot cap.
 * Keeping an id that already stacks (slotted, or already kept) is always allowed.
 */
function canKeep(cardId: string): boolean {
  if (keep.value.has(cardId)) return true;
  if (slottedIds.value.has(cardId)) return true; // stacks onto an existing slot
  return props.tableau.length + projectedNewSlots.value < MAX_SLOTS;
}

function keepTitle(card: PolicyCard): string {
  if (isKept(card.id)) return `Drop ${card.name} from keepers`;
  if (canKeep(card.id)) return `Keep ${card.name}`;
  return "Tableau full (5 slots)";
}

function toggleKeep(cardId: string): void {
  const next = new Set(keep.value);
  if (next.has(cardId)) next.delete(cardId);
  else if (canKeep(cardId)) next.add(cardId);
  keep.value = next;
}

function emitEnact(): void {
  emit("enact", [...keep.value]);
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

.draw-card.kept {
  box-shadow:
    var(--shadow-interactive),
    inset 0 0 0 2px var(--card-accent, var(--ink));
}

.draw-foot {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.enact {
  align-self: flex-start;
}

.draw-caption {
  margin: 0;
  font-size: 10px;
  line-height: 1.3;
  color: var(--ink-subtle);
}
</style>
