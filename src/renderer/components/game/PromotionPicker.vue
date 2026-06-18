<template>
  <!--
    Build-time ideology promotion gate. Opened only when a column has ≥2
    promotable (present, non-wild) ideologies. Built on the reusable Modal and
    marked NON-DISMISSABLE: once opened, promotion is required — Esc / outside
    click are inert, so the player must either pick a color (Promote) or back
    out explicitly (Cancel). Each option is a selectable card mirroring
    PolicyCard's `.selectable`/`.selected` accent look (this is an ideology
    choice, not a policy card).
  -->
  <Modal
    :open="true"
    :dismissable="false"
    title="Promote an ideology"
    description="Choose which color this Build fuels."
    @update:open="onUpdateOpen"
  >
    <div class="pp-grid">
      <button
        v-for="ideology in ideologies"
        :key="ideology"
        type="button"
        class="pp-card"
        :class="{ selected: chosen === ideology }"
        :style="{ '--card-accent': cssColorFor(ideology) }"
        :aria-pressed="chosen === ideology"
        @click="chosen = ideology"
      >
        <div class="pp-accent" aria-hidden="true"></div>
        <SuitGlyph class="pp-watermark" :variant="ideology" :size="72" :aria-hidden="true" />
        <div class="pp-card-body">
          <SuitGlyph :variant="ideology" :size="16" :title="labelFor(ideology)" />
          <span class="pp-card-name">{{ labelFor(ideology) }}</span>
        </div>
      </button>
    </div>

    <template #footer>
      <button type="button" class="ghost" @click="emit('cancel')">Cancel</button>
      <button type="button" class="primary" :disabled="chosen === null" @click="confirm">
        Promote
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Ideology } from "../../../core/types.ts";
import { IDEOLOGY_DISPLAY, cssColorFor } from "../../../core/data/ideologies.ts";
import SuitGlyph from "../core/SuitGlyph.vue";
import Modal from "../core/Modal.vue";

defineProps<{
  /** The promotable ideologies (≥2 — the picker only opens in that case). */
  ideologies: Ideology[];
}>();

const emit = defineEmits<{
  promote: [ideology: Ideology];
  cancel: [];
}>();

const chosen = ref<Ideology | null>(null);

function labelFor(ideology: Ideology): string {
  return IDEOLOGY_DISPLAY[ideology].name;
}

function confirm(): void {
  if (chosen.value !== null) emit("promote", chosen.value);
}

// Non-dismissable, so Reka only requests a close programmatically; treat any
// such close as a cancel so the parent's open-ref is released.
function onUpdateOpen(value: boolean): void {
  if (!value) emit("cancel");
}
</script>

<style scoped>
.pp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  padding: var(--space-3) 0;
}
.pp-card {
  --card-accent: var(--ink-subtle);
  position: relative;
  width: 160px;
  aspect-ratio: 3 / 2;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  padding: 0;
  background: var(--paper);
  box-shadow: var(--shadow-interactive);
  cursor: pointer;
  transition: box-shadow 0.1s;
}
.pp-card:hover {
  box-shadow: var(--shadow-lifted);
}
.pp-card:focus-visible {
  box-shadow: var(--shadow-lifted);
  outline: none;
}
.pp-card.selected {
  box-shadow:
    var(--shadow-interactive),
    inset 0 0 0 2px var(--card-accent);
}
.pp-accent {
  flex: 0 0 6px;
  background: var(--card-accent);
}
.pp-watermark {
  position: absolute;
  right: -18px;
  bottom: -18px;
  opacity: 0.12;
  pointer-events: none;
  color: var(--card-accent);
}
.pp-card-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.pp-card-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}
</style>
