<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    accent?: "red" | "cyan" | "olive" | "amber" | "slate";
    glow?: boolean;
    thick?: boolean;
  }>(),
  {
    accent: "slate",
    thick: false,
  },
);
</script>

<template>
  <div
    class="g-panel"
    :class="[`g-panel--accent-${accent}`, { 'g-panel--glow': glow, 'g-panel--thick': thick }]"
    :style="{ '--panel-accent': `var(--g-accent-${accent})` }"
  >
    <header v-if="$slots.header || $slots['header-actions'] || title" class="g-panel__header">
      <span class="g-panel__title">
        <slot name="header">{{ title }}</slot>
      </span>
      <span v-if="$slots['header-actions']" class="g-panel__header-actions">
        <slot name="header-actions" />
      </span>
    </header>
    <div class="g-panel__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="g-panel__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.g-panel {
  --panel-cut-size: 16px;
  background: var(--g-color-bg-surface);
  border: var(--g-border-width) solid var(--panel-accent);
  transition: box-shadow var(--g-transition-normal);
  clip-path: polygon(
    0 0,
    calc(100% - var(--panel-cut-size)) 0,
    100% var(--panel-cut-size),
    100% 100%,
    0 100%
  );
}

.g-panel--glow {
  box-shadow: 0 0 0 2px var(--panel-accent);
}

.g-panel--thick {
  border-width: var(--g-border-width-thick);
}

.g-panel--thick .g-panel__header {
  border-bottom-width: var(--g-border-width-thick);
}

.g-panel--thick .g-panel__footer {
  border-top-width: var(--g-border-width-thick);
}

.g-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--panel-accent);
  border-bottom: var(--g-border-width) solid var(--panel-accent);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-lg);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: white;
}

.g-panel__title {
  flex: 1;
  font-weight: bold;
  color: white;
}

.g-panel__header-actions {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

/* Header action buttons should be white/transparent on colored bg */
.g-panel__header-actions :deep(.g-button) {
  background: transparent;
  color: white;
  border-color: rgba(255, 255, 255, 0.5);
}

.g-panel__header-actions :deep(.g-button:hover:not(:disabled)) {
  background: rgba(255, 255, 255, 0.1);
  border-color: white;
}

.g-panel__body {
  padding: var(--g-space-md);
}

.g-panel__footer {
  padding: var(--g-space-sm) var(--g-space-md);
  border-top: var(--g-border-width) solid var(--panel-accent, var(--g-color-border));
  background: var(--g-color-bg-base);
}
</style>
