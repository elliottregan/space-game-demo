<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <nav class="tab-nav">
    <RouterLink to="/main" class="tab-link" active-class="active"> Main </RouterLink>
    <RouterLink to="/colony" class="tab-link" active-class="active"> Colony </RouterLink>
    <RouterLink to="/politics" class="tab-link" active-class="active"> Politics </RouterLink>
    <RouterLink to="/research" class="tab-link" active-class="active"> Research </RouterLink>
  </nav>
</template>

<style scoped>
.tab-nav {
  display: flex;
  gap: 0;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  margin-bottom: var(--g-space-md);
}

.tab-link {
  padding: var(--g-space-sm) var(--g-space-lg);
  color: var(--g-color-text-muted);
  text-decoration: none;
  font-family: var(--g-font-mono);
  font-weight: 500;
  font-size: var(--g-font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 3px solid transparent;
  transition:
    color var(--g-transition-fast),
    background var(--g-transition-fast);
}

.tab-link:hover {
  color: var(--g-color-text);
  background: var(--g-color-bg-surface);
}

.tab-link.active {
  color: var(--g-color-text);
  border-bottom-color: var(--g-accent-red);
  background: var(--g-color-bg-surface);
}

/* Add subtle dividers between tabs */
.tab-link + .tab-link {
  border-left: 1px solid var(--g-color-border);
}
</style>
