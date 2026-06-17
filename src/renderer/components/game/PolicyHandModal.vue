<template>
  <!--
    Blocking policy-hand gate. A light scrim covers the board and intercepts
    pointer events (board stays visible underneath, but is not interactive);
    the centered panel floats over the hand area and is the only interactive
    surface. No escape / scrim-click dismissal — resolving is required.
  -->
  <div class="policy-modal-scrim">
    <div class="policy-modal" role="dialog" aria-modal="true" aria-label="Resolve drawn policies">
      <header class="pm-head">
        <span class="pm-title">Drawn policies</span>
        <span class="pm-counts" aria-label="Policy draws by ideology this turn">
          <span
            v-for="entry in drawCounts"
            :key="entry.ideology"
            class="pm-count"
            :style="{ '--count-accent': cssColorFor(entry.ideology) }"
            :title="`${entry.label}: ${entry.count} ${entry.count === 1 ? 'draw' : 'draws'} this turn`"
          >
            <span class="count-dot" aria-hidden="true"></span>
            <span class="count-num">{{ entry.count }}</span>
          </span>
        </span>
      </header>

      <div class="pm-cards">
        <div
          v-for="(card, index) in candidates"
          :key="`${card.id}-${index}`"
          class="pm-card-slot"
          :class="{ locked: !isKept(card.id) && !canKeep(card.id) }"
          :data-candidate-index="index"
          :data-candidate-id="card.id"
          :data-candidate-ideology="card.ideology"
        >
          <PolicyCard
            :card="card"
            selectable
            :selected="isKept(card.id)"
            @select="toggleKeep(card.id)"
          />
          <span
            v-if="!isKept(card.id) && !canKeep(card.id)"
            class="pm-lock-reason"
            :title="`Tableau full (${MAX_SLOTS} slots)`"
            >Tableau full ({{ MAX_SLOTS }} slots)</span
          >
        </div>
      </div>

      <div class="pm-foot">
        <button type="button" class="primary pm-enact" @click="emitEnact">Enact policies</button>
        <p class="pm-caption">Unkept policies discard to their ideology pile.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PolicyCard as PolicyCardT, PolicySlot, Ideology } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import PolicyCard from "./PolicyCard.vue";

const MAX_SLOTS = 5;

const props = defineProps<{
  candidates: PolicyCardT[];
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
/* Light scrim over the board: visible-but-inert. Sits above rail flyouts (50)
   and below the crisis screen (100); this is an in-turn gate, not a
   campaign-level overlay. */
.policy-modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.policy-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: min(92vw, 880px);
  max-height: 90vh;
  overflow: auto;
  padding: var(--space-4);
  background: var(--paper);
  box-shadow: var(--shadow-lifted);
}

.pm-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.pm-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}
.pm-counts {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.pm-count {
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

.pm-cards {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: center;
  gap: var(--space-3);
}

.pm-card-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}
.pm-card-slot.locked {
  opacity: 0.5;
}
/* A locked candidate cannot be selected even though PolicyCard is `selectable`;
   the toggle is gated by canKeep, so clicks are inert here. */
.pm-card-slot.locked :deep(.policy-card) {
  cursor: not-allowed;
}

.pm-lock-reason {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-subtle);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pm-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}
.pm-enact {
  align-self: center;
}
.pm-caption {
  margin: 0;
  font-size: 10px;
  line-height: 1.3;
  color: var(--ink-subtle);
  text-align: center;
}
</style>
