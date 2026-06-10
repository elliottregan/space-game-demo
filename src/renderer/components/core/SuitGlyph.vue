<template>
  <svg
    class="suit-glyph"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :style="{ color: colorVar }"
    role="img"
    :aria-label="ariaLabel"
    :aria-hidden="ariaHidden || undefined"
  >
    <!-- Solidarity: circle -->
    <circle v-if="variant === 'solidarity'" cx="12" cy="12" r="10" fill="currentColor" />
    <!-- Sovereignty: triangle -->
    <polygon
      v-else-if="variant === 'sovereignty'"
      points="12,2.5 22,21.5 2,21.5"
      fill="currentColor"
    />
    <!-- Transformation: square -->
    <rect
      v-else-if="variant === 'transformation'"
      x="3"
      y="3"
      width="18"
      height="18"
      fill="currentColor"
    />
    <!-- Heritage: semicircle, flat side down -->
    <path v-else-if="variant === 'heritage'" d="M 2 17 A 10 10 0 0 1 22 17 Z" fill="currentColor" />
    <!-- Wild: four-quadrant disc, one quadrant per suit -->
    <template v-else-if="variant === 'wild'">
      <path d="M 12 12 L 12 2 A 10 10 0 0 1 22 12 Z" fill="var(--suit-solidarity)" />
      <path d="M 12 12 L 22 12 A 10 10 0 0 1 12 22 Z" fill="var(--suit-sovereignty)" />
      <path d="M 12 12 L 12 22 A 10 10 0 0 1 2 12 Z" fill="var(--suit-transformation)" />
      <path d="M 12 12 L 2 12 A 10 10 0 0 1 12 2 Z" fill="var(--suit-heritage)" />
    </template>
    <!-- Dissent: diagonal slash -->
    <line
      v-else-if="variant === 'dissent'"
      x1="4"
      y1="20"
      x2="20"
      y2="4"
      stroke="currentColor"
      stroke-width="3.5"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ideology } from "../../../core/types.ts";
import { IDEOLOGY_DISPLAY, cssColorFor } from "../../../core/data/ideologies.ts";

export type SuitGlyphVariant = Ideology | "wild" | "dissent";

const props = withDefaults(
  defineProps<{
    variant: SuitGlyphVariant;
    size?: number;
    ariaHidden?: boolean;
  }>(),
  { size: 14, ariaHidden: false },
);

const ariaLabel = computed(() => {
  if (props.variant === "wild") return "Wild";
  if (props.variant === "dissent") return "Dissent";
  return IDEOLOGY_DISPLAY[props.variant].name;
});

const colorVar = computed(() => {
  if (props.variant === "wild") return "var(--suit-wild)";
  if (props.variant === "dissent") return "var(--suit-dissent)";
  return cssColorFor(props.variant);
});
</script>

<style scoped>
.suit-glyph {
  display: block;
  flex-shrink: 0;
}
</style>
