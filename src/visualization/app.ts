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
