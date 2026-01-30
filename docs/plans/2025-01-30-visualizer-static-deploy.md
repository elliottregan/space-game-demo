# Visualizer Static Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the simulation visualizer as a standalone static site with drag-and-drop JSON file loading.

**Architecture:** Separate Vite build config outputs to `dist/visualizer/`. The app uses FileReader API to load JSON files client-side, removing all server API dependencies. UI states: empty (drop zone), loaded (charts), dragging (overlay).

**Tech Stack:** Vite, TypeScript, D3.js (existing charts)

---

### Task 1: Create Vite Config for Visualizer

**Files:**
- Create: `vite.visualizer.config.ts`

**Step 1: Create the Vite config file**

```typescript
// vite.visualizer.config.ts
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src/visualization",
  base: process.env.VITE_VISUALIZER_BASE || "/",
  build: {
    outDir: "../../dist/visualizer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

**Step 2: Commit**

```bash
git add vite.visualizer.config.ts
git commit -m "build: add Vite config for visualizer static build"
```

---

### Task 2: Add Package Scripts

**Files:**
- Modify: `package.json`

**Step 1: Add visualizer build scripts**

Add these scripts to `package.json`:

```json
"build:visualizer": "vite build --config vite.visualizer.config.ts",
"preview:visualizer": "vite preview --config vite.visualizer.config.ts",
"dev:visualizer": "vite dev --config vite.visualizer.config.ts"
```

**Step 2: Test the build**

Run: `bun run build:visualizer`
Expected: Build succeeds, outputs to `dist/visualizer/`

**Step 3: Commit**

```bash
git add package.json
git commit -m "build: add visualizer build/preview/dev scripts"
```

---

### Task 3: Update index.html for Vite

**Files:**
- Modify: `src/visualization/index.html`

**Step 1: Update script tag and add file input**

Change the HTML to:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Simulation Analysis Viewer</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <input type="file" id="file-input-a" accept=".json" hidden />
    <input type="file" id="file-input-b" accept=".json" hidden />
    <script type="module" src="./app.ts"></script>
  </body>
</html>
```

Note: Removed `/theme.css` (not needed for standalone), changed paths to relative for Vite.

**Step 2: Test dev server**

Run: `bun run dev:visualizer`
Expected: Dev server starts, page loads (will show empty state error until app.ts is updated)

**Step 3: Commit**

```bash
git add src/visualization/index.html
git commit -m "build: update index.html for Vite compatibility"
```

---

### Task 4: Add Drop Zone and Error Toast Styles

**Files:**
- Modify: `src/visualization/styles.css`

**Step 1: Add styles at end of file**

```css
/* Drop zone styles */
.drop-zone {
  border: 2px dashed var(--g-color-border);
  border-radius: 8px;
  padding: var(--g-space-xl, 32px);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--g-color-bg-surface);
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: var(--g-accent-cyan, #5f9ea0);
  background: var(--g-color-bg-elevated);
}

.drop-zone-icon {
  font-size: 3rem;
  margin-bottom: var(--g-space-md, 16px);
  opacity: 0.5;
}

.drop-zone-text {
  font-size: 1.125rem;
  margin-bottom: var(--g-space-sm, 8px);
}

.drop-zone-hint {
  font-size: 0.875rem;
  color: var(--g-color-text-muted);
}

.browse-btn {
  background: var(--g-color-bg-elevated);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  padding: 0.5rem 1rem;
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  margin-top: var(--g-space-md, 16px);
  transition: all 0.2s ease;
}

.browse-btn:hover {
  border-color: var(--g-accent-cyan, #5f9ea0);
  color: var(--g-accent-cyan, #5f9ea0);
}

/* Full-page drag overlay */
.drop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: none;
}

.drop-overlay-content {
  text-align: center;
  color: var(--g-accent-cyan, #5f9ea0);
}

.drop-overlay-icon {
  font-size: 4rem;
  margin-bottom: var(--g-space-md, 16px);
}

.drop-overlay-text {
  font-size: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* File info display */
.file-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm, 8px);
  font-size: 0.875rem;
}

.file-info-name {
  color: var(--g-color-text);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-info-btn {
  background: none;
  border: 1px solid var(--g-color-border);
  color: var(--g-color-text-muted);
  padding: 0.25rem 0.5rem;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-info-btn:hover {
  border-color: var(--g-color-text);
  color: var(--g-color-text);
}

/* Error toast */
.error-toast {
  position: fixed;
  bottom: var(--g-space-lg, 24px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--chart-negative);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  z-index: 1001;
  animation: toast-in 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Batch file selectors for loaded state */
.batch-files {
  display: flex;
  gap: var(--g-space-md, 16px);
  align-items: center;
}

.batch-file {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm, 8px);
}

.batch-file-label {
  font-size: 0.875rem;
  color: var(--g-color-text-muted);
  text-transform: uppercase;
}

.add-compare-btn {
  background: none;
  border: 1px dashed var(--g-color-border);
  color: var(--g-color-text-muted);
  padding: 0.25rem 0.75rem;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-compare-btn:hover {
  border-color: var(--g-accent-cyan, #5f9ea0);
  color: var(--g-accent-cyan, #5f9ea0);
}
```

