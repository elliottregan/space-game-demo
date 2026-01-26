<script setup lang="ts">
defineProps<{
  title?: string;
  glow?: boolean;
}>();
</script>

<template>
  <div class="g-panel" :class="{ 'g-panel--glow': glow }">
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
  background: var(--g-color-bg-surface);
  border: var(--g-border-width) solid var(--panel-accent, var(--g-color-border));
  transition: box-shadow var(--g-transition-normal);
}

.g-panel--glow {
  box-shadow: var(--g-glow-subtle);
  border-color: var(--g-color-border-focus);
}

.g-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-elevated);
  border-bottom: var(--g-border-width) solid var(--panel-accent, var(--g-color-border));
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-lg);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text);
}

.g-panel__title {
  flex: 1;
}

.g-panel__header-actions {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
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
