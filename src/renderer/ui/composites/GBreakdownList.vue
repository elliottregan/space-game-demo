<script setup lang="ts">
export interface BreakdownItem {
  key: string;
  name: string;
  count?: number;
  value: number | string;
  variant?: "positive" | "negative" | "neutral";
  separator?: boolean;
}

defineProps<{
  title?: string;
  items: BreakdownItem[];
  showSign?: boolean;
}>();

function formatValue(item: BreakdownItem, showSign: boolean): string {
  if (typeof item.value === "string") return item.value;
  if (!showSign) return String(item.value);
  return item.value > 0 ? `+${item.value}` : String(item.value);
}

function getVariant(item: BreakdownItem): string {
  if (item.variant) return item.variant;
  if (typeof item.value === "number") {
    return item.value > 0 ? "positive" : item.value < 0 ? "negative" : "neutral";
  }
  return "neutral";
}
</script>

<template>
  <div class="breakdown">
    <div v-if="title" class="breakdown-title">{{ title }}</div>
    <div class="breakdown-list">
      <div
        v-for="item in items"
        :key="item.key"
        class="breakdown-item"
        :class="{ 'breakdown-item--separator': item.separator }"
      >
        <span class="breakdown-name">
          {{ item.name }}
          <span v-if="item.count !== undefined" class="breakdown-count">x{{ item.count }}</span>
        </span>
        <span class="breakdown-value" :class="`breakdown-value--${getVariant(item)}`">
          {{ formatValue(item, showSign ?? true) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.breakdown {
  border-top: 1px solid var(--g-color-border);
  padding-top: var(--g-space-md);
}

.breakdown-title {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-sm);
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--g-font-size-sm);
}

.breakdown-item--separator {
  border-top: 1px dashed var(--g-color-border);
  padding-top: var(--g-space-xs);
  margin-top: var(--g-space-xs);
}

.breakdown-name {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.breakdown-count {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
}

.breakdown-value {
  font-family: var(--g-font-mono);
}

.breakdown-value--positive {
  color: var(--g-color-positive);
}

.breakdown-value--negative {
  color: var(--g-color-negative);
}

.breakdown-value--neutral {
  color: var(--g-color-text);
}
</style>
