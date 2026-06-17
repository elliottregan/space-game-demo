<template>
  <!-- A small landscape pile tile for one ideology. Registers itself as a
       card-flight pile on mount (deck or discard key) so enact choreography
       can fly cards to/from exactly this tile. Flat, no border-radius. -->
  <div
    ref="tileEl"
    class="policy-pile-tile"
    :class="[`suit-${ideology}`, `face-${face}`]"
    :style="{ '--tile-accent': cssColorFor(ideology) }"
    :title="`${ideologyLabel}: ${count} ${count === 1 ? 'card' : 'cards'}`"
  >
    <CardBack v-if="face === 'back' && count > 0" class="tile-back" />
    <SuitGlyph
      v-else
      class="tile-glyph"
      :variant="ideology"
      :size="18"
      :aria-hidden="true"
      :title="ideologyLabel"
    />
    <span class="tile-count" :class="{ empty: count === 0 }">{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Ideology } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { registerPile, type PileKind } from "../../animation/cardFlight.ts";
import CardBack from "../core/CardBack.vue";
import SuitGlyph from "../core/SuitGlyph.vue";

const props = defineProps<{
  ideology: Ideology;
  count: number;
  /** Card-flight registry key for this tile (`policy-deck:` / `policy-discard:`). */
  pile: PileKind;
  /** Deck tiles show a card back; discard tiles show the ideology glyph/accent. */
  face: "back" | "accent";
}>();

const tileEl = ref<HTMLElement | null>(null);
onMounted(() => registerPile(props.pile, tileEl.value));
onBeforeUnmount(() => registerPile(props.pile, null));

const ideologyLabel = computed(() => IDEOLOGY_DISPLAY[props.ideology].name);
</script>

<style scoped>
.policy-pile-tile {
  --tile-accent: var(--ink-subtle);
  position: relative;
  /* Small landscape footprint — smaller than the modal/tableau cards. */
  width: 56px;
  aspect-ratio: 3 / 2;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--rule);
}

.policy-pile-tile.face-accent {
  background: color-mix(in srgb, var(--tile-accent) 14%, var(--paper));
  box-shadow: inset 0 0 0 1px var(--tile-accent);
}

.tile-back {
  position: absolute;
  inset: 0;
}

.tile-glyph {
  color: var(--tile-accent);
  opacity: 0.7;
}

.tile-count {
  position: absolute;
  bottom: 0;
  right: 0;
  min-width: 14px;
  padding: 0 3px;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  color: var(--paper);
  background: var(--tile-accent);
}

.tile-count.empty {
  color: var(--ink-subtle);
  background: var(--rule);
}
</style>
