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
  background: var(--panel-bg, var(--mat));
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Allow the panel to shrink below its intrinsic content size when its
     parent gives it a bounded height — needed for in-panel scrolling. */
  min-height: 0;
}
.panel-header {
  padding: var(--space-2) var(--space-3) 0;
  flex: 0 0 auto;
}
.panel-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-muted);
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
