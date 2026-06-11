<template>
  <div
    :class="[
      'card',
      `suit-${card.ideology}`,
      `kind-${card.kind}`,
      {
        selectable,
        selected,
        unaffordable,
        compact,
        dragging: isDragging,
      },
    ]"
    :draggable="draggable"
    @click="$emit('select')"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <div class="card-face card-front">
      <SuitGlyph
        v-if="!compact && card.kind !== 'dissent'"
        class="card-watermark"
        :variant="card.ideology"
        :size="96"
        :aria-hidden="true"
      />
      <div class="card-header">
        <span class="card-rank">{{ rankLabel(card.rank) }}</span>
        <SuitGlyph
          :variant="card.kind === 'dissent' ? 'dissent' : card.ideology"
          :size="14"
          :title="card.kind === 'dissent' ? 'Dissent' : suitLabel(card.ideology)"
        />
      </div>
      <div class="card-name">{{ card.name }}</div>
      <ul v-if="!compact && effectLines.length > 0" class="card-effect-list">
        <li v-for="(line, i) in effectLines" :key="i">{{ line }}</li>
      </ul>
      <div class="card-footer">
        <span
          v-if="showInfluence && card.kind !== 'land' && card.kind !== 'dissent'"
          class="card-inf-cost"
        >
          {{ card.influenceCost }} Inf
        </span>
        <span v-else-if="card.kind === 'land'" class="card-inf-cost">Land</span>
        <span v-else-if="card.kind === 'dissent'" class="card-inf-cost">—</span>
      </div>
    </div>
    <CardBack class="card-face card-back-face" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../../core/types.ts";
import { flattenEffect } from "../../util/effects.ts";
import { rankLabel, suitLabel } from "../../util/labels.ts";
import SuitGlyph from "./SuitGlyph.vue";
import CardBack from "./CardBack.vue";

const props = withDefaults(
  defineProps<{
    card: Card;
    selectable?: boolean;
    selected?: boolean;
    unaffordable?: boolean;
    showInfluence?: boolean;
    compact?: boolean;
    draggable?: boolean;
    isDragging?: boolean;
  }>(),
  {
    selectable: false,
    selected: false,
    unaffordable: false,
    showInfluence: true,
    compact: false,
    draggable: false,
    isDragging: false,
  },
);

defineEmits<{
  select: [];
  dragstart: [event: DragEvent];
  dragend: [event: DragEvent];
}>();

const effectLines = computed(() => describeCard(props.card));

function describeCard(card: Card): string[] {
  if (card.kind === "dissent") {
    const txt = card.flavor ?? "Unplayable.";
    return txt ? [txt] : [];
  }
  return flattenEffect(card.effect);
}
</script>
