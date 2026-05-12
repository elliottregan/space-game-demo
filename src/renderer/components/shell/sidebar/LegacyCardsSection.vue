<template>
  <section class="section">
    <h2>Legacy Cards ({{ cards.length }})</h2>
    <div v-if="cards.length === 0" class="empty">None yet.</div>
    <div v-for="l in cards" :key="l.id" class="legacy-item">
      <div>{{ l.baseCard.name }}</div>
      <div class="legacy-meta">
        E{{ l.mintedOnEpoch }} · {{ l.upgradePath }} · {{ l.mintedFrom }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { LegacyCard } from "../../../../core/types.ts";

defineProps<{ cards: LegacyCard[] }>();
</script>

<style scoped>
.empty {
  color: var(--text-subtle);
  font-size: 11px;
}
.legacy-meta {
  font-size: 10px;
  color: var(--text-subtle);
}
</style>
