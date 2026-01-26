<script setup lang="ts">
import type { Technology } from "../../../core/models/Technology";
import { GButton } from "../../ui";
import { formatTechCost } from "../../utils/formatters";

defineProps<{
  tech: Technology;
  variant: "available" | "completed" | "locked";
  canResearch: boolean;
  hasActiveResearch: boolean;
  prerequisiteNames: string[];
  hasAllPrerequisites: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  research: [];
  hover: [];
  leave: [];
}>();
</script>

<template>
  <div
    class="tech-card"
    :class="variant"
    @mouseenter="emit('hover')"
    @mouseleave="emit('leave')"
  >
    <div class="tech-name">{{ tech.name }}</div>

    <template v-if="variant !== 'completed'">
      <div class="tech-desc">{{ tech.description }}</div>

      <template v-if="variant === 'available'">
        <div class="tech-cost">{{ formatTechCost(tech) }}</div>
        <div v-if="tech.unlocks.length > 0" class="tech-unlocks">
          Unlocks: {{ tech.unlocks.join(', ') }}
        </div>
        <GButton
          variant="primary"
          :disabled="!canResearch || hasActiveResearch"
          @click="emit('research')"
        >
          Research
        </GButton>
      </template>

      <template v-else-if="variant === 'locked'">
        <div v-if="!hasAllPrerequisites" class="tech-prereqs">
          Requires: {{ prerequisiteNames.join(', ') }}
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.tech-card {
  background: var(--g-color-bg-surface);
  padding: var(--g-space-sm);
  border: 1px solid var(--g-color-border);
}

.tech-card.available {
  border-color: rgba(0, 131, 143, 0.3);
}

.tech-card.available:hover {
  border-color: var(--g-accent-cyan);
  box-shadow: var(--g-glow-subtle);
}

.tech-card.completed {
  display: inline-block;
  padding: var(--g-space-xs) var(--g-space-sm);
  background: rgba(76, 175, 80, 0.1);
  border-color: rgba(76, 175, 80, 0.3);
}

.tech-card.locked {
  opacity: 0.6;
}

.tech-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-xs);
}

.tech-card.completed .tech-name {
  color: var(--g-color-positive);
  margin-bottom: 0;
}

.tech-desc {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.tech-cost {
  font-size: var(--g-font-size-xs);
  color: var(--g-accent-cyan);
  margin-bottom: var(--g-space-xs);
}

.tech-unlocks {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-positive);
  margin-bottom: var(--g-space-xs);
}

.tech-prereqs {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-negative);
}

.tech-card :deep(.g-button) {
  margin-top: var(--g-space-xs);
  width: 100%;
}
</style>
