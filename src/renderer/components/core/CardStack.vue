<template>
  <div class="card-stack" :style="{ height: stackHeight + 'px' }">
    <div
      v-for="(c, i) in cards"
      :key="c.id"
      class="card-stack-slot"
      :style="{ top: i * STACK_OFFSET + 'px', '--stack-z': i + 1 }"
    >
      <Card :card="c" :selectable="false" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT } from "../../../core/types.ts";
import Card from "./Card.vue";

const props = defineProps<{ cards: CardT[] }>();

const STACK_OFFSET = 28;
const CARD_HEIGHT = 150;

const stackHeight = computed(() =>
  props.cards.length === 0 ? CARD_HEIGHT : CARD_HEIGHT + (props.cards.length - 1) * STACK_OFFSET,
);
</script>

<style scoped>
.card-stack {
  position: relative;
  width: 112px;
  flex-shrink: 0;
}
.card-stack-slot {
  position: absolute;
  left: 0;
  z-index: var(--stack-z, 1);
}
.card-stack-slot:hover {
  z-index: 9999;
}
</style>