**Step 2: Commit**

```bash
git add src/visualization/styles.css
git commit -m "style: add drop zone, overlay, and toast styles"
```

---

### Task 5: Rewrite app.ts for Client-Side File Loading

**Files:**
- Modify: `src/visualization/app.ts`

**Step 1: Replace API calls with file loading logic**

Replace the entire `src/visualization/app.ts` with the new implementation. Key changes:

1. Remove `fetchLogs()` and `fetchLog()` functions
2. Add `loadFile(file: File): Promise<AnalysisOutput>` using FileReader
3. Add `validateAnalysisOutput(data: unknown): data is AnalysisOutput` for validation
4. Add drag-and-drop event handlers
5. Add `isDragging` state for overlay
6. Update `render()` for empty/loaded states
7. Add error toast display

The new app.ts should be:

```typescript
// src/visualization/app.ts
// Main entry point for visualization app - static file loading version

import type { AnalysisOutput } from "./types";

// State
let batchA: AnalysisOutput | null = null;
let batchB: AnalysisOutput | null = null;
let fileNameA: string = "";
let fileNameB: string = "";
let currentPage: "charts" | "stats" = "charts";
let isDragging = false;
let loadingTarget: "a" | "b" = "a";
let errorMessage: string | null = null;

// DOM Elements
const app = document.getElementById("app")!;
const fileInputA = document.getElementById("file-input-a") as HTMLInputElement;
const fileInputB = document.getElementById("file-input-b") as HTMLInputElement;

/**
 * Validate that data matches AnalysisOutput structure.
 */
function validateAnalysisOutput(data: unknown): data is AnalysisOutput {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  // Check required top-level fields
  if (typeof obj.metadata !== "object" || obj.metadata === null) return false;
  if (typeof obj.summary !== "object" || obj.summary === null) return false;
  if (!Array.isArray(obj.victoryTimes)) return false;
  if (!Array.isArray(obj.peakPopulations)) return false;

  // Check metadata fields
  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.runs !== "number") return false;

  // Check summary fields
  const summary = obj.summary as Record<string, unknown>;
  if (typeof summary.winRate !== "number") return false;
  if (typeof summary.victories !== "number") return false;
  if (typeof summary.defeats !== "number") return false;

  return true;
}

/**
 * Load and parse a JSON file.
 */
async function loadFile(file: File): Promise<AnalysisOutput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (!validateAnalysisOutput(data)) {
          reject(new Error("Invalid analysis file format"));
          return;
        }

        resolve(data);
      } catch (err) {
        reject(new Error("Failed to parse JSON file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Show error toast.
 */
function showError(message: string): void {
  errorMessage = message;
  render();

  setTimeout(() => {
    errorMessage = null;
    render();
  }, 4000);
}

/**
 * Handle file selection for batch A.
 */
async function handleFileA(file: File): Promise<void> {
  try {
    batchA = await loadFile(file);
    fileNameA = file.name;
    currentPage = "charts";
    render();
    if (currentPage === "charts") {
      renderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Handle file selection for batch B.
 */
async function handleFileB(file: File): Promise<void> {
  try {
    batchB = await loadFile(file);
    fileNameB = file.name;
    render();
    if (currentPage === "charts") {
      renderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Set up drag and drop handlers.
 */
function setupDragAndDrop(): void {
  let dragCounter = 0;

  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      isDragging = true;
      render();
    }
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      isDragging = false;
      render();
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    dragCounter = 0;
    isDragging = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      render();
      return;
    }

    const file = files[0];
    if (!file.name.endsWith(".json")) {
      showError("Please drop a JSON file");
      return;
    }

    // If no batch A, load as A; otherwise load as B
    if (!batchA) {
      await handleFileA(file);
    } else {
      await handleFileB(file);
    }
  });
}

/**
 * Set up file input handlers.
 */
function setupFileInputs(): void {
  fileInputA.addEventListener("change", async () => {
    const file = fileInputA.files?.[0];
    if (file) {
      await handleFileA(file);
      fileInputA.value = "";
    }
  });

  fileInputB.addEventListener("change", async () => {
    const file = fileInputB.files?.[0];
    if (file) {
      await handleFileB(file);
      fileInputB.value = "";
    }
  });
}

/**
 * Format filename for display.
 */
function formatFilename(filename: string): string {
  // analysis-2026-01-27T08-12-40-r200-s1.json -> 2026-01-27 08:12 (200 runs, seed 1)
  const match = filename.match(/analysis-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-\d{2}-r(\d+)-s(\d+)/);
  if (match) {
    const [, date, hour, minute, runs, seed] = match;
    return `${date} ${hour}:${minute} (${runs} runs, seed ${seed})`;
  }
  return filename;
}

/**
 * Render the app.
 */
function render(): void {
  app.innerHTML = `
    ${isDragging ? renderDragOverlay() : ""}
    ${errorMessage ? renderErrorToast() : ""}
    ${batchA ? renderLoadedState() : renderEmptyState()}
  `;

  // Attach event listeners after render
  attachEventListeners();
}

/**
 * Render drag overlay.
 */
function renderDragOverlay(): string {
  return `
    <div class="drop-overlay">
      <div class="drop-overlay-content">
        <div class="drop-overlay-icon">📂</div>
        <div class="drop-overlay-text">Drop to load</div>
      </div>
    </div>
  `;
}

/**
 * Render error toast.
 */
function renderErrorToast(): string {
  return `<div class="error-toast">${errorMessage}</div>`;
}

/**
 * Render empty state with drop zone.
 */
function renderEmptyState(): string {
  return `
    <div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">📊</div>
      <div class="drop-zone-text">Drop simulation analysis JSON here</div>
      <div class="drop-zone-hint">or</div>
      <button class="browse-btn" id="browse-btn">Browse files</button>
    </div>
  `;
}

/**
 * Render loaded state with header and content.
 */
function renderLoadedState(): string {
  return `
    <header class="header">
      <h1>Simulation Analysis Viewer</h1>
      <div class="batch-files">
        <div class="batch-file">
          <span class="batch-file-label">A:</span>
          <div class="file-info">
            <span class="file-info-name" title="${fileNameA}">${formatFilename(fileNameA)}</span>
            <button class="file-info-btn" id="change-a">Change</button>
          </div>
        </div>
        ${batchB ? `
          <div class="batch-file">
            <span class="batch-file-label">B:</span>
            <div class="file-info">
              <span class="file-info-name" title="${fileNameB}">${formatFilename(fileNameB)}</span>
              <button class="file-info-btn" id="change-b">Change</button>
              <button class="file-info-btn" id="remove-b">✕</button>
            </div>
          </div>
        ` : `
          <button class="add-compare-btn" id="add-compare">+ Compare</button>
        `}
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
  // Empty state listeners
  const dropZone = document.getElementById("drop-zone");
  const browseBtn = document.getElementById("browse-btn");

  if (dropZone) {
    dropZone.addEventListener("click", () => fileInputA.click());
  }
  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInputA.click();
    });
  }

  // Loaded state listeners
  document.getElementById("change-a")?.addEventListener("click", () => fileInputA.click());
  document.getElementById("change-b")?.addEventListener("click", () => fileInputB.click());
  document.getElementById("add-compare")?.addEventListener("click", () => fileInputB.click());
  document.getElementById("remove-b")?.addEventListener("click", () => {
    batchB = null;
    fileNameB = "";
    render();
    if (currentPage === "charts") {
      renderCharts();
    }
  });

  // Navigation listeners
  document.getElementById("nav-charts")?.addEventListener("click", () => switchPage("charts"));
  document.getElementById("nav-stats")?.addEventListener("click", () => switchPage("stats"));
}

