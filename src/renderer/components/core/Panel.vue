<template>
  <section class="panel">
    <header class="panel-header">
      <h2 class="panel-title">{{ title }}</h2>
    </header>
    <div class="panel-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<style scoped>
.panel {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Allow the panel to shrink below its intrinsic content size when its
     parent gives it a bounded height — needed for in-panel scrolling. */
  min-height: 0;
}
.panel-header {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  flex: 0 0 auto;
}
.panel-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.panel-body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}
</style>
