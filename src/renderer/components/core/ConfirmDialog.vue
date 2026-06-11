<template>
  <div v-if="open" class="confirm-overlay" @click.self="$emit('cancel')">
    <div class="confirm-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <h2 :id="titleId" class="confirm-title">{{ title }}</h2>
      <div class="confirm-body">
        <slot />
      </div>
      <div class="confirm-actions">
        <button ref="cancelRef" class="confirm-cancel" @click="$emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button :class="['confirm-ok', danger ? 'danger' : 'primary']" @click="$emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }>(),
  {
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
  },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const cancelRef = ref<HTMLButtonElement | null>(null);

// Unique id so aria-labelledby doesn't collide if multiple dialogs exist.
const titleId = `confirm-title-${Math.random().toString(36).slice(2, 8)}`;

// Focus cancel button on open so Enter doesn't accidentally confirm.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      cancelRef.value?.focus();
    }
  },
);

// Escape key handler.
function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    emit("cancel");
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  /* Above existing modals (z-index 100) */
  z-index: 200;
}

.confirm-dialog {
  background: var(--paper);
  box-shadow: var(--shadow-lifted);
  padding: var(--space-5);
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.confirm-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.confirm-body {
  font-size: 13px;
  color: var(--ink-muted);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-1);
}

/* Danger confirm button: red background, white ink */
button.danger {
  background: var(--status-negative);
  color: #fff;
  font-weight: 600;
}
button.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--status-negative) 80%, #fff);
}
</style>
