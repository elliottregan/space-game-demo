<script setup lang="ts">
import { GTabGroup } from "../../ui";

defineProps<{
  selectedCategory: "all" | "available" | "built" | "recreation";
  activeCount: number;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  "update:selectedCategory": [category: "all" | "available" | "built" | "recreation"];
}>();
</script>

<template>
  <GTabGroup
    :model-value="selectedCategory"
    @update:model-value="
      emit('update:selectedCategory', $event as 'all' | 'available' | 'built' | 'recreation')
    "
    :tabs="[
      { id: 'available', label: 'Available' },
      { id: 'built', label: 'Built', badge: activeCount },
      { id: 'recreation', label: 'Recreation' },
      { id: 'all', label: 'All' },
    ]"
  />
</template>
