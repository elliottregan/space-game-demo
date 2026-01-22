<script setup lang="ts">
import TechTreeGraph from "./TechTreeGraph.vue";
</script>

<template>
  <div class="research-tab">
    <TechTreeGraph />
  </div>
</template>

<style scoped>
.research-tab {
  height: calc(100vh - 180px);
  min-height: 500px;
}

.research-tab :deep(.tech-tree-container) {
  height: 100%;
}
</style>
