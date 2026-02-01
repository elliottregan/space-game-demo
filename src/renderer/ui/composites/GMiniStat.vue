<script setup lang="ts">
import { computed } from "vue";
import GProgress from "../primitives/GProgress.vue";

export type MiniStatMode = "text" | "percentage" | "difference";

const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    mode?: MiniStatMode;
    thresholds?: { warning?: number; critical?: number };
  }>(),
  {
    mode: "text",
    thresholds: undefined,
  },
);

const displayValue = computed(() => {
  if (props.mode === "percentage") {
    return `${Math.round(props.value)}%`;
  }
  if (props.mode === "difference") {
    return props.value > 0 ? `+${props.value}` : String(props.value);
  }
  return String(props.value);
});

const valueVariant = computed(() => {
  if (props.mode === "difference") {
    return props.value > 0 ? "positive" : props.value < 0 ? "negative" : "neutral";
  }
  if (props.mode === "percentage" && props.thresholds) {
    const { warning = 70, critical = 40 } = props.thresholds;
    if (props.value >= warning) return "positive";
    if (props.value >= critical) return "warning";
    return "negative";
  }
  return "neutral";
});

const progressVariant = computed(() => {
  if (valueVariant.value === "neutral") return "default";
  return valueVariant.value;
});
</script>

<template>
  <div class="mini-stat">
    <span class="mini-stat-label">{{ label }}</span>
    <div v-if="mode === 'percentage'" class="mini-stat-progress">
      <span class="mini-stat-value" :class="`mini-stat-value--${valueVariant}`">
        {{ displayValue }}
      </span>
      <GProgress class="mini-stat__progress" :percent="value" :variant="progressVariant" />
    </div>
    <span v-else class="mini-stat-value" :class="`mini-stat-value--${valueVariant}`">
      {{ displayValue }}
    </span>
  </div>
</template>

<style scoped>
.mini-stat {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.mini-stat__progress {
  min-width: 30%;
  flex: 0 1 auto;
}

.mini-stat-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mini-stat-progress {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.mini-stat-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-lg);
  font-weight: 600;
}

.mini-stat-value--neutral {
  color: var(--g-color-text);
}

.mini-stat-value--positive {
  color: var(--g-color-positive);
}

.mini-stat-value--warning {
  color: var(--g-color-warning);
}

.mini-stat-value--negative {
  color: var(--g-color-negative);
}
</style>
