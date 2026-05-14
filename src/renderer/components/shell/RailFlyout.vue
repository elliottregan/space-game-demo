<template>
  <div :class="['flyout-backdrop', `flyout-${side}`]" @mousedown.self="$emit('close')">
    <div class="flyout-anchor" @mousedown.stop>
      <Panel :title="title" class="flyout-panel">
        <slot />
      </Panel>
    </div>
  </div>
</template>

<script setup lang="ts">
import Panel from "../core/Panel.vue";

defineProps<{
  side: "left" | "right";
  title: string;
}>();

defineEmits<{ close: [] }>();
</script>

<style scoped>
.flyout-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  z-index: 50;
  /* The backdrop catches outside clicks but stays visually transparent so
     gameplay underneath remains visible. */
  background: transparent;
}
.flyout-left {
  justify-content: flex-start;
}
.flyout-right {
  justify-content: flex-end;
}
.flyout-anchor {
  margin: var(--space-3);
  max-width: min(360px, calc(100% - var(--space-4)));
  display: flex;
}
.flyout-panel {
  box-shadow: var(--elev-2);
  max-height: 100%;
  overflow: auto;
}
</style>
