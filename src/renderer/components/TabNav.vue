<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <nav class="tab-nav">
    <RouterLink to="/main" class="tab-link" active-class="active">
      Main
    </RouterLink>
    <RouterLink to="/strategy" class="tab-link" active-class="active">
      Strategy
    </RouterLink>
  </nav>
</template>

<style scoped>
.tab-nav {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.tab-link {
  padding: 0.75rem 1.5rem;
  color: #888;
  text-decoration: none;
  font-weight: 500;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
  border-bottom: 3px solid transparent;
}

.tab-link:hover {
  color: #e8e8e8;
  background: rgba(255, 255, 255, 0.05);
}

.tab-link.active {
  color: #e8e8e8;
  border-bottom-color: #e94560;
  background: rgba(255, 255, 255, 0.1);
}
</style>
