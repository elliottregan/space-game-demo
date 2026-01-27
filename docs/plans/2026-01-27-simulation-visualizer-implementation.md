# Simulation Visualizer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone web app to visualize Monte Carlo simulation results with D3 charts and batch comparison.

**Architecture:** Bun server serves Vue 3 SPA on localhost:3001. Server provides API endpoints to list and fetch JSON analysis logs. Frontend uses D3.js for all charts. Reuses game's UI tokens for consistent styling.

**Tech Stack:** Bun, Vue 3, D3.js, TypeScript

---

## Task 1: Add JSON Output to Analysis Script

**Files:**
- Modify: `/workspace/scripts/analyze-simulation.ts`
- Reference: `/workspace/src/simulation/types.ts`

**Step 1: Add AnalysisOutput interface to types.ts**

Add to `src/simulation/types.ts`:

```typescript
/**
 * Complete analysis output for visualization.
 */
export interface AnalysisOutput {
  metadata: {
    timestamp: string;
    runs: number;
    seed: number;
  };
  summary: {
    winRate: number;
    victories: number;
    defeats: number;
    victoryTypes: Record<string, number>;
    defeatReasons: Record<string, number>;
  };
  victoryTimes: number[];
  peakPopulations: number[];
  techFrequency: Record<string, number>;
  buildingCounts: Record<string, number>;
  resourceTimeline: ResourceSnapshot[];
  crisisEvents: CrisisPoint[];
  runs: RunResult[];
}
```

**Step 2: Add JSON output function to analyze-simulation.ts**

Add after `writeDebugLog` function:

```typescript
/**
 * Write analysis data as JSON for visualization.
 */
async function writeJsonOutput(
  results: RunResult[],
  runs: number,
  seed: number
): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `analysis-${timestamp}-r${runs}-s${seed}.json`;
  const filepath = `logs/simulations/${filename}`;

  const victories = results.filter((r) => r.outcome === "victory");
  const defeats = results.filter((r) => r.outcome === "defeat");

  // Aggregate tech frequency
  const techFrequency: Record<string, number> = {};
  for (const result of results) {
    for (const tech of result.techsResearched) {
      techFrequency[tech] = (techFrequency[tech] ?? 0) + 1;
    }
  }

  // Aggregate building counts
  const buildingCounts: Record<string, number> = {};
  for (const result of results) {
    for (const [building, count] of Object.entries(result.buildingsBuilt)) {
      buildingCounts[building] = (buildingCounts[building] ?? 0) + count;
    }
  }

  // Victory type breakdown
  const victoryTypes: Record<string, number> = {};
  for (const v of victories) {
    if (v.victoryType) {
      victoryTypes[v.victoryType] = (victoryTypes[v.victoryType] ?? 0) + 1;
    }
  }

  // Defeat reason breakdown
  const defeatReasons: Record<string, number> = {};
  for (const d of defeats) {
    if (d.defeatReason) {
      defeatReasons[d.defeatReason] = (defeatReasons[d.defeatReason] ?? 0) + 1;
    }
  }

  // Aggregate resource timeline (average across runs at each snapshot interval)
  const timelineBySOL = new Map<number, ResourceSnapshot[]>();
  for (const result of results) {
    if (!result.resourceTimeline) continue;
    for (const snapshot of result.resourceTimeline) {
      const existing = timelineBySOL.get(snapshot.sol) ?? [];
      existing.push(snapshot);
      timelineBySOL.set(snapshot.sol, existing);
    }
  }

  const resourceTimeline: ResourceSnapshot[] = [];
  for (const [sol, snapshots] of Array.from(timelineBySOL.entries()).sort((a, b) => a[0] - b[0])) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    resourceTimeline.push({
      sol,
      food: avg(snapshots.map((s) => s.food)),
      oxygen: avg(snapshots.map((s) => s.oxygen)),
      water: avg(snapshots.map((s) => s.water)),
      power: avg(snapshots.map((s) => s.power)),
      materials: avg(snapshots.map((s) => s.materials)),
      population: avg(snapshots.map((s) => s.population)),
      morale: avg(snapshots.map((s) => s.morale)),
      health: avg(snapshots.map((s) => s.health)),
    });
  }

  // Aggregate crisis events
  const crisisEvents: CrisisPoint[] = [];
  for (const result of results) {
    if (result.crisisTimeline) {
      crisisEvents.push(...result.crisisTimeline);
    }
  }

  const output: AnalysisOutput = {
    metadata: {
      timestamp: now.toISOString(),
      runs,
      seed,
    },
    summary: {
      winRate: victories.length / results.length,
      victories: victories.length,
      defeats: defeats.length,
      victoryTypes,
      defeatReasons,
    },
    victoryTimes: victories.map((r) => r.finalSol),
    peakPopulations: results.map((r) => r.peakPopulation),
    techFrequency,
    buildingCounts,
    resourceTimeline,
    crisisEvents,
    runs: results,
  };

  await Bun.write(filepath, JSON.stringify(output, null, 2));
  return filepath;
}
```

