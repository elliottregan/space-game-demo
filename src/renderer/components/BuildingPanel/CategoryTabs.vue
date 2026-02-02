<script setup lang="ts">
import { BuildingPurpose } from "../../../core/models/Building";
import { GTabGroup } from "../../ui";

defineProps<{
  selectedCategory: BuildingPurpose;
  counts: Record<BuildingPurpose, number>;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  "update:selectedCategory": [category: BuildingPurpose];
}>();
</script>

<template>
  <GTabGroup
    :model-value="selectedCategory"
    @update:model-value="emit('update:selectedCategory', $event as BuildingPurpose)"
    :tabs="[
      {
        id: BuildingPurpose.Residential,
        label: 'Residential',
        badge: counts[BuildingPurpose.Residential] || undefined,
      },
      {
        id: BuildingPurpose.Industrial,
        label: 'Industrial',
        badge: counts[BuildingPurpose.Industrial] || undefined,
      },
      {
        id: BuildingPurpose.Social,
        label: 'Social',
        badge: counts[BuildingPurpose.Social] || undefined,
      },
    ]"
  />
</template>
