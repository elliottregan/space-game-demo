<script setup lang="ts">
import GButton from "../primitives/GButton.vue";

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    cost?: string;
    actionLabel?: string;
    disabled?: boolean;
    selected?: boolean;
  }>(),
  {
    disabled: false,
    selected: false,
  },
);

defineEmits<{
  click: [];
}>();
</script>

<template>
  <div
    class="g-action-card"
    :class="{ disabled, selected }"
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

    <div v-if="actionLabel" class="g-action-card__actions">
      <GButton
        size="sm"
        :disabled="disabled"
        @click="$emit('click')"
      >
        {{ actionLabel }}
      </GButton>
    </div>
  </div>
</template>

<style scoped>
.g-action-card {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  padding: var(--g-space-md);
  margin: var(--g-space-sm) 0;
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
  border-bottom: var(--g-border-width-thin) solid var(--g-color-border-strong);
}

.g-action-card.selected {
  background: var(--g-color-bg-surface);
}

.g-action-card.disabled {
  opacity: 0.5;
}

.g-action-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--g-space-sm);
}

.g-action-card__title {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  color: var(--g-color-text-muted);
}

.g-action-card__actions {
  margin-top: var(--g-space-xs);
}
</style>