/**
 * Render page navigation.
 */
function renderNavigation(): string {
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
  currentPage = page;
  render();
  if (page === "charts") {
    renderCharts();
  }
}

/**
 * Render charts page content.
 */
function renderChartsContent(): string {
  if (!batchA) {
    return `<div class="empty-state">Select an analysis batch to view results</div>`;
  }

  return `
    ${renderSummary()}
    <div class="chart-panel">
      <h2>Victory Time Distribution</h2>
      ${batchB ? renderLegend() : ""}
      <div id="histogram" class="chart-container"></div>
    </div>
    <div class="chart-panel">
      <h2>Resource Timeline</h2>
      ${batchB ? renderTimelineLegend() : ""}
      <div id="timeline" class="chart-container"></div>
    </div>
    <div class="charts-row">
      <div class="chart-panel">
        <h2>Crisis Heatmap</h2>
        <div id="heatmap" class="chart-container"></div>
      </div>
      <div class="chart-panel">
        <h2>Tech/Building Progression</h2>
        <div id="progression" class="chart-container"></div>
      </div>
    </div>
    ${batchB ? renderComparison() : ""}
  `;
}

/**
 * Render stats page content.
 */
function renderStatsContent(): string {
  if (!batchA) {
    return `<div class="empty-state">Select an analysis batch to view statistics</div>`;
  }

  const stats = batchA.stats;
  if (!stats) {
    return `<div class="empty-state">No detailed statistics available for this batch. Re-run analysis to generate stats.</div>`;
  }

  return `
    ${renderTechFrequency()}
    ${renderBuildingStats()}
    ${renderVictoryTimeStats()}
    ${renderVictoryDefeatComparison()}
    ${renderCorrelations()}
    ${renderSocialCohesion()}
    ${renderBottlenecks()}
    ${renderEventImpact()}
    ${renderCrisisTimeline()}
  `;
}

