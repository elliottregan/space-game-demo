<template>
  <section class="section">
    <h2>Deck</h2>
    <div class="deck-counts">
      <span>Hand</span><span>{{ counts.hand }}</span> <span>Draw</span
      ><span>{{ counts.draw }}</span> <span>Discard</span><span>{{ counts.discard }}</span>
      <span :class="{ danger }">Dissent</span>
      <span :class="{ danger }">{{ counts.dissent }} / {{ total }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  counts: { hand: number; draw: number; discard: number; dissent: number };
  dissentThreshold: number;
}>();

const total = computed(() => props.counts.hand + props.counts.draw + props.counts.discard);
const danger = computed(() => {
  if (total.value === 0) return false;
  return props.counts.dissent / total.value > props.dissentThreshold * 0.8;
});
</script>
