<template>
  <Panel class="pile-panel" title="Deck">
    <div class="pile-zone">
      <button
        ref="pileEl"
        class="pile-stack pile-deck"
        :disabled="drawCount === 0"
        @click="$emit('view')"
      >
        <span
          v-for="i in underLayers"
          :key="i"
          class="pile-layer"
          :style="{ translate: `${i * 2.5}px ${i * 2.5}px` }"
        ></span>
        <CardBack v-if="drawCount > 0" class="pile-top-card" />
        <span v-else class="pile-silhouette"></span>
        <span v-if="drawCount > 0" class="pile-count-badge">{{ drawCount }}</span>
      </button>
      <div class="pile-hint">{{ drawCount > 0 ? "click to review" : "empty" }}</div>
    </div>
    <button class="end-turn-big primary" :disabled="ended" @click="$emit('endTurn')">
      End turn
    </button>
  </Panel>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { registerPile } from "../../animation/cardFlight.ts";
import Panel from "../core/Panel.vue";
import CardBack from "../core/CardBack.vue";

const props = defineProps<{
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

/** Sheet edges peeking under the top card — thicker stack for bigger piles. */
const underLayers = computed(() => {
  if (props.drawCount <= 1) return 0;
  if (props.drawCount <= 5) return 1;
  if (props.drawCount <= 15) return 2;
  return 3;
});
</script>
