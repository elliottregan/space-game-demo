<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    cost?: string;
    disabled?: boolean;
    selected?: boolean;
  }>(),
  {
    disabled: false,
    selected: false,
  }
);

defineEmits<{
  click: [];
}>();
</script>

<template>
  <div
    class="g-action-card"
    :class="{ disabled, selected }"
    @click="!disabled && $emit('click')"
  >
    <div class="g-action-card__header">
      <span class="g-action-card__title">{{ title }}</span>
      <span v-if="$slots.tag" class="g-action-card__tag">
        <slot name="tag" />
      </span>
    </div>

    <p v-if="description" class="g-action-card__description">
      {{ description }}
    </p>

    <slot />

    <div v-if="cost || $slots.cost" class="g-action-card__cost">
      <slot name="cost">{{ cost }}</slot>
    </div>
  </div>
</template>

<style scoped>
.g-action-card {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  padding: var(--g-space-sm);
  cursor: pointer;
  transition:
    border-color var(--g-transition-fast),
    background var(--g-transition-fast),
    box-shadow var(--g-transition-fast);
}

.g-action-card:hover:not(.disabled) {
  background: var(--g-color-bg-elevated);
  border-color: var(--g-color-border-focus);
  box-shadow: var(--g-glow-subtle);
}

.g-action-card.selected {
  border-color: var(--g-color-info);
  background: oklch(65% 0.15 250 / 0.1);
}

.g-action-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.g-action-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--g-space-sm);
}

.g-action-card__title {
  font-family: var(--g-font-mono);
  font-weight: 600;
  color: var(--g-color-warning);
}

.g-action-card__tag {
  flex-shrink: 0;
}

.g-action-card__description {
  margin: 0;
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  line-height: 1.4;
}

.g-action-card__cost {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: oklch(70% 0.15 280);
}
</style>
