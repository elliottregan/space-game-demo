<script setup lang="ts">
import { computed } from "vue";
import GBadge from "../primitives/GBadge.vue";
import GProgress from "../primitives/GProgress.vue";

export type EntityStatus = "active" | "pending" | "disabled" | "idle" | "recycling";

const props = withDefaults(
  defineProps<{
    name: string;
    instanceId: string;
    status: EntityStatus;
    statusLabel?: string;
    isBroken?: boolean;
    condition?: number;
    constructionProgress?: number;
    constructionMax?: number;
  }>(),
  {
    isBroken: false,
  },
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusVariant = computed(() => {
  if (props.isBroken) return "negative";
  switch (props.status) {
    case "active":
      return "positive";
    case "pending":
      return "warning";
    case "disabled":
      return "muted";
    case "idle":
      return "muted";
    case "recycling":
      return "warning";
    default:
      return "muted";
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const computedStatusLabel = computed(() => {
  if (props.statusLabel) return props.statusLabel;
  if (props.isBroken) return "Broken";
  switch (props.status) {
    case "active":
      return "Active";
    case "pending":
      return "Building";
    case "disabled":
      return "Disabled";
    case "idle":
      return "Idle";
    case "recycling":
      return "Recycling";
    default:
      return props.status;
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const showCondition = computed(() => {
  return props.status === "active" && props.condition !== undefined;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const showConstructionProgress = computed(() => {
  return (
    props.status === "pending" &&
    props.constructionProgress !== undefined &&
    props.constructionMax !== undefined
  );
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const constructionPercent = computed(() => {
  if (props.constructionMax === undefined || props.constructionMax === 0) return 0;
  if (props.constructionProgress === undefined) return 0;
  return (props.constructionProgress / props.constructionMax) * 100;
});
</script>

<template>
  <div class="entity-header-wrapper">
    <div class="entity-header">
      <div class="entity-title">
        <span class="entity-name">{{ name }}</span>
        <span class="entity-id">#{{ instanceId }}</span>
      </div>
      <div class="entity-status">
        <GBadge :variant="statusVariant">
          {{ computedStatusLabel }}
        </GBadge>
        <span v-if="showCondition" class="condition">
          {{ Math.round(condition!) }}%
        </span>
        <slot name="stats" />
      </div>
    </div>

    <div v-if="showConstructionProgress" class="construction-progress">
      <GProgress :percent="constructionPercent" variant="warning" show-label>
        <slot name="progress-label">
          {{ Math.round(constructionPercent) }}%
        </slot>
      </GProgress>
    </div>

    <slot />
  </div>
</template>

<style scoped>
.entity-header-wrapper {
  /* Minimal wrapper - allows content below header */
}

.entity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-sm);
}

.entity-title {
  display: flex;
  align-items: baseline;
  gap: var(--g-space-sm);
}

.entity-name {
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.entity-id {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.entity-status {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.condition {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.construction-progress {
  margin-bottom: var(--g-space-sm);
}
</style>
