// v-drop-zone — encapsulates HTML5 drag-and-drop target behavior.
// Adds .drop-target while a drag is active and accepted, .drag-over while
// hovered, and invokes the handler with the parsed payload on drop.

import { watchEffect, type Directive, type WatchStopHandle } from "vue";
import { dragging, endDrag, readDragPayload, type DragPayload } from "./dragState.ts";

export interface DropZoneOptions {
  /** Whether this zone accepts the current drag. Defaults to "any drag". */
  accepts?: () => boolean;
  onDrop: (payload: DragPayload) => void;
}

interface DropZoneEl extends HTMLElement {
  __dropZone?: {
    options: DropZoneOptions | null;
    stop: WatchStopHandle;
    listeners: Record<string, EventListener>;
  };
}

function accepted(el: DropZoneEl): boolean {
  const opts = el.__dropZone?.options;
  if (!opts) return false;
  return dragging.value !== null && (opts.accepts?.() ?? true);
}

export const vDropZone: Directive<DropZoneEl, DropZoneOptions | null> = {
  mounted(el, binding) {
    const listeners: Record<string, EventListener> = {
      dragenter: (e) => {
        if (!accepted(el)) return;
        e.preventDefault();
        el.classList.add("drag-over");
      },
      dragover: (e) => {
        if (!accepted(el)) return;
        e.preventDefault();
        const de = (e as DragEvent).dataTransfer;
        if (de) de.dropEffect = "move";
      },
      dragleave: (e) => {
        if (el.contains((e as MouseEvent).relatedTarget as Node)) return;
        el.classList.remove("drag-over");
      },
      drop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("drag-over");
        if (!accepted(el)) return;
        const payload = readDragPayload(e as DragEvent);
        if (!payload) return;
        el.__dropZone?.options?.onDrop(payload);
        endDrag();
      },
    };
    for (const [ev, fn] of Object.entries(listeners)) el.addEventListener(ev, fn);
    const stop = watchEffect(() => {
      el.classList.toggle("drop-target", accepted(el));
    });
    el.__dropZone = { options: binding.value, stop, listeners };
  },
  updated(el, binding) {
    if (el.__dropZone) el.__dropZone.options = binding.value;
  },
  unmounted(el) {
    const zone = el.__dropZone;
    if (!zone) return;
    zone.stop();
    for (const [ev, fn] of Object.entries(zone.listeners)) el.removeEventListener(ev, fn);
    delete el.__dropZone;
  },
};
