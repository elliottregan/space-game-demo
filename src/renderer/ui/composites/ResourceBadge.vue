<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    resource: "food" | "oxygen" | "water" | "power" | "materials";
    amount: number;
    rate?: number;
    size?: "sm" | "md";
  }>(),
  {
    size: "md",
  }
);

const resourceConfig = {
  food: { icon: "🌾", hue: 145 },
  oxygen: { icon: "💨", hue: 220 },
  water: { icon: "💧", hue: 210 },
  power: { icon: "⚡", hue: 70 },
  materials: { icon: "🔧", hue: 280 },
};

const config = computed(() => resourceConfig[props.resource]);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const formattedAmount = computed(() => Math.floor(props.amount).toLocaleString());

// biome-ignore lint/correctness/noUnusedVariables: used in template
const formattedRate = computed(() => {
  if (props.rate === undefined) return null;
  const prefix = props.rate >= 0 ? "+" : "";
  return `${prefix}${props.rate.toFixed(1)}/sol`;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const rateClass = computed(() => {
  if (props.rate === undefined) return "";
  if (props.rate > 0) return "g-resource-badge__rate--positive";
  if (props.rate < 0) return "g-resource-badge__rate--negative";
  return "";
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const accentColor = computed(() => `oklch(65% 0.15 ${config.value.hue})`);
</script>

<template>
  <div class="g-resource-badge" :class="`g-resource-badge--${size}`">
    <span class="g-resource-badge__icon">{{ config.icon }}</span>
    <span class="g-resource-badge__amount" :style="{ color: accentColor }">
      {{ formattedAmount }}
    </span>
    <span v-if="formattedRate" class="g-resource-badge__rate" :class="rateClass">
      {{ formattedRate }}
    </span>
  </div>
</template>

<style scoped>
.g-resource-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--g-space-xs);
  font-family: var(--g-font-mono);
}

.g-resource-badge--sm {
  font-size: var(--g-font-size-sm);
}

.g-resource-badge--sm .g-resource-badge__icon {
  font-size: 1rem;
}

.g-resource-badge--md {
  font-size: var(--g-font-size-md);
}

.g-resource-badge--md .g-resource-badge__icon {
  font-size: 1.25rem;
}

.g-resource-badge__amount {
  font-weight: 600;
}

.g-resource-badge__rate {
  font-size: 0.85em;
  padding: 1px var(--g-space-xs);
  border-radius: 2px;
}

.g-resource-badge__rate--positive {
  color: var(--g-color-positive);
  background: oklch(70% 0.17 145 / 0.15);
}

.g-resource-badge__rate--negative {
  color: var(--g-color-negative);
  background: oklch(60% 0.2 25 / 0.15);
}
</style>
