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
  },
);

const resourceConfig = {
  food: { label: "FOOD", color: "#827717" },      // olive
  oxygen: { label: "O2", color: "#00838F" },       // cyan
  water: { label: "H2O", color: "#1565C0" },       // blue
  power: { label: "PWR", color: "#F57C00" },       // amber
  materials: { label: "MAT", color: "#455A64" },   // slate
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
  if (props.rate > 0) return "rate--positive";
  if (props.rate < 0) return "rate--negative";
  return "";
});
</script>

<template>
  <div class="resource-badge" :class="`resource-badge--${size}`">
    <span class="resource-badge__label" :style="{ background: config.color }">
      {{ config.label }}
    </span>
    <span class="resource-badge__amount">
      {{ formattedAmount }}
    </span>
    <span v-if="formattedRate" class="resource-badge__rate" :class="rateClass">
      {{ formattedRate }}
    </span>
  </div>
</template>

<style scoped>
.resource-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.resource-badge--sm {
  font-size: var(--g-font-size-sm);
}

.resource-badge--md {
  font-size: var(--g-font-size-md);
}

.resource-badge__label {
  padding: var(--g-space-xs) var(--g-space-sm);
  color: white;
  font-weight: 600;
  font-size: 0.85em;
  letter-spacing: 0.05em;
}

.resource-badge__amount {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-weight: 600;
  color: var(--g-color-text);
}

.resource-badge__rate {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: 0.85em;
  border-left: 1px solid var(--g-color-border);
}

.rate--positive {
  color: var(--g-color-positive);
}

.rate--negative {
  color: var(--g-color-negative);
}
</style>
