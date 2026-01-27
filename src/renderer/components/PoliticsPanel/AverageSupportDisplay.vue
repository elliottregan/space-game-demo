<script setup lang="ts">
defineProps<{
  support: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportVariant(support: number): "positive" | "warning" | "negative" {
  if (support >= 60) return "positive";
  if (support >= 40) return "warning";
  return "negative";
}
</script>

<template>
  <div class="average-support">
    <span class="label">Average Support:</span>
    <span class="value" :class="`support-${getSupportVariant(support)}`">
      {{ Math.floor(support) }}%
    </span>
  </div>
</template>

<style scoped>
.average-support {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  margin-bottom: var(--g-space-md);
}

.average-support .label {
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.average-support .value {
  font-family: var(--g-font-mono);
  font-size: 1.25rem;
  font-weight: bold;
}

.support-positive {
  color: var(--g-color-positive);
}
.support-warning {
  color: var(--g-color-warning);
}
.support-negative {
  color: var(--g-color-negative);
}
</style>
