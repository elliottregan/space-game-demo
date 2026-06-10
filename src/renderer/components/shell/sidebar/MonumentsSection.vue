<template>
  <Panel :title="`Monuments (${monuments.length})`">
    <div v-if="monuments.length === 0" class="empty">None yet.</div>
    <div v-for="m in monuments" :key="m.id" class="monument-item">
      <span>{{ m.projectName }}</span>
      <span>E{{ m.mintedOnEpoch }}</span>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import type { Monument } from "../../../../core/types.ts";
import Panel from "../../core/Panel.vue";

defineProps<{ monuments: Monument[] }>();
</script>

<style scoped>
.empty {
  color: var(--ink-subtle);
  font-size: 11px;
}
</style>
