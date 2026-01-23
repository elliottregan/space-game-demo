<script setup lang="ts">
import { GButton } from "../../ui";

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
  <div class="category-tabs">
    <GButton
      :variant="selectedCategory === 'available' ? 'primary' : 'ghost'"
      size="sm"
      @click="emit('update:selectedCategory', 'available')"
    >
      Available
    </GButton>
    <GButton
      :variant="selectedCategory === 'built' ? 'primary' : 'ghost'"
      size="sm"
      @click="emit('update:selectedCategory', 'built')"
    >
      Built ({{ activeCount }})
    </GButton>
    <GButton
      :variant="selectedCategory === 'recreation' ? 'primary' : 'ghost'"
      size="sm"
      @click="emit('update:selectedCategory', 'recreation')"
    >
      Recreation
    </GButton>
    <GButton
      :variant="selectedCategory === 'all' ? 'primary' : 'ghost'"
      size="sm"
      @click="emit('update:selectedCategory', 'all')"
    >
      All
    </GButton>
  </div>
</template>

<style scoped>
.category-tabs {
  display: flex;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-md);
}
</style>
