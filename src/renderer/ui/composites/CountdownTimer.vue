<script setup lang="ts">
import { computed } from "vue";
import GProgress from "../primitives/GProgress.vue";

const props = defineProps<{
  remaining: number;
  total: number;
  label?: string;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const percent = computed(() => ((props.total - props.remaining) / props.total) * 100);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const timeLabel = computed(() => {
  if (props.remaining === 1) return "1 sol remaining";
  return `${props.remaining} sols remaining`;
});
</script>

<template>
  <div class="g-countdown">
    <div v-if="label" class="g-countdown__label">{{ label }}</div>
    <GProgress :percent="percent" showLabel>
      {{ timeLabel }}
    </GProgress>
  </div>
</template>

<style scoped>
.g-countdown {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.g-countdown__label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