**Step 3: Call JSON output in main function**

In `main()`, after the text debug log write, add:

```typescript
  // Always write JSON output for visualization
  const jsonPath = await writeJsonOutput(results, runs, seed);
  output(`\nJSON data written to: ${jsonPath}`);
```

**Step 4: Add import for AnalysisOutput type**

Update imports at top of `analyze-simulation.ts`:

```typescript
import type {
  SimulationConfig,
  RunResult,
  ResourceSnapshot,
  ResourceFlowSnapshot,
  CrisisPoint,
  BlockedDecision,
  EventOccurrence,
  AnalysisOutput,
} from "../src/simulation/types";
```

**Step 5: Test JSON output**

Run: `bun run simulate:analyze --runs 5 --seed 1`
Expected: See "JSON data written to: logs/simulations/analysis-*.json" in output

**Step 6: Commit**

```bash
git add src/simulation/types.ts scripts/analyze-simulation.ts
git commit -m "feat: add JSON output to simulation analysis for visualization"
```

---

## Task 2: Create Visualization Server

**Files:**
- Create: `/workspace/scripts/visualize.ts`
- Modify: `/workspace/package.json`

**Step 1: Create server script**

Create `scripts/visualize.ts`:

```typescript
#!/usr/bin/env bun
// scripts/visualize.ts
// Standalone server for simulation visualization

import { readdir } from "fs/promises";
import { join } from "path";

const PORT = 3001;
const LOGS_DIR = "logs/simulations";

/**
 * List available JSON analysis files.
 */
async function listLogs(): Promise<string[]> {
  try {
    const files = await readdir(LOGS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse(); // Newest first
  } catch {
    return [];
  }
}

/**
 * Read a specific log file.
 */
async function readLog(filename: string): Promise<string | null> {
  try {
    const filepath = join(LOGS_DIR, filename);
    const file = Bun.file(filepath);
    return await file.text();
  } catch {
    return null;
  }
}

/**
 * Serve the visualization app.
 */
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API: List logs
    if (path === "/api/logs") {
      const logs = await listLogs();
      return Response.json(logs);
    }

    // API: Get specific log
    if (path.startsWith("/api/logs/")) {
      const filename = path.slice("/api/logs/".length);
      if (!filename.endsWith(".json")) {
        return new Response("Invalid file type", { status: 400 });
      }
      const content = await readLog(filename);
      if (!content) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(content, {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Serve static files from src/visualization
    if (path === "/" || path === "/index.html") {
      const file = Bun.file("src/visualization/index.html");
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    // Serve CSS
    if (path.endsWith(".css")) {
      const file = Bun.file(`src/visualization${path}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    // Serve JS/TS (transpiled by Bun)
    if (path.endsWith(".ts") || path.endsWith(".js")) {
      const tsPath = `src/visualization${path.replace(".js", ".ts")}`;
      const file = Bun.file(tsPath);
      if (await file.exists()) {
        const result = await Bun.build({
          entrypoints: [tsPath],
          target: "browser",
        });
        if (result.outputs.length > 0) {
          const text = await result.outputs[0].text();
          return new Response(text, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
      }
    }

    // Serve theme.css from renderer
    if (path === "/theme.css") {
      const file = Bun.file("src/renderer/ui/tokens/theme.css");
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Visualization server running at http://localhost:${PORT}`);
```

**Step 2: Add npm script**

In `package.json`, add to scripts:

```json
"visualize": "bun run scripts/visualize.ts"
```

**Step 3: Test server starts**

Run: `bun run visualize`
Expected: "Visualization server running at http://localhost:3001"

**Step 4: Commit**

```bash
git add scripts/visualize.ts package.json
git commit -m "feat: add visualization server with API endpoints"
```

---

## Task 3: Create HTML Shell and Base Styles

**Files:**
- Create: `/workspace/src/visualization/index.html`
- Create: `/workspace/src/visualization/styles.css`

**Step 1: Create index.html**

Create `src/visualization/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulation Analysis Viewer</title>
  <link rel="stylesheet" href="/theme.css">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

**Step 2: Create styles.css**

Create `src/visualization/styles.css`:

```css
/* Force dark mode for visualization tool */
:root {
  --g-color-bg-base: oklch(15% 0.01 250);
  --g-color-bg-surface: oklch(18% 0.01 250);
  --g-color-bg-elevated: oklch(22% 0.01 250);
  --g-color-text: oklch(90% 0 0);
  --g-color-text-muted: oklch(60% 0 0);
  --g-color-border: oklch(30% 0.01 250);

  /* Chart colors */
  --chart-batch-a: oklch(65% 0.15 250);
  --chart-batch-b: oklch(70% 0.18 50);
  --chart-positive: oklch(65% 0.15 145);
  --chart-negative: oklch(60% 0.2 25);
  --chart-warning: oklch(70% 0.18 85);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--g-font-mono, 'JetBrains Mono', monospace);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  min-height: 100vh;
  padding: var(--g-space-md, 16px);
}

#app {
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-lg, 24px);
  padding-bottom: var(--g-space-md, 16px);
  border-bottom: 2px solid var(--g-color-border);
}

.header h1 {
  font-size: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--g-accent-cyan, #5f9ea0);
}

.batch-selectors {
  display: flex;
  gap: var(--g-space-md, 16px);
  align-items: center;
}

.batch-selector {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm, 8px);
}

.batch-selector label {
  font-size: 0.875rem;
  color: var(--g-color-text-muted);
  text-transform: uppercase;
}

.batch-selector select {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  padding: 0.5rem 1rem;
  font-family: inherit;
  font-size: 0.875rem;
  min-width: 280px;
}

.charts-grid {
  display: grid;
  gap: var(--g-space-md, 16px);
}

.chart-panel {
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  padding: var(--g-space-md, 16px);
}

.chart-panel h2 {
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-md, 16px);
  color: var(--g-accent-amber, #d4a574);
  border-bottom: 1px solid var(--g-color-border);
  padding-bottom: var(--g-space-sm, 8px);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--g-space-md, 16px);
}

.summary-card {
  background: var(--g-color-bg-elevated);
  padding: var(--g-space-md, 16px);
  text-align: center;
}

.summary-card .value {
  font-size: 2rem;
  font-weight: bold;
}

.summary-card .label {
  font-size: 0.75rem;
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  margin-top: var(--g-space-xs, 4px);
}

.loading {
  text-align: center;
  padding: var(--g-space-xl, 32px);
  color: var(--g-color-text-muted);
}

.empty-state {
  text-align: center;
  padding: var(--g-space-xl, 32px);
  color: var(--g-color-text-muted);
}

/* Chart SVG styles */
.chart-container svg {
  display: block;
  width: 100%;
}

.axis text {
  fill: var(--g-color-text-muted);
  font-size: 0.75rem;
}

.axis line,
.axis path {
  stroke: var(--g-color-border);
}

.grid line {
  stroke: var(--g-color-border);
  stroke-opacity: 0.3;
}

.bar-a {
  fill: var(--chart-batch-a);
}

.bar-b {
  fill: var(--chart-batch-b);
}

.line-a {
  stroke: var(--chart-batch-a);
  fill: none;
  stroke-width: 2;
}

.line-b {
  stroke: var(--chart-batch-b);
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 5,5;
}

.area-a {
  fill: var(--chart-batch-a);
  fill-opacity: 0.2;
}

.legend {
  display: flex;
  gap: var(--g-space-md, 16px);
  margin-bottom: var(--g-space-sm, 8px);
  font-size: 0.875rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs, 4px);
}

.legend-swatch {
  width: 16px;
  height: 3px;
}

.legend-swatch.batch-a {
  background: var(--chart-batch-a);
}

.legend-swatch.batch-b {
  background: var(--chart-batch-b);
}

/* Two-column layout for smaller charts */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--g-space-md, 16px);
}

@media (max-width: 1000px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}
```

**Step 3: Test static files serve**

Run: `bun run visualize`
Open: http://localhost:3001
Expected: See blank page with title "Simulation Analysis Viewer"

**Step 4: Commit**

```bash
git add src/visualization/index.html src/visualization/styles.css
git commit -m "feat: add visualization HTML shell and dark theme styles"
```

---

## Task 4: Create Main App Entry Point

**Files:**
- Create: `/workspace/src/visualization/app.ts`
- Create: `/workspace/src/visualization/types.ts`

**Step 1: Create types.ts**

Create `src/visualization/types.ts`:

```typescript
// src/visualization/types.ts
// Re-export types from simulation for use in visualization

export type {
  AnalysisOutput,
  ResourceSnapshot,
  CrisisPoint,
  RunResult,
} from "../simulation/types";
```

**Step 2: Create app.ts**

Create `src/visualization/app.ts`:

```typescript
// src/visualization/app.ts
// Main entry point for visualization app

import type { AnalysisOutput } from "./types";

// State
let logs: string[] = [];
let batchA: AnalysisOutput | null = null;
let batchB: AnalysisOutput | null = null;

// DOM Elements
const app = document.getElementById("app")!;

/**
 * Fetch list of available log files.
 */
async function fetchLogs(): Promise<string[]> {
  const response = await fetch("/api/logs");
  return response.json();
}

/**
 * Fetch a specific log file.
 */
async function fetchLog(filename: string): Promise<AnalysisOutput> {
  const response = await fetch(`/api/logs/${filename}`);
  return response.json();
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
    <header class="header">
      <h1>Simulation Analysis Viewer</h1>
      <div class="batch-selectors">
        <div class="batch-selector">
          <label>Batch A:</label>
          <select id="select-a">
            <option value="">Select analysis...</option>
            ${logs.map((f) => `<option value="${f}">${formatFilename(f)}</option>`).join("")}
          </select>
        </div>
        <div class="batch-selector">
          <label>Batch B (compare):</label>
          <select id="select-b">
            <option value="">None</option>
            ${logs.map((f) => `<option value="${f}">${formatFilename(f)}</option>`).join("")}
          </select>
        </div>
      </div>
    </header>
    <main class="charts-grid">
      ${renderContent()}
    </main>
  `;

  // Attach event listeners
  document.getElementById("select-a")?.addEventListener("change", onSelectA);
  document.getElementById("select-b")?.addEventListener("change", onSelectB);
}

/**
 * Render main content area.
 */
function renderContent(): string {
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
      ${batchB ? renderLegend() : ""}
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
 * Render summary cards.
 */
function renderSummary(): string {
  if (!batchA) return "";

  const { summary, victoryTimes, peakPopulations } = batchA;
  const avgVictoryTime = victoryTimes.length > 0
    ? Math.round(victoryTimes.reduce((a, b) => a + b, 0) / victoryTimes.length)
    : 0;
  const avgPeakPop = Math.round(peakPopulations.reduce((a, b) => a + b, 0) / peakPopulations.length);

  return `
    <div class="chart-panel">
      <h2>Summary</h2>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="value">${summary.victories + summary.defeats}</div>
          <div class="label">Total Runs</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color: var(--chart-positive)">${Math.round(summary.winRate * 100)}%</div>
          <div class="label">Win Rate</div>
        </div>
        <div class="summary-card">
          <div class="value">${avgVictoryTime}</div>
          <div class="label">Avg Victory (sols)</div>
        </div>
        <div class="summary-card">
          <div class="value">${avgPeakPop}</div>
          <div class="label">Avg Peak Pop</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render legend for comparison mode.
 */
function renderLegend(): string {
  return `
    <div class="legend">
      <div class="legend-item">
        <span class="legend-swatch batch-a"></span>
        <span>Batch A</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch batch-b"></span>
        <span>Batch B</span>
      </div>
    </div>
  `;
}

/**
 * Render comparison summary.
 */
function renderComparison(): string {
  if (!batchA || !batchB) return "";

  const winRateDiff = (batchB.summary.winRate - batchA.summary.winRate) * 100;
  const avgTimeA = batchA.victoryTimes.length > 0
    ? batchA.victoryTimes.reduce((a, b) => a + b, 0) / batchA.victoryTimes.length
    : 0;
  const avgTimeB = batchB.victoryTimes.length > 0
    ? batchB.victoryTimes.reduce((a, b) => a + b, 0) / batchB.victoryTimes.length
    : 0;
  const timeDiff = avgTimeB - avgTimeA;

  return `
    <div class="chart-panel">
      <h2>Comparison Summary</h2>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="value" style="color: ${winRateDiff >= 0 ? "var(--chart-positive)" : "var(--chart-negative)"}">
            ${winRateDiff >= 0 ? "+" : ""}${winRateDiff.toFixed(1)}%
          </div>
          <div class="label">Win Rate Change</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color: ${timeDiff <= 0 ? "var(--chart-positive)" : "var(--chart-negative)"}">
            ${timeDiff >= 0 ? "+" : ""}${Math.round(timeDiff)}
          </div>
          <div class="label">Avg Time Change (sols)</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Handle batch A selection.
 */
async function onSelectA(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const filename = select.value;

  if (!filename) {
    batchA = null;
    render();
    return;
  }

  batchA = await fetchLog(filename);
  render();
  renderCharts();
}

/**
 * Handle batch B selection.
 */
async function onSelectB(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const filename = select.value;

  if (!filename) {
    batchB = null;
    render();
    renderCharts();
    return;
  }

  batchB = await fetchLog(filename);
  render();
  renderCharts();
}

/**
 * Render D3 charts (placeholder - implemented in separate tasks).
 */
function renderCharts(): void {
  if (!batchA) return;

  // Charts will be rendered by separate modules
  import("./charts/histogram.js").then((m) => m.renderHistogram("histogram", batchA!, batchB));
  import("./charts/timeline.js").then((m) => m.renderTimeline("timeline", batchA!, batchB));
  import("./charts/heatmap.js").then((m) => m.renderHeatmap("heatmap", batchA!, batchB));
  import("./charts/progression.js").then((m) => m.renderProgression("progression", batchA!, batchB));
}

/**
 * Initialize the app.
 */
async function init(): Promise<void> {
  app.innerHTML = `<div class="loading">Loading...</div>`;
  logs = await fetchLogs();
  render();
}

init();
```

**Step 3: Test app loads**

Run: `bun run visualize`
Open: http://localhost:3001
Expected: See header with dropdown selectors and "Select an analysis batch" message

**Step 4: Commit**

```bash
git add src/visualization/app.ts src/visualization/types.ts
git commit -m "feat: add visualization app entry point with batch selection"
```

---

## Task 5: Create Victory Histogram Chart

**Files:**
- Create: `/workspace/src/visualization/charts/histogram.ts`

**Step 1: Create histogram.ts**

Create `src/visualization/charts/histogram.ts`:

```typescript
// src/visualization/charts/histogram.ts
// Victory time distribution histogram using D3

import * as d3 from "d3";
import type { AnalysisOutput } from "../types";

export function renderHistogram(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clear previous
  container.innerHTML = "";

  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Combine data to find domain
  const allTimes = [...batchA.victoryTimes, ...(batchB?.victoryTimes ?? [])];
  if (allTimes.length === 0) {
    container.innerHTML = '<div class="empty-state">No victory data</div>';
    return;
  }

  const maxTime = Math.max(...allTimes);
  const binWidth = 50;
  const bins = Math.ceil(maxTime / binWidth);

  // Create histogram bins
  const histogramA = d3
    .bin()
    .domain([0, bins * binWidth])
    .thresholds(bins)(batchA.victoryTimes);

  const histogramB = batchB
    ? d3.bin().domain([0, bins * binWidth]).thresholds(bins)(batchB.victoryTimes)
    : null;

  // Scales
  const x = d3
    .scaleLinear()
    .domain([0, bins * binWidth])
    .range([0, width]);

  const maxCount = Math.max(
    d3.max(histogramA, (d) => d.length) ?? 0,
    histogramB ? d3.max(histogramB, (d) => d.length) ?? 0 : 0
  );

  const y = d3.scaleLinear().domain([0, maxCount]).nice().range([height, 0]);

  // Grid lines
  svg
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(y)
        .tickSize(-width)
        .tickFormat(() => "")
    );

  // Bars
  const barWidth = batchB ? (width / bins - 4) / 2 : width / bins - 2;

  svg
    .selectAll(".bar-a")
    .data(histogramA)
    .join("rect")
    .attr("class", "bar-a")
    .attr("x", (d) => x(d.x0 ?? 0) + 1)
    .attr("width", barWidth)
    .attr("y", (d) => y(d.length))
    .attr("height", (d) => height - y(d.length));

  if (histogramB) {
    svg
      .selectAll(".bar-b")
      .data(histogramB)
      .join("rect")
      .attr("class", "bar-b")
      .attr("x", (d) => x(d.x0 ?? 0) + 1 + barWidth + 2)
      .attr("width", barWidth)
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => height - y(d.length));
  }

  // X axis
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat((d) => `${d}`));

  // X axis label
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Victory Time (sols)");

  // Y axis
  svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));

  // Y axis label
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Number of Runs");
}
```

**Step 2: Update server to handle d3 imports**

Update `scripts/visualize.ts` to serve node_modules:

Add this case before the "Not found" return:

```typescript
    // Serve d3 from node_modules
    if (path.startsWith("/node_modules/")) {
      const file = Bun.file(path.slice(1)); // Remove leading /
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }
```

**Step 3: Create d3 re-export for browser**

Create `src/visualization/d3.ts`:

```typescript
// Re-export d3 modules we need
export * from "d3-selection";
export * from "d3-scale";
export * from "d3-axis";
export * from "d3-array";
export * from "d3-shape";
```

**Step 4: Update histogram to use local d3**

Update first line of `src/visualization/charts/histogram.ts`:

```typescript
import * as d3 from "../d3";
```

**Step 5: Test histogram renders**

Run: `bun run simulate:analyze --runs 10 --seed 1`
Run: `bun run visualize`
Open: http://localhost:3001
Select a batch, expected: Histogram shows victory time distribution

**Step 6: Commit**

```bash
git add src/visualization/charts/histogram.ts src/visualization/d3.ts scripts/visualize.ts
git commit -m "feat: add victory time histogram chart with D3"
```

---

## Task 6: Create Resource Timeline Chart

**Files:**
- Create: `/workspace/src/visualization/charts/timeline.ts`

**Step 1: Create timeline.ts**

Create `src/visualization/charts/timeline.ts`:

```typescript
// src/visualization/charts/timeline.ts
// Resource timeline line chart using D3

