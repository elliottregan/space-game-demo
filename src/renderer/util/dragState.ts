// Global reactive drag state — one card at a time, shared across components.

import { ref } from "vue";

export interface DragPayload {
  cardId: string;
  source: "hand";
}

export const dragging = ref<DragPayload | null>(null);

export function beginDrag(payload: DragPayload): void {
  dragging.value = payload;
}

export function endDrag(): void {
  dragging.value = null;
}

/** Read the payload from a DragEvent.dataTransfer. */
export function readDragPayload(e: DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer?.getData("application/json");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.cardId && parsed?.source === "hand") return parsed as DragPayload;
  } catch {
    // ignore
  }
  return null;
}
