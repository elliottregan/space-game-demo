<template>
  <div
    :class="[
      'policy-card',
      `suit-${card.ideology}`,
      {
        selectable,
        selected,
      },
    ]"
    :style="{ '--card-accent': cssColorFor(card.ideology) }"
    :role="selectable ? 'button' : undefined"
    :tabindex="selectable ? 0 : undefined"
    :aria-pressed="selectable ? selected : undefined"
    @click="selectable ? $emit('select') : undefined"
    @keydown="onKeydown"
  >
    <div class="policy-card-face policy-card-front">
      <div class="pc-accent" aria-hidden="true"></div>
      <SuitGlyph class="pc-watermark" :variant="card.ideology" :size="72" :aria-hidden="true" />
      <div class="pc-body">
        <div class="pc-header">
          <SuitGlyph :variant="card.ideology" :size="14" :title="ideologyLabel" />
          <span class="pc-name">{{ card.name }}</span>
          <span v-if="stacks > 1" class="pc-stacks" :title="`${stacks} stacked`"
            >×{{ stacks }}</span
          >
        </div>
        <div class="pc-effect">{{ effectText }}</div>
        <div v-if="card.flavor" class="pc-flavor">{{ card.flavor }}</div>
      </div>
      <button
        v-if="removable"
        type="button"
        class="pc-remove"
        :title="`Remove ${card.name}`"
        :aria-label="`Remove ${card.name}`"
        @click.stop="$emit('remove')"
      >
        ×
      </button>
    </div>
    <CardBack class="policy-card-face policy-card-back-face" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PolicyCard } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { describePolicy } from "../../util/policies.ts";
import SuitGlyph from "../core/SuitGlyph.vue";
import CardBack from "../core/CardBack.vue";

const props = withDefaults(
  defineProps<{
    card: PolicyCard;
    selectable?: boolean;
    selected?: boolean;
    /** Show a `×N` badge when > 1 (stacked copies in a tableau slot). */
    stacks?: number;
    removable?: boolean;
  }>(),
  {
    selectable: false,
    selected: false,
    stacks: 1,
    removable: false,
  },
);

const emit = defineEmits<{
  select: [];
  remove: [];
}>();

function onKeydown(event: KeyboardEvent) {
  if (!props.selectable) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("select");
  }
}

const effectText = computed(() => describePolicy(props.card));
const ideologyLabel = computed(() => IDEOLOGY_DISPLAY[props.card.ideology].name);
</script>

<style scoped>
.policy-card {
  --card-accent: var(--ink-subtle);
  position: relative;
  /* Landscape: wider than tall (~1.5:1). */
  width: 180px;
  aspect-ratio: 3 / 2;
  font-size: 11px;
  flex-shrink: 0;
  user-select: none;
  transform-style: preserve-3d;
}

.policy-card-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  backface-visibility: hidden;
}

.policy-card-front {
  display: flex;
  align-items: stretch;
  background: var(--paper);
  box-shadow: var(--shadow-interactive);
  transition: background 0.08s;
}

.policy-card-back-face {
  transform: rotateY(180deg);
}

.pc-accent {
  flex: 0 0 6px;
  background: var(--card-accent);
}

.pc-watermark {
  position: absolute;
  right: -18px;
  bottom: -18px;
  opacity: 0.12;
  pointer-events: none;
  color: var(--card-accent);
}

.pc-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pc-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.pc-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pc-stacks {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--card-accent);
  padding: 0 var(--space-1);
  box-shadow: inset 0 0 0 1.5px var(--card-accent);
}

.pc-effect {
  font-size: 10px;
  line-height: 1.3;
  color: var(--ink-muted);
}

.pc-flavor {
  margin-top: auto;
  font-size: 10px;
  line-height: 1.3;
  font-style: italic;
  color: var(--ink-subtle);
}

.pc-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
  color: var(--ink-muted);
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--rule);
  cursor: pointer;
}

.pc-remove:hover {
  color: var(--ink);
  background: var(--paper-hover);
}

.policy-card.selectable {
  cursor: pointer;
  transition: box-shadow 0.1s;
}

.policy-card.selectable:hover .policy-card-front {
  background: var(--paper-hover);
}

.policy-card.selectable:hover {
  box-shadow: var(--shadow-lifted);
}

.policy-card.selectable:focus-visible {
  box-shadow: var(--shadow-lifted);
  outline: none;
}

.policy-card.selected .policy-card-front {
  box-shadow:
    var(--shadow-interactive),
    inset 0 0 0 2px var(--card-accent);
}
</style>
