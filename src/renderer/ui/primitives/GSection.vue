<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    variant?: "default" | "muted" | "warning" | "uppercase";
    border?: "top" | "bottom" | "none";
  }>(),
  {
    variant: "muted",
    border: "bottom",
  },
);
</script>

<template>
  <section
    class="g-section"
    :class="[`g-section--${variant}`, `g-section--border-${border}`]"
  >
    <header class="g-section__header">
      <h3 class="g-section__title">{{ title }}</h3>
      <span v-if="$slots['header-actions']" class="g-section__header-actions">
        <slot name="header-actions" />
      </span>
    </header>
    <div class="g-section__content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.g-section {
  margin-bottom: var(--g-space-md);
}

.g-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
  padding-bottom: var(--g-space-xs);
}

.g-section__title {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  margin: 0;
}

.g-section__header-actions {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.g-section__content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

/* Border variants */
.g-section--border-bottom .g-section__header {
  border-bottom: 1px solid var(--g-color-border);
}

.g-section--border-top .g-section__header {
  border-top: 1px solid var(--g-color-border);
  padding-top: var(--g-space-xs);
  padding-bottom: 0;
  margin-top: var(--g-space-xs);
}

.g-section--border-none .g-section__header {
  border: none;
  padding-bottom: 0;
}

/* Color variants */
.g-section--default .g-section__title {
  color: var(--g-color-text);
}

.g-section--muted .g-section__title {
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.g-section--warning .g-section__title {
  color: var(--g-accent-amber);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.g-section--uppercase .g-section__title {
  color: var(--g-accent-slate);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
</style>
