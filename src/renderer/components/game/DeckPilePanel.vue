<template>
  <Panel class="pile-panel" title="Deck">
    <button
      ref="pileEl"
      class="pile-stack pile-deck"
      @click="$emit('view')"
      :disabled="drawCount === 0"
    >
      <div class="pile-count">{{ drawCount }}</div>
      <div class="pile-hint">click to review</div>
    </button>
    <button class="end-turn-big primary" :disabled="ended" @click="$emit('endTurn')">
      End turn
    </button>
  </Panel>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { registerPile } from "../../animation/cardFlight.ts";
import Panel from "../core/Panel.vue";

defineProps<{
  drawCount: number;
  ended: boolean;
}>();

defineEmits<{
  view: [];
  endTurn: [];
}>();

const pileEl = ref<HTMLElement | null>(null);
onMounted(() => registerPile("deck", pileEl.value));
onBeforeUnmount(() => registerPile("deck", null));
</script>
