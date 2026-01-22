<script setup lang="ts">
defineProps<{
  title?: string;
  glow?: boolean;
}>();
</script>

<template>
  <div class="g-panel" :class="{ 'g-panel--glow': glow }">
    <header v-if="$slots.header || title" class="g-panel__header">
      <slot name="header">{{ title }}</slot>
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
  border: 1px solid var(--g-color-border);
  transition: box-shadow var(--g-transition-normal);
}

.g-panel--glow {
  box-shadow: var(--g-glow-subtle);
  border-color: var(--g-color-border-focus);
}

.g-panel__header {
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-elevated);
  border-bottom: 1px solid var(--g-color-border);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text);
}

.g-panel__body {
  padding: var(--g-space-md);
}

.g-panel__footer {
  padding: var(--g-space-sm) var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
  background: var(--g-color-bg-elevated);
}
</style>