import * as d3 from "../d3";
import type { AnalysisOutput, ResourceSnapshot } from "../types";

const RESOURCE_COLORS: Record<string, string> = {
  food: "#4caf50",
  oxygen: "#2196f3",
  water: "#00bcd4",
  power: "#ffc107",
  population: "#9c27b0",
  morale: "#ff5722",
};

export function renderTimeline(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  const margin = { top: 20, right: 120, bottom: 40, left: 50 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const timelineA = batchA.resourceTimeline;
  const timelineB = batchB?.resourceTimeline ?? [];

  if (timelineA.length === 0) {
    container.innerHTML = '<div class="empty-state">No timeline data</div>';
    return;
  }

  // X scale (sols)
  const maxSol = Math.max(
    d3.max(timelineA, (d) => d.sol) ?? 0,
    d3.max(timelineB, (d) => d.sol) ?? 0
  );
  const x = d3.scaleLinear().domain([0, maxSol]).range([0, width]);

  // Y scale (normalize to 0-100 for comparison)
  const y = d3.scaleLinear().domain([0, 150]).range([height, 0]);

  // Grid
  svg
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(y)
        .tickSize(-width)
        .tickFormat(() => "")
    );

  // Line generator
  const line = (key: keyof ResourceSnapshot) =>
    d3
      .line<ResourceSnapshot>()
      .x((d) => x(d.sol))
      .y((d) => y(d[key] as number))
      .curve(d3.curveMonotoneX);

  // Draw lines for each resource
  const resources: (keyof ResourceSnapshot)[] = ["food", "oxygen", "water", "population", "morale"];

  for (const resource of resources) {
    // Batch A - solid lines
    svg
      .append("path")
      .datum(timelineA)
      .attr("class", "line-a")
      .attr("stroke", RESOURCE_COLORS[resource])
      .attr("d", line(resource));

    // Batch B - dashed lines
    if (timelineB.length > 0) {
      svg
        .append("path")
        .datum(timelineB)
        .attr("class", "line-b")
        .attr("stroke", RESOURCE_COLORS[resource])
        .attr("d", line(resource));
    }
  }

  // X axis
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Sol");

  // Y axis
  svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

  // Legend
  const legend = svg
    .append("g")
    .attr("transform", `translate(${width + 10}, 0)`);

  resources.forEach((resource, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 20})`);

    g.append("line")
      .attr("x1", 0)
      .attr("x2", 20)
      .attr("y1", 10)
      .attr("y2", 10)
      .attr("stroke", RESOURCE_COLORS[resource])
      .attr("stroke-width", 2);

    g.append("text")
      .attr("x", 25)
      .attr("y", 14)
      .attr("fill", "var(--g-color-text)")
      .attr("font-size", "0.75rem")
      .text(resource.charAt(0).toUpperCase() + resource.slice(1));
  });
}
```

**Step 2: Test timeline renders**

Run: `bun run visualize`
Select a batch, expected: Multi-line chart showing resource trends over time

**Step 3: Commit**

```bash
git add src/visualization/charts/timeline.ts
git commit -m "feat: add resource timeline line chart"
```

---

## Task 7: Create Crisis Heatmap Chart

**Files:**
- Create: `/workspace/src/visualization/charts/heatmap.ts`

**Step 1: Create heatmap.ts**

Create `src/visualization/charts/heatmap.ts`:

```typescript
// src/visualization/charts/heatmap.ts
// Crisis occurrence heatmap using D3

import * as d3 from "../d3";
import type { AnalysisOutput, CrisisPoint } from "../types";

const CRISIS_TYPES = ["low_food", "low_oxygen", "low_water", "low_morale", "population_drop"];
const CRISIS_LABELS: Record<string, string> = {
  low_food: "Food",
  low_oxygen: "Oxygen",
  low_water: "Water",
  low_morale: "Morale",
  population_drop: "Pop Drop",
};

export function renderHeatmap(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  const margin = { top: 20, right: 20, bottom: 60, left: 80 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 200 - margin.top - margin.bottom;

  // Aggregate crisis data into bins
  const binWidth = 100;
  const maxSol = 1500;
  const numBins = Math.ceil(maxSol / binWidth);

  function aggregateCrises(crises: CrisisPoint[]): Map<string, number[]> {
    const result = new Map<string, number[]>();
    for (const type of CRISIS_TYPES) {
      result.set(type, new Array(numBins).fill(0));
    }
    for (const crisis of crises) {
      const bin = Math.min(Math.floor(crisis.sol / binWidth), numBins - 1);
      const counts = result.get(crisis.type);
      if (counts) {
        counts[bin]++;
      }
    }
    return result;
  }

  const dataA = aggregateCrises(batchA.crisisEvents);
  const dataB = batchB ? aggregateCrises(batchB.crisisEvents) : null;

  // Find max count for color scale
  let maxCount = 0;
  for (const counts of dataA.values()) {
    maxCount = Math.max(maxCount, ...counts);
  }
  if (dataB) {
    for (const counts of dataB.values()) {
      maxCount = Math.max(maxCount, ...counts);
    }
  }

  // Render single heatmap or side-by-side
  if (!dataB) {
    renderSingleHeatmap(container, dataA, maxCount, margin, width, height, numBins, binWidth, "A");
  } else {
    const halfWidth = (width - 20) / 2;

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "20px";
    container.appendChild(wrapper);

    const containerA = document.createElement("div");
    containerA.style.flex = "1";
    wrapper.appendChild(containerA);

    const containerB = document.createElement("div");
    containerB.style.flex = "1";
    wrapper.appendChild(containerB);

    renderSingleHeatmap(containerA, dataA, maxCount, margin, halfWidth, height, numBins, binWidth, "Batch A");
    renderSingleHeatmap(containerB, dataB, maxCount, margin, halfWidth, height, numBins, binWidth, "Batch B");
  }
}

function renderSingleHeatmap(
  container: HTMLElement,
  data: Map<string, number[]>,
  maxCount: number,
  margin: { top: number; right: number; bottom: number; left: number },
  width: number,
  height: number,
  numBins: number,
  binWidth: number,
  title: string
): void {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text(title);

  // Scales
  const x = d3.scaleLinear().domain([0, numBins * binWidth]).range([0, width]);
  const y = d3.scaleBand().domain(CRISIS_TYPES).range([0, height]).padding(0.1);
  const color = d3
    .scaleSequential()
    .domain([0, maxCount])
    .interpolator(d3.interpolateYlOrRd);

  // Cells
  const cellWidth = width / numBins;
  const cellHeight = y.bandwidth();

  for (const [type, counts] of data) {
    counts.forEach((count, bin) => {
      if (count > 0) {
        svg
          .append("rect")
          .attr("x", bin * cellWidth)
          .attr("y", y(type) ?? 0)
          .attr("width", cellWidth - 1)
          .attr("height", cellHeight)
          .attr("fill", color(count))
          .attr("rx", 2);
      }
    });
  }

  // X axis
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(d3.range(0, numBins * binWidth + 1, 500))
        .tickFormat((d) => `${d}`)
    );

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Sol");

  // Y axis
  svg
    .append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickFormat((d) => CRISIS_LABELS[d] ?? d));
}
```

**Step 2: Add d3-scale-chromatic for color interpolation**

Update `src/visualization/d3.ts`:

```typescript
// Re-export d3 modules we need
export * from "d3-selection";
export * from "d3-scale";
export * from "d3-axis";
export * from "d3-array";
export * from "d3-shape";

// Color interpolation for heatmaps
export const interpolateYlOrRd = (t: number): string => {
  // Yellow to Orange to Red gradient
  const r = Math.round(255);
  const g = Math.round(255 * (1 - t * 0.8));
  const b = Math.round(255 * (1 - t));
  return `rgb(${r},${g},${b})`;
};
```

**Step 3: Test heatmap renders**

Run: `bun run visualize`
Select a batch, expected: Heatmap grid showing crisis frequency by type and time

**Step 4: Commit**

```bash
git add src/visualization/charts/heatmap.ts src/visualization/d3.ts
git commit -m "feat: add crisis heatmap chart"
```

---

## Task 8: Create Progression Chart

**Files:**
- Create: `/workspace/src/visualization/charts/progression.ts`

**Step 1: Create progression.ts**

Create `src/visualization/charts/progression.ts`:

```typescript
// src/visualization/charts/progression.ts
// Tech/building progression horizontal bar chart

import * as d3 from "../d3";
import type { AnalysisOutput } from "../types";

export function renderProgression(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  const margin = { top: 20, right: 30, bottom: 40, left: 150 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  // Calculate median first-built sol for each tech
  function getMedianTechSols(data: AnalysisOutput): Map<string, number> {
    const techSols = new Map<string, number[]>();

    for (const run of data.runs) {
      if (run.techCompletedSol) {
        for (const [tech, sol] of Object.entries(run.techCompletedSol)) {
          const existing = techSols.get(tech) ?? [];
          existing.push(sol);
          techSols.set(tech, existing);
        }
      }
    }

    const medians = new Map<string, number>();
    for (const [tech, sols] of techSols) {
      sols.sort((a, b) => a - b);
      medians.set(tech, sols[Math.floor(sols.length / 2)] ?? 0);
    }
    return medians;
  }

  const mediansA = getMedianTechSols(batchA);
  const mediansB = batchB ? getMedianTechSols(batchB) : null;

  // Combine and sort by batch A timing
  const allTechs = new Set([...mediansA.keys(), ...(mediansB?.keys() ?? [])]);
  const sortedTechs = Array.from(allTechs).sort(
    (a, b) => (mediansA.get(a) ?? 9999) - (mediansA.get(b) ?? 9999)
  );

  if (sortedTechs.length === 0) {
    container.innerHTML = '<div class="empty-state">No tech progression data</div>';
    return;
  }

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const maxSol = Math.max(
    d3.max(Array.from(mediansA.values())) ?? 0,
    mediansB ? d3.max(Array.from(mediansB.values())) ?? 0 : 0
  );

  const x = d3.scaleLinear().domain([0, maxSol * 1.1]).range([0, width]);
  const y = d3
    .scaleBand()
    .domain(sortedTechs)
    .range([0, height])
    .padding(mediansB ? 0.2 : 0.3);

  // Grid
  svg
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisTop(x)
        .tickSize(-height)
        .tickFormat(() => "")
    );

  const barHeight = mediansB ? y.bandwidth() / 2 - 2 : y.bandwidth();

  // Batch A bars
  svg
    .selectAll(".bar-a")
    .data(sortedTechs.filter((t) => mediansA.has(t)))
    .join("rect")
    .attr("class", "bar-a")
    .attr("x", 0)
    .attr("y", (d) => y(d) ?? 0)
    .attr("width", (d) => x(mediansA.get(d) ?? 0))
    .attr("height", barHeight)
    .attr("rx", 2);

  // Batch B bars
  if (mediansB) {
    svg
      .selectAll(".bar-b")
      .data(sortedTechs.filter((t) => mediansB.has(t)))
      .join("rect")
      .attr("class", "bar-b")
      .attr("x", 0)
      .attr("y", (d) => (y(d) ?? 0) + barHeight + 4)
      .attr("width", (d) => x(mediansB.get(d) ?? 0))
      .attr("height", barHeight)
      .attr("rx", 2);
  }

  // X axis
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Median Sol Researched");

  // Y axis
  svg
    .append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y).tickFormat((d) =>
        d
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      )
    );
}
```

**Step 2: Test progression chart renders**

Run: `bun run visualize`
Select a batch, expected: Horizontal bar chart showing tech research timing

**Step 3: Commit**

```bash
git add src/visualization/charts/progression.ts
git commit -m "feat: add tech progression bar chart"
```

---

## Task 9: Wire Up Chart Imports and Final Testing

**Files:**
- Modify: `/workspace/scripts/visualize.ts`
- Modify: `/workspace/src/visualization/app.ts`

**Step 1: Update server to handle chart module imports**

In `scripts/visualize.ts`, update the JS/TS handling to support charts directory:

```typescript
    // Serve JS/TS (transpiled by Bun)
    if (path.endsWith(".ts") || path.endsWith(".js")) {
      // Handle both root and subdirectory files
      let tsPath = `src/visualization${path.replace(".js", ".ts")}`;

      // Check if file exists
      let file = Bun.file(tsPath);
      if (!(await file.exists())) {
        // Try without .ts replacement for actual .ts files
        tsPath = `src/visualization${path}`;
        file = Bun.file(tsPath);
      }

      if (await file.exists()) {
        const result = await Bun.build({
          entrypoints: [tsPath],
          target: "browser",
          external: [], // Bundle everything
        });
        if (result.outputs.length > 0) {
          const text = await result.outputs[0].text();
          return new Response(text, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
      }
    }
```

**Step 2: Run full end-to-end test**

1. Generate test data: `bun run simulate:analyze --runs 20 --seed 1`
2. Start server: `bun run visualize`
3. Open http://localhost:3001
4. Select batch A from dropdown
5. Verify all charts render:
   - Summary cards show run count, win rate, avg time, avg peak pop
   - Histogram shows victory time distribution
   - Timeline shows resource lines
   - Heatmap shows crisis data
   - Progression shows tech research timing
6. Select batch B
7. Verify comparison mode:
   - Legend appears
   - Histogram shows overlaid bars
   - Timeline shows dashed lines for batch B
   - Heatmap shows side-by-side
   - Progression shows grouped bars
   - Comparison summary shows deltas

**Step 3: Final commit**

```bash
git add scripts/visualize.ts
git commit -m "feat: complete visualization tool with all charts"
```

---

## Task 10: Update Documentation

**Files:**
- Modify: `/workspace/CLAUDE.md`

**Step 1: Add visualize command**

Add to Commands section in CLAUDE.md:

```markdown
- `bun run visualize` - Start visualization server for simulation analysis
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add visualize command to CLAUDE.md"
```

---

## Summary

**Total tasks:** 10
**Parallel-safe tasks:** Tasks 5, 6, 7, 8 (chart components are independent)

**Dependencies:**
- Task 1 (JSON output) must complete before Tasks 5-8
- Task 2 (server) must complete before Task 3
- Task 3 (HTML/CSS) must complete before Task 4
- Task 4 (app entry) must complete before Tasks 5-8
- Task 9 (wiring) depends on Tasks 5-8
- Task 10 (docs) can run last
