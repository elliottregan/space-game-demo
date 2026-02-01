// src/visualization/handlers.ts
// Event handlers for file loading and drag/drop

import { loadFile, loadFromApi } from "./api";
import {
  setBatchA,
  setBatchB,
  setFileNameA,
  setFileNameB,
  setDragging,
  setErrorMessage,
  getBatchA,
  getBatchB,
  getCurrentPage,
} from "./state";

// Callbacks that will be set by layout module to avoid circular dependency
let renderCallback: (() => void) | null = null;
let renderChartsCallback: (() => void) | null = null;

/**
 * Register render callbacks from layout module.
 */
export function setRenderCallbacks(render: () => void, renderCharts: () => void): void {
  renderCallback = render;
  renderChartsCallback = renderCharts;
}

/**
 * Trigger a render if callback is registered.
 */
function triggerRender(): void {
  renderCallback?.();
}

/**
 * Trigger chart render if callback is registered.
 */
function triggerRenderCharts(): void {
  renderChartsCallback?.();
}

/**
 * Show an error toast message.
 */
export function showError(message: string): void {
  setErrorMessage(message);
  triggerRender();
  setTimeout(() => {
    setErrorMessage(null);
    triggerRender();
  }, 4000);
}

/**
 * Handle file selection for Batch A.
 */
export async function handleFileA(file: File): Promise<void> {
  try {
    const data = await loadFile(file);
    setBatchA(data);
    setFileNameA(file.name);
    triggerRender();
    if (getCurrentPage() === "charts") {
      triggerRenderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Handle file selection for Batch B.
 */
export async function handleFileB(file: File): Promise<void> {
  try {
    const data = await loadFile(file);
    setBatchB(data);
    setFileNameB(file.name);
    triggerRender();
    if (getCurrentPage() === "charts") {
      triggerRenderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Handle selecting a file from the server list.
 */
export async function handleServerFileSelect(filename: string, target: "a" | "b"): Promise<void> {
  try {
    const data = await loadFromApi(filename);
    if (target === "a") {
      setBatchA(data);
      setFileNameA(filename);
    } else {
      setBatchB(data);
      setFileNameB(filename);
    }
    triggerRender();
    if (getCurrentPage() === "charts") {
      triggerRenderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Set up drag and drop handlers for the entire document.
 */
export function setupDragAndDrop(): void {
  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    setDragging(true);
    triggerRender();
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    // Only hide overlay if leaving the document
    if (e.relatedTarget === null) {
      setDragging(false);
      triggerRender();
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    setDragging(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      triggerRender();
      return;
    }

    const file = files[0];
    if (!file) {
      triggerRender();
      return;
    }
    if (!file.name.endsWith(".json") && !file.name.endsWith(".json.gz")) {
      showError("Please drop a JSON or JSON.GZ file");
      return;
    }

    // Load as Batch A if empty, otherwise as Batch B
    if (!getBatchA()) {
      await handleFileA(file);
    } else if (!getBatchB()) {
      await handleFileB(file);
    } else {
      showError("Both batches already loaded. Clear one first.");
    }
  });
}

/**
 * Set up file input change handlers.
 */
export function setupFileInputs(): void {
  const fileInputA = document.getElementById("file-input-a") as HTMLInputElement | null;
  const fileInputB = document.getElementById("file-input-b") as HTMLInputElement | null;

  fileInputA?.addEventListener("change", async () => {
    const file = fileInputA.files?.[0];
    if (file) {
      await handleFileA(file);
      fileInputA.value = "";
    }
  });

  fileInputB?.addEventListener("change", async () => {
    const file = fileInputB.files?.[0];
    if (file) {
      await handleFileB(file);
      fileInputB.value = "";
    }
  });
}
