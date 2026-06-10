<template>
  <Panel title="Deck">
    <div class="deck-counts">
      <span>Hand</span><span>{{ counts.hand }}</span> <span>Draw</span
      ><span>{{ counts.draw }}</span> <span>Discard</span><span>{{ counts.discard }}</span>
      <span>Dissent</span>
      <span>{{ counts.dissent }} / {{ total }}</span>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Panel from "../../core/Panel.vue";

const props = defineProps<{
  counts: { hand: number; draw: number; discard: number; dissent: number };
}>();

const total = computed(() => props.counts.hand + props.counts.draw + props.counts.discard);
</script>
