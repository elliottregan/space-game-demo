<script setup lang="ts">
import type { Faction } from "../../../core/models/Politics";
import { getFactionSupportVariant } from "../../../core/balance/DisplayThresholds";
import { GProgress } from "../../ui";

defineProps<{
  faction: Faction;
}>();
</script>

<template>
  <div class="faction-card">
    <div class="faction-header">
      <span class="faction-name">{{ faction.name }}</span>
      <span class="faction-support" :class="`support-${getFactionSupportVariant(faction.support)}`">
        {{ Math.floor(faction.support) }}%
      </span>
    </div>
    <GProgress
      :percent="faction.support"
      :variant="getFactionSupportVariant(faction.support)"
    />
    <div class="faction-desc">{{ faction.description }}</div>
  </div>
</template>

<style scoped>
.faction-card {
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  padding: var(--g-space-sm);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
}

.faction-support {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.support-positive { color: var(--g-color-positive); }
.support-warning { color: var(--g-color-warning); }
.support-negative { color: var(--g-color-negative); }

.faction-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: var(--g-space-xs);
}
</style>
