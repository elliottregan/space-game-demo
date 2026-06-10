<template>
  <Panel :title="`Legacy Cards (${cards.length})`">
    <div v-if="cards.length === 0" class="empty">None yet.</div>
    <div v-for="l in cards" :key="l.id" class="legacy-item">
      <div>{{ l.baseCard.name }}</div>
      <div class="legacy-meta">
        E{{ l.mintedOnEpoch }} · {{ l.upgradePath }} · {{ l.mintedFrom }}
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import type { LegacyCard } from "../../../../core/types.ts";
import Panel from "../../core/Panel.vue";

defineProps<{ cards: LegacyCard[] }>();
</script>

<style scoped>
.empty {
  color: var(--ink-subtle);
  font-size: 11px;
}
.legacy-meta {
  font-size: 10px;
  color: var(--ink-subtle);
}
</style>
