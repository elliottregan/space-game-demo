<script setup lang="ts">
import type { NPC } from "../../../core/models/types";

defineProps<{
  npc: NPC;
  support: number;
  selected: boolean;
}>();

defineEmits<{
  click: [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportVariant(support: number): "positive" | "negative" | "default" {
  if (support > 0.3) return "positive";
  if (support < -0.3) return "negative";
  return "default";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatSupport(support: number): string {
  const pct = (support * 100).toFixed(0);
  return support >= 0 ? `+${pct}%` : `${pct}%`;
}
</script>

<template>
  <div
    class="npc-row"
    :class="{ selected }"
    @click="$emit('click')"
  >
    <span class="npc-name">{{ npc.name }}</span>
    <slot name="badge" />
    <span
      class="support-value"
      :class="`support-${getSupportVariant(support)}`"
    >
      {{ formatSupport(support) }}
    </span>
  </div>
</template>

<style scoped>
.npc-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  cursor: pointer;
  transition: border-color var(--g-transition-fast), background var(--g-transition-fast);
}

.npc-row:hover {
  background: var(--g-color-bg-surface);
  border-color: var(--g-color-border-focus);
}

.npc-row.selected {
  border-color: var(--g-accent-slate);
  background: rgba(69, 90, 100, 0.1);
}

.npc-name {
  flex: 1;
  font-size: var(--g-font-size-sm);
}

.support-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.support-positive {
  color: var(--g-color-positive);
}

.support-negative {
  color: var(--g-color-negative);
}

.support-default {
  color: var(--g-color-text-muted);
}
</style>
