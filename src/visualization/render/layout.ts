// src/visualization/render/layout.ts
// Main layout rendering and app coordination

import { formatFilename } from "../formatters";
import { handleServerFileSelect } from "../handlers";
import {
  getBatchA,
  getBatchB,
  getFileNameA,
  getFileNameB,
  getCurrentPage,
  setCurrentPage,
  clearBatchA,
  clearBatchB,
} from "../state";
import { renderDragOverlay, renderErrorToast, renderEmptyState } from "./overlays";
import { renderChartsContent, renderCharts } from "./charts-page";
import { renderStatsContent } from "./stats-page";

// DOM element reference
let appElement: HTMLElement | null = null;

/**
 * Initialize layout with app element.
 */
export function initLayout(app: HTMLElement): void {
  appElement = app;
}

/**
 * Render page navigation.
 */
function renderNavigation(): string {
  if (!getBatchA()) return "";

  const currentPage = getCurrentPage();
  return `
    <nav class="page-nav">
      <button id="nav-charts" class="nav-btn${
        currentPage === "charts" ? " active" : ""
      }">Charts</button>
      <button id="nav-stats" class="nav-btn${
        currentPage === "stats" ? " active" : ""
      }">Statistics</button>
    </nav>
  `;
}

/**
 * Switch between pages.
 */
function switchPage(page: "charts" | "stats"): void {
  setCurrentPage(page);
  render();
  if (page === "charts") {
    renderCharts();
  }
}

/**
 * Render the loaded state (files loaded, show controls).
 */
function renderLoadedState(): string {
  const batchB = getBatchB();
  const currentPage = getCurrentPage();

  return `
    <header class="header">
      <h1>Simulation Analysis Viewer</h1>
      <div class="batch-selectors">
        <div class="batch-selector">
          <label>Batch A:</label>
          <div class="file-info">
            <span class="file-info-name">${formatFilename(getFileNameA())}</span>
            <button class="file-info-btn" id="clear-a" title="Clear">×</button>
          </div>
        </div>
        <div class="batch-selector">
          <label>Batch B (compare):</label>
          ${
            batchB
              ? `
            <div class="file-info">
              <span class="file-info-name">${formatFilename(getFileNameB())}</span>
              <button class="file-info-btn" id="clear-b" title="Clear">×</button>
            </div>
          `
              : `
            <button class="add-compare-btn" id="add-batch-b">+ Add comparison</button>
          `
          }
        </div>
      </div>
    </header>
    ${renderNavigation()}
    <main class="charts-grid">
      ${currentPage === "charts" ? renderChartsContent() : renderStatsContent()}
    </main>
  `;
}

/**
 * Attach event listeners after render.
 */
function attachEventListeners(): void {
  const fileInputA = document.getElementById("file-input-a") as HTMLInputElement | null;
  const fileInputB = document.getElementById("file-input-b") as HTMLInputElement | null;

  // Navigation
  document.getElementById("nav-charts")?.addEventListener("click", () => switchPage("charts"));
  document.getElementById("nav-stats")?.addEventListener("click", () => switchPage("stats"));

  // Empty state browse button
  document.getElementById("browse-btn")?.addEventListener("click", () => {
    fileInputA?.click();
  });

  // Clear buttons
  document.getElementById("clear-a")?.addEventListener("click", () => {
    clearBatchA();
    render();
  });

  document.getElementById("clear-b")?.addEventListener("click", () => {
    clearBatchB();
    render();
    if (getCurrentPage() === "charts") {
      renderCharts();
    }
  });

  // Add batch B button
  document.getElementById("add-batch-b")?.addEventListener("click", () => {
    fileInputB?.click();
  });

  // Server file list items
  document.querySelectorAll(".file-list-item").forEach((item) => {
    item.addEventListener("click", () => {
      const file = item.getAttribute("data-file");
      const target = item.getAttribute("data-target") as "a" | "b";
      if (file) {
        handleServerFileSelect(file, target);
      }
    });
  });

  // Server file selector dropdowns
  document.getElementById("server-file-a")?.addEventListener("change", (e) => {
    const select = e.target as HTMLSelectElement;
    if (select.value) {
      handleServerFileSelect(select.value, "a");
      select.value = "";
    }
  });

  document.getElementById("server-file-b")?.addEventListener("change", (e) => {
    const select = e.target as HTMLSelectElement;
    if (select.value) {
      handleServerFileSelect(select.value, "b");
      select.value = "";
    }
  });
}

/**
 * Render the app.
 */
export function render(): void {
  if (!appElement) return;

  appElement.innerHTML = `
    ${renderDragOverlay()}
    ${renderErrorToast()}
    ${getBatchA() ? renderLoadedState() : renderEmptyState()}
  `;

  attachEventListeners();
}

// Re-export renderCharts for use in handlers
export { renderCharts };
