<template>
  <div
    :class="[
      'card',
      `suit-${card.ideology}`,
      `kind-${card.kind}`,
      { selectable, selected, unaffordable, wild: card.ideology === 'wild', compact },
    ]"
    @click="$emit('select')"
  >
    <div class="card-header">
      <span class="card-rank">{{ rankLabel }}</span>
      <span class="card-suit-chip">{{ suitLabel }}</span>
    </div>
    <div class="card-name">{{ card.name }}</div>
    <div v-if="!compact" class="card-effect">{{ effectText }}</div>
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
  },
);

defineEmits<{ select: [] }>();

const rankLabel = computed(() => {
  const r = props.card.rank;
  if (r === 11) return "J";
  if (r === 12) return "Q";
  if (r === 13) return "K";
  if (r === 14) return "A";
  if (r === 15) return "★";
  return String(r);
});

const suitLabel = computed(() => {
  switch (props.card.ideology) {
    case "solidarity":
      return "Sol";
    case "sovereignty":
      return "Sov";
    case "transformation":
      return "Trn";
    case "heritage":
      return "Her";
    case "wild":
      return "Wild";
  }
});

const displayedInfluenceCost = computed(() =>
  props.influenceCostOverride !== undefined
    ? props.influenceCostOverride
    : props.card.influenceCost,
);

const effectText = computed(() => describeEffect(props.card));

function describeEffect(card: Card): string {
  if (card.kind === "dissent") return card.flavor ?? "Unplayable.";
  if (card.kind === "land") {
    const base = `+${landMat(card.rank)} Materials/turn`;
    if (card.slotPassive) return `${base}. ${describeEffectSpec(card.slotPassive)} when top.`;
    return base;
  }
  const text = describeEffectSpec(card.effect);
  if (card.slotPassive) {
    return `${text}\nSlot: ${describeEffectSpec(card.slotPassive)}`;
  }
  return text;
}

function landMat(rank: number): number {
  if (rank <= 5) return 1;
  if (rank <= 7) return 2;
  return 3;
}

function describeEffectSpec(effect: any): string {
  switch (effect.kind) {
    case "noop":
      return "";
    case "gainInfluence":
      return `+${effect.amount} Influence`;
    case "gainMaterials":
      return `+${effect.amount} Materials`;
    case "draw":
      return `Draw ${effect.count}`;
    case "addDissent":
      if (effect.variant === "backlash")
        return `+${effect.amount} Backlash · ${capitalize(effect.ideology ?? "")}`;
      if (effect.variant === "unrest") return `+${effect.amount} Unrest`;
      return `+${effect.amount} Quiet Dissent`;
    case "removeDissent":
      return `Purge ${effect.amount} Dissent`;
    case "shiftIdeology":
      return `Shift ${effect.axis} ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "peekMarket":
      return `Peek ${effect.count}`;
    case "nextAcquireDiscount":
      return `Next acquire −${effect.amount}`;
    case "discount":
      return `Discount ${effect.amount}`;
    case "compound":
      return effect.effects.map(describeEffectSpec).filter(Boolean).join(", ");
  }
  return "";
}

function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : "";
}
</script>
