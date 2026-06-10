<template>
  <div class="card-stack" :style="containerStyle">
    <div
      v-for="(c, i) in cards"
      :key="c.id"
      class="card-stack-slot"
      :style="{ '--stack-index': i, '--stack-z': i + 1 }"
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

type StackDirection = "vertical" | "horizontal";

const props = withDefaults(
  defineProps<{
    cards: CardT[];
    direction?: StackDirection;
  }>(),
  { direction: "vertical" },
);

const CARD_WIDTH = 112;
const CARD_HEIGHT = 150;
const STACK_OFFSET = 28;

const containerStyle = computed(() => {
  const isHorizontal = props.direction === "horizontal";
  const extra = Math.max(0, props.cards.length - 1) * STACK_OFFSET;
  return {
    "--stack-offset-x": isHorizontal ? `${STACK_OFFSET}px` : "0px",
    "--stack-offset-y": isHorizontal ? "0px" : `${STACK_OFFSET}px`,
    width: `${CARD_WIDTH + (isHorizontal ? extra : 0)}px`,
    height: `${CARD_HEIGHT + (isHorizontal ? 0 : extra)}px`,
  };
});
</script>

<style scoped>
.card-stack {
  position: relative;
  flex-shrink: 0;
}
.card-stack-slot {
  position: absolute;
  top: calc(var(--stack-index) * var(--stack-offset-y, 0px));
  left: calc(var(--stack-index) * var(--stack-offset-x, 0px));
  z-index: var(--stack-z, 1);
}
.card-stack-slot:hover {
  z-index: 9999;
}
</style>
