<template>
  <Panel :title="`Monuments (${active})`">
    <div v-if="monuments.length === 0" class="empty">None yet.</div>
    <div v-for="m in monuments" :key="m.id" :class="['monument-item', { echo: !m.active }]">
      <span>{{ m.projectName }}</span>
      <span>E{{ m.mintedOnEpoch }}</span>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Monument } from "../../../../core/types.ts";
import Panel from "../../core/Panel.vue";

const props = defineProps<{ monuments: Monument[] }>();

const active = computed(() => props.monuments.filter((m) => m.active).length);
</script>

<style scoped>
.empty {
  color: var(--text-subtle);
  font-size: 11px;
}
</style>