// === Keep all the existing render functions unchanged ===
// renderTechFrequency, renderBuildingStats, renderVictoryTimeStats,
// renderVictoryDefeatComparison, renderCorrelations, renderSocialCohesion,
// renderBottlenecks, renderEventImpact, renderCrisisTimeline,
// formatTechName, formatBuildingName, formatEventName, formatCrisisType,
// getCorrelationStrength, renderSummary, renderLegend, renderTimelineLegend,
// renderComparison, renderCharts

// [Include all the existing render functions from lines 175-954 unchanged]

/**
 * Initialize the app.
 */
function init(): void {
  setupDragAndDrop();
  setupFileInputs();
  render();
}

init();
```

**Note:** The implementation preserves all existing render functions (renderTechFrequency through renderCharts) unchanged from the original file. Only the file loading, state management, and empty/loaded state rendering are changed.

**Step 2: Test the app**

Run: `bun run dev:visualizer`
Expected:
- Page shows drop zone
- Can drag JSON file and it loads
- Charts render after loading
- Can add comparison file

**Step 3: Commit**

```bash
git add src/visualization/app.ts
git commit -m "feat: replace server API with client-side file loading"
```

---

### Task 6: Test Production Build

**Files:** None (testing only)

**Step 1: Build the visualizer**

Run: `bun run build:visualizer`
Expected: Build succeeds, files in `dist/visualizer/`

**Step 2: Preview the build**

Run: `bun run preview:visualizer`
Expected: Preview server starts, app loads and works with drag-and-drop

**Step 3: Verify with a real JSON file**

1. Generate a test file: `bun run simulate:analyze --runs 5`
2. Open preview in browser
3. Drag the JSON file from `logs/simulations/` onto the page
4. Verify charts render correctly

---

### Task 7: Final Cleanup and Documentation

**Files:**
- Modify: `README.md` or project docs (if needed)

**Step 1: Add dist/visualizer to .gitignore if not already**

Check if `dist/` is already in `.gitignore`. If not, add it.

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete visualizer static deployment

- Add Vite build config for standalone visualizer
- Add drag-and-drop and file picker for JSON loading
- Add drop zone UI with overlay and error toast
- Remove server API dependencies
- Build outputs to dist/visualizer/"
```
