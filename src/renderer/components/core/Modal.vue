<template>
  <!--
    Reusable accessible modal built on Reka UI's headless Dialog. Reka's
    `modal` (default true) traps focus inside DialogContent, makes the rest of
    the page inert, and hides it from screen readers. DialogContent renders
    role="dialog" + aria-modal and is labelled/described by DialogTitle/
    DialogDescription. When `dismissable` is false (resolution-required
    flows), Esc and outside-pointer dismissals are cancelled with
    preventDefault so the dialog can only be closed programmatically.
  -->
  <DialogRoot :open="open" @update:open="onUpdateOpen">
    <DialogPortal>
      <DialogOverlay class="modal-scrim" />
      <DialogContent
        class="modal-dialog"
        @escape-key-down="onEscapeKeyDown"
        @pointer-down-outside="onPointerDownOutside"
      >
        <header class="modal-head">
          <DialogTitle class="modal-title">{{ title }}</DialogTitle>
          <slot name="header" />
        </header>

        <!-- Visually-hidden description keeps aria-describedby satisfied even
             when callers pass none; Reka warns in dev if absent. -->
        <DialogDescription v-if="description" class="modal-desc">
          {{ description }}
        </DialogDescription>
        <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>

        <div class="modal-body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    /** Controlled open state. */
    open: boolean;
    /** Required accessible title (rendered as the dialog heading + aria-labelledby). */
    title: string;
    /** Optional accessible description (aria-describedby). Falls back to the title. */
    description?: string;
    /**
     * When false, the dialog cannot be dismissed by Esc or an outside click —
     * only a programmatic close (parent flipping `open`) will close it. Use for
     * "resolution required" gates (e.g. the promotion picker). Default true.
     */
    dismissable?: boolean;
  }>(),
  {
    description: undefined,
    dismissable: true,
  },
);

const emit = defineEmits<{
  /** Mirrors Reka's controlled-open contract: the parent owns `open`. */
  "update:open": [value: boolean];
  /** Fired only when the dialog requests a close (dismissable closes / programmatic false). */
  close: [];
}>();

function onUpdateOpen(value: boolean): void {
  emit("update:open", value);
  if (!value) emit("close");
}

function onEscapeKeyDown(event: KeyboardEvent): void {
  if (!props.dismissable) event.preventDefault();
}

function onPointerDownOutside(event: Event): void {
  if (!props.dismissable) event.preventDefault();
}
</script>

<style scoped>
.modal-scrim {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  /* Above existing modals (crisis 100, policy gate 70); matches ConfirmDialog. */
  z-index: 200;
}

.modal-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 201;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: min(92vw, 560px);
  max-height: 90vh;
  overflow: auto;
  padding: var(--space-5);
  background: var(--paper);
  box-shadow: var(--shadow-lifted);
}

.modal-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
.modal-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-muted);
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.modal-foot {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-1);
}

/* Accessible-but-invisible: keeps DialogDescription in the a11y tree without
   showing it when no `description` prop is given. */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
