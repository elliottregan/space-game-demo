// src/visualization/app.ts
// Main entry point for visualization app

import { checkApiAvailability } from "./api";
import { setupDragAndDrop, setupFileInputs, setRenderCallbacks } from "./handlers";
import { initLayout, render, renderCharts } from "./render/layout";

/**
 * Initialize the app.
 */
async function init(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App element not found");
  }

  // Initialize layout with app element
  initLayout(app);

  // Register render callbacks with handlers to avoid circular dependency
  setRenderCallbacks(render, renderCharts);

  // Set up event handlers
  setupDragAndDrop();
  setupFileInputs();

  // Check API availability before first render
  await checkApiAvailability();

  // Initial render
  render();
}

init();
