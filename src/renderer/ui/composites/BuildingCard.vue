<script setup lang="ts">
import { computed } from "vue";
import GPanel from "../primitives/GPanel.vue";
import GProgress from "../primitives/GProgress.vue";
import ResourceBadge from "./ResourceBadge.vue";
import type { PlacedBuilding } from "@/core/models/Building";

const props = defineProps<{
  building: PlacedBuilding;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const isConstructing = computed(() => props.building.constructionProgress !== undefined);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const constructionPercent = computed(() => {
  if (!props.building.constructionProgress) return 100;
  const { current, required } = props.building.constructionProgress;
  return (current / required) * 100;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const productionEntries = computed(() => {
  if (!props.building.template.production) return [];
  return Object.entries(props.building.template.production).filter(([, v]) => v !== 0);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const consumptionEntries = computed(() => {
  if (!props.building.template.consumption) return [];
  return Object.entries(props.building.template.consumption).filter(([, v]) => v !== 0);
});
</script>

<template>
  <GPanel :title="building.template.name" :glow="isConstructing" thick>
    <div class="g-building-card__content">
      <div v-if="isConstructing" class="g-building-card__construction">
        <GProgress :percent="constructionPercent" showLabel>
          Building...
        </GProgress>
      </div>

      <template v-else>
        <div v-if="building.workers !== undefined" class="g-building-card__workers">
          <span class="g-building-card__workers-label">Workers</span>
          <span class="g-building-card__workers-count">
            {{ building.workers }} / {{ building.template.workerSlots }}
          </span>
        </div>

        <div v-if="productionEntries.length" class="g-building-card__resources">
          <span class="g-building-card__resources-label">Produces</span>
          <div class="g-building-card__resources-list">
            <ResourceBadge
              v-for="[key, value] in productionEntries"
              :key="key"
              :resource="key as any"
              :amount="0"
              :rate="value"
              size="sm"
            />
          </div>
        </div>

        <div v-if="consumptionEntries.length" class="g-building-card__resources">
          <span class="g-building-card__resources-label">Consumes</span>
          <div class="g-building-card__resources-list">
            <ResourceBadge
              v-for="[key, value] in consumptionEntries"
              :key="key"
              :resource="key as any"
              :amount="0"
              :rate="-Math.abs(value)"
              size="sm"
            />
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <slot name="actions" />
    </template>
  </GPanel>
</template>

<style scoped>
.g-building-card__content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.g-building-card__construction {
  padding: var(--g-space-xs) 0;
}

.g-building-card__workers {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.g-building-card__workers-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.g-building-card__workers-count {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
}

.g-building-card__resources {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.g-building-card__resources-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.g-building-card__resources-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-sm);
}
</style>
