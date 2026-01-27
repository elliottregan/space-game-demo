<script setup lang="ts">
import GButton from "./GButton.vue";
import type { Tab } from "../types";

const props = withDefaults(
  defineProps<{
    tabs: Tab[];
    modelValue: string;
    size?: "sm" | "md";
  }>(),
  {
    size: "sm",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function selectTab(tabId: string): void {
  if (tabId !== props.modelValue) {
    emit("update:modelValue", tabId);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatLabel(tab: Tab): string {
  if (tab.badge !== undefined) {
    return `${tab.label} (${tab.badge})`;
  }
  return tab.label;
}
</script>

<template>
  <div class="g-tab-group">
    <GButton
      v-for="tab in tabs"
      :key="tab.id"
      :variant="modelValue === tab.id ? 'primary' : 'ghost'"
      :size="size"
      @click="selectTab(tab.id)"
    >
      {{ formatLabel(tab) }}
    </GButton>
  </div>
</template>

<style scoped>
.g-tab-group {
  display: flex;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-md);
}
</style>
