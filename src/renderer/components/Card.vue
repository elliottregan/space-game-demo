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
        wild: card.ideology === 'wild',
        compact,
        dragging: isDragging,
      },
    ]"
    :draggable="draggable"
    @click="$emit('select')"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <div class="card-header">
      <span class="card-rank">{{ rankLabel(card.rank) }}</span>
      <span class="card-suit-chip">{{ suitLabel(card.ideology) }}</span>
    </div>
    <div class="card-name">{{ card.name }}</div>
    <ul v-if="!compact && effectLines.length > 0" class="card-effect-list">
      <li v-for="(line, i) in effectLines" :key="i">{{ line }}</li>
    </ul>
    <div class="card-footer">
      <span
        v-if="showInfluence && card.kind !== 'land' && card.kind !== 'dissent'"
        :class="['card-inf-cost', alignment]"
      >
        {{ displayedInfluenceCost }} Inf
      </span>
      <span v-else-if="card.kind === 'land'" class="card-inf-cost">Land</span>
      <span v-else-if="card.kind === 'dissent'" class="card-inf-cost">—</span>
      <span v-if="showMarketCost" class="card-market-cost">{{ card.marketCost }} Mat</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "../../core/types.ts";
import { flattenEffect, describeEffectSpec } from "../util/effects.ts";
import { rankLabel, suitLabel, landMaterialPerTurn } from "../util/labels.ts";

const props = withDefaults(
  defineProps<{
    card: Card;
    selectable?: boolean;
    selected?: boolean;
    unaffordable?: boolean;
    showInfluence?: boolean;
    showMarketCost?: boolean;
    influenceCostOverride?: number;
    alignment?: "aligned" | "opposed" | "neutral";
    compact?: boolean;
    draggable?: boolean;
    isDragging?: boolean;
  }>(),
  {
    selectable: false,
    selected: false,
    unaffordable: false,
    showInfluence: true,
    showMarketCost: false,
    influenceCostOverride: undefined,
    alignment: "neutral",
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

const displayedInfluenceCost = computed(() =>
  props.influenceCostOverride !== undefined
    ? props.influenceCostOverride
    : props.card.influenceCost,
);

const effectLines = computed(() => describeCard(props.card));

function describeCard(card: Card): string[] {
  if (card.kind === "dissent") {
    const txt = card.flavor ?? "Unplayable.";
    return txt ? [txt] : [];
  }
  if (card.kind === "land") {
    const lines: string[] = [`+${landMaterialPerTurn(card.rank)} Mat/turn`];
    if (card.slotPassive) {
      const p = describeEffectSpec(card.slotPassive);
      if (p) lines.push(`${p} (when top)`);
    }
    return lines;
  }
  const lines = flattenEffect(card.effect);
  if (card.slotPassive) {
    const p = describeEffectSpec(card.slotPassive);
    if (p) lines.push(`On slot: ${p}`);
  }
  return lines;
}
</script>
