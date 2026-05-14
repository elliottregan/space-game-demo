<template>
  <svg
    class="rail-svg"
    :viewBox="`0 0 24 24`"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-label="name"
  >
    <!-- Keystone Projects: filled five-point star -->
    <polygon
      v-if="name === 'projects'"
      points="12,3 14.7,9.3 21.5,9.9 16.4,14.4 18,21 12,17.4 6,21 7.6,14.4 2.5,9.9 9.3,9.3"
      fill="currentColor"
      stroke="none"
    />
    <!-- Crisis Counter: warning triangle with exclamation -->
    <template v-else-if="name === 'crisis'">
      <polygon points="12,3.5 21.5,20.5 2.5,20.5" />
      <line x1="12" y1="10" x2="12" y2="15" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </template>
    <!-- Ideology: compass/crosshair -->
    <template v-else-if="name === 'ideology'">
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </template>
    <!-- Terrain: two mountain peaks -->
    <template v-else-if="name === 'terrain'">
      <polyline points="2,20 8,11 12,15 17,7 22,20" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </template>
    <!-- Monuments: simple column/obelisk -->
    <template v-else-if="name === 'monuments'">
      <rect x="9" y="5" width="6" height="14" />
      <line x1="7" y1="5" x2="17" y2="5" />
      <line x1="6" y1="20" x2="18" y2="20" />
    </template>
    <!-- Legacy Cards: scroll/book -->
    <template v-else-if="name === 'legacy'">
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </template>
    <!-- Deck Counts: stacked sheets -->
    <template v-else-if="name === 'counts'">
      <rect x="6" y="4" width="13" height="13" rx="1.5" />
      <path d="M4 7v13h13" />
    </template>
    <!-- Event Log: bullet list -->
    <template v-else-if="name === 'log'">
      <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none" />
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="20" y2="17" />
    </template>
    <!-- Deck & Discard piles: overlapping card rectangles -->
    <template v-else-if="name === 'piles'">
      <rect x="4" y="7" width="10" height="13" rx="1.5" />
      <rect x="10" y="4" width="10" height="13" rx="1.5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
export type RailIconName =
  | "projects"
  | "crisis"
  | "ideology"
  | "terrain"
  | "monuments"
  | "legacy"
  | "counts"
  | "log"
  | "piles";

defineProps<{ name: RailIconName }>();
</script>

<style scoped>
.rail-svg {
  display: block;
}
</style>
