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
let errorMessage: string | null = null;
let apiAvailable = false;
let availableLogs: string[] = [];

// DOM Elements
const app = document.getElementById("app")!;
const fileInputA = document.getElementById("file-input-a") as HTMLInputElement;
const fileInputB = document.getElementById("file-input-b") as HTMLInputElement;

/**
 * Check if the API server is available and fetch log list.
 */
async function checkApiAvailability(): Promise<void> {
  try {
    const response = await fetch("/api/logs", { method: "GET" });
    if (response.ok) {
      apiAvailable = true;
      availableLogs = await response.json();
    }
  } catch {
    // API not available (e.g., running as static site)
    apiAvailable = false;
    availableLogs = [];
  }
}

/**
 * Load analysis data from the server API.
 */
async function loadFromApi(filename: string): Promise<AnalysisOutput> {
  const response = await fetch(`/api/logs/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}`);
  }
  const data: unknown = await response.json();
  if (!validateAnalysisOutput(data)) {
    throw new Error("Invalid analysis file format");
  }
  return data;
}

/**
 * Handle selecting a file from the server list.
 */
async function handleServerFileSelect(filename: string, target: "a" | "b"): Promise<void> {
  try {
    const data = await loadFromApi(filename);
    if (target === "a") {
      batchA = data;
      fileNameA = filename;
    } else {
      batchB = data;
      fileNameB = filename;
    }
    render();
    if (currentPage === "charts") {
      renderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Validate that data matches the AnalysisOutput structure.
 */
function validateAnalysisOutput(data: unknown): data is AnalysisOutput {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.metadata !== "object" || obj.metadata === null) return false;
  if (typeof obj.summary !== "object" || obj.summary === null) return false;
  if (!Array.isArray(obj.victoryTimes)) return false;
  if (!Array.isArray(obj.peakPopulations)) return false;
  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.runs !== "number") return false;
  const summary = obj.summary as Record<string, unknown>;
  if (typeof summary.winRate !== "number") return false;
  if (typeof summary.victories !== "number") return false;
  if (typeof summary.defeats !== "number") return false;
  return true;
}

/**
 * Load and parse a JSON file.
 */
function loadFile(file: File): Promise<AnalysisOutput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const data: unknown = JSON.parse(text);
        if (!validateAnalysisOutput(data)) {
          reject(new Error("Invalid analysis file format"));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error("Failed to parse JSON file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Show an error toast message.
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
 * Handle file selection for Batch A.
 */
async function handleFileA(file: File): Promise<void> {
  try {
    batchA = await loadFile(file);
    fileNameA = file.name;
    render();
    if (currentPage === "charts") {
      renderCharts();
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : "Failed to load file");
  }
}

/**
 * Handle file selection for Batch B.
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
 * Set up drag and drop handlers for the entire document.
 */
function setupDragAndDrop(): void {
  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    isDragging = true;
    render();
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    // Only hide overlay if leaving the document
    if (e.relatedTarget === null) {
      isDragging = false;
      render();
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    isDragging = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      render();
      return;
    }

    const file = files[0];
    if (!file) {
      render();
      return;
    }
    if (!file.name.endsWith(".json")) {
      showError("Please drop a JSON file");
      return;
    }

    // Load as Batch A if empty, otherwise as Batch B
    if (!batchA) {
      await handleFileA(file);
    } else if (!batchB) {
      await handleFileB(file);
    } else {
      showError("Both batches already loaded. Clear one first.");
    }
  });
}

/**
 * Set up file input change handlers.
 */
function setupFileInputs(): void {
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

/**
 * Format filename for display.
 */
function formatFilename(filename: string): string {
  // simulation-2026-01-27T08-12-40-r200-s1.json -> 2026-01-27 08:12 (200 runs, seed 1)
  // Also supports legacy analysis- prefix
  const match = filename.match(/(?:simulation|analysis)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-\d{2}-r(\d+)-s(\d+)/);
  if (match) {
    const [, date, hour, minute, runs, seed] = match;
    return `${date} ${hour}:${minute} (${runs} runs, seed ${seed})`;
  }
  return filename;
}

/**
 * Render the drag overlay.
 */
function renderDragOverlay(): string {
  if (!isDragging) return "";
  return `
    <div class="drop-overlay">
      <div class="drop-overlay-content">
        <div class="drop-overlay-icon">📊</div>
        <div class="drop-overlay-text">Drop to load analysis</div>
      </div>
    </div>
  `;
}

/**
 * Render the error toast.
 */
function renderErrorToast(): string {
  if (!errorMessage) return "";
  return `
    <div class="error-toast">
      ${errorMessage}
    </div>
  `;
}

/**
 * Render the server file list.
 */
function renderServerFileList(): string {
  if (!apiAvailable || availableLogs.length === 0) return "";

  return `
    <div class="server-files">
      <h3>Recent Simulations</h3>
      <div class="file-list">
        ${availableLogs
          .slice(0, 10)
          .map(
            (file) => `
          <button class="file-list-item" data-file="${file}" data-target="a">
            ${formatFilename(file)}
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Render the empty state (no files loaded).
 */
function renderEmptyState(): string {
  return `
    <div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">📊</div>
      <div class="drop-zone-text">Drop simulation analysis JSON here</div>
      <div class="drop-zone-hint">or</div>
      <button class="browse-btn" id="browse-btn">Browse files</button>
      ${renderServerFileList()}
    </div>
  `;
}

/**
 * Render the loaded state (files loaded, show controls).
 */
function renderLoadedState(): string {
  return `
    <header class="header">
      <h1>Simulation Analysis Viewer</h1>
      <div class="batch-selectors">
        <div class="batch-selector">
          <label>Batch A:</label>
          <div class="file-info">
            <span class="file-info-name">${formatFilename(fileNameA)}</span>
            <button class="file-info-btn" id="clear-a" title="Clear">×</button>
          </div>
        </div>
        <div class="batch-selector">
          <label>Batch B (compare):</label>
          ${
            batchB
              ? `
            <div class="file-info">
              <span class="file-info-name">${formatFilename(fileNameB)}</span>
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
  // Navigation
  document.getElementById("nav-charts")?.addEventListener("click", () => switchPage("charts"));
  document.getElementById("nav-stats")?.addEventListener("click", () => switchPage("stats"));

  // Empty state browse button
  document.getElementById("browse-btn")?.addEventListener("click", () => {
    fileInputA?.click();
  });

  // Clear buttons
  document.getElementById("clear-a")?.addEventListener("click", () => {
    batchA = null;
    fileNameA = "";
    batchB = null;
    fileNameB = "";
    render();
  });

  document.getElementById("clear-b")?.addEventListener("click", () => {
    batchB = null;
    fileNameB = "";
    render();
    if (currentPage === "charts") {
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
function render(): void {
  app.innerHTML = `
    ${renderDragOverlay()}
    ${renderErrorToast()}
    ${batchA ? renderLoadedState() : renderEmptyState()}
  `;

  attachEventListeners();
}

/**
 * Render page navigation.
 */
function renderNavigation(): string {
  if (!batchA) return "";

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
      <h2>Resource Timelines</h2>
      ${batchB ? renderTimelineLegend() : ""}
      <div id="timeline" class="chart-container timeline-container"></div>
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

/**
 * Render technology research frequency.
 */
function renderTechFrequency(): string {
  if (!batchA) return "";

  const totalRuns = batchA.metadata.runs;
  const sorted = Object.entries(batchA.techFrequency).sort((a, b) => b[1] - a[1]);

  return `
    <div class="chart-panel">
      <h2>Technology Research Frequency</h2>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Technology</th>
              <th>Researched</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            ${sorted
              .map(
                ([tech, count]) => `
              <tr>
                <td>${formatTechName(tech)}</td>
                <td>${count} / ${totalRuns}</td>
                <td>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(count / totalRuns) * 100}%"></div>
                    <span class="progress-label">${Math.round((count / totalRuns) * 100)}%</span>
                  </div>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render building construction stats.
 */
function renderBuildingStats(): string {
  if (!batchA) return "";

  const totalRuns = batchA.metadata.runs;
  const sorted = Object.entries(batchA.buildingCounts)
    .map(([name, total]) => [name, total / totalRuns] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  return `
    <div class="chart-panel">
      <h2>Building Construction (avg per game)</h2>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Building</th>
              <th>Average Count</th>
            </tr>
          </thead>
          <tbody>
            ${sorted
              .map(
                ([building, avg]) => `
              <tr>
                <td>${formatBuildingName(building)}</td>
                <td>${avg.toFixed(1)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render victory time distribution stats.
 */
function renderVictoryTimeStats(): string {
  if (!batchA?.stats?.victoryTimeStats) return "";

  const stats = batchA.stats.victoryTimeStats;
  const outliers = batchA.stats.outliers;

  return `
    <div class="chart-panel">
      <h2>Victory Time Distribution</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${stats.min}</div>
          <div class="stat-label">Min (sols)</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.median}</div>
          <div class="stat-label">Median (sols)</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${Math.round(stats.mean)}</div>
          <div class="stat-label">Mean (sols)</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.p90}</div>
          <div class="stat-label">P90 (sols)</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.p95}</div>
          <div class="stat-label">P95 (sols)</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.max}</div>
          <div class="stat-label">Max (sols)</div>
        </div>
      </div>
      <h3>Histogram</h3>
      <div class="histogram-text">
        ${stats.histogram
          .filter((b) => b.count > 0)
          .map(
            (bucket) => `
          <div class="histogram-row">
            <span class="histogram-range">${bucket.range}</span>
            <span class="histogram-bar">${"█".repeat(Math.ceil(bucket.count / 3))}</span>
            <span class="histogram-count">(${bucket.count})</span>
          </div>
        `,
          )
          .join("")}
      </div>
      ${
        outliers.count > 0
          ? `
        <h3>Outliers (victories > 550 sols)</h3>
        <p class="stat-note">
          ${outliers.count} / ${outliers.totalVictories} (${outliers.percentage.toFixed(1)}%) victories took longer than 550 sols.
          ${outliers.avgTime ? `Average time: ${Math.round(outliers.avgTime)} sols.` : ""}
        </p>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Render victory vs defeat comparison.
 */
function renderVictoryDefeatComparison(): string {
  if (!batchA?.stats?.victoryDefeatComparison) return "";

  const comp = batchA.stats.victoryDefeatComparison;

  return `
    <div class="chart-panel">
      <h2>Victory vs Defeat Comparison</h2>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Victory</th>
              <th>Defeat</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Avg Peak Population</td>
              <td class="positive">${comp.avgPeakPopVictory.toFixed(1)} colonists</td>
              <td class="negative">${comp.avgPeakPopDefeat.toFixed(1)} colonists</td>
            </tr>
            <tr>
              <td>Avg Tech Count</td>
              <td class="positive">${comp.avgTechCountVictory.toFixed(1)} techs</td>
              <td class="negative">${comp.avgTechCountDefeat.toFixed(1)} techs</td>
            </tr>
            <tr>
              <td>Avg Building Count</td>
              <td class="positive">${comp.avgBuildingCountVictory.toFixed(1)} buildings</td>
              <td class="negative">${comp.avgBuildingCountDefeat.toFixed(1)} buildings</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>First Building Timing (avg sol)</h3>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Building</th>
              <th>Victory</th>
              <th>Defeat</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(comp.firstBuildingTiming)
              .map(
                ([building, timing]) => `
              <tr>
                <td>${formatBuildingName(building)}</td>
                <td>${timing.victory !== null ? `${Math.round(timing.victory)} sols` : "N/A"}</td>
                <td>${timing.defeat !== null ? `${Math.round(timing.defeat)} sols` : "N/A"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${
        comp.defeatSolStats
          ? `
        <h3>Defeat Sol Distribution</h3>
        <p class="stat-note">
          Min: ${comp.defeatSolStats.min} sols | Median: ${comp.defeatSolStats.median} sols | Max: ${comp.defeatSolStats.max} sols
        </p>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Render correlation analysis.
 */
function renderCorrelations(): string {
  if (!batchA?.stats?.correlations) return "";

  const corr = batchA.stats.correlations;

  const formatCorr = (r: number, interpretation: string): string => {
    const strength =
      Math.abs(r) > 0.5
        ? "strong"
        : Math.abs(r) > 0.3
          ? "moderate"
          : Math.abs(r) > 0.1
            ? "weak"
            : "none";
    return `<span class="corr-${strength}">${r.toFixed(3)}</span> ${interpretation}`;
  };

  return `
    <div class="chart-panel">
      <h2>Correlation Analysis</h2>
      <p class="stat-note">Pearson correlation coefficient with victory outcome (1=win, 0=loss)</p>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Correlation (r)</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>First Farm Sol</td>
              <td>${formatCorr(corr.firstFarmSol, corr.firstFarmSol < -0.1 ? "(earlier = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.firstFarmSol)}</td>
            </tr>
            <tr>
              <td>Tech Count</td>
              <td>${formatCorr(corr.techCount, corr.techCount > 0.1 ? "(more = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.techCount)}</td>
            </tr>
            <tr>
              <td>Peak Population</td>
              <td>${formatCorr(corr.peakPopulation, corr.peakPopulation > 0.1 ? "(higher = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.peakPopulation)}</td>
            </tr>
            <tr>
              <td>Population at Sol 100</td>
              <td>${formatCorr(corr.populationAtSol100, corr.populationAtSol100 > 0.1 ? "(higher = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.populationAtSol100)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="stat-note legend">
        Strength: |r| > 0.5 = Strong, |r| > 0.3 = Moderate, |r| > 0.1 = Weak
      </p>
    </div>
  `;
}

/**
 * Get correlation strength description.
 */
function getCorrelationStrength(r: number): string {
  const abs = Math.abs(r);
  if (abs > 0.5) return "Strong";
  if (abs > 0.3) return "Moderate";
  if (abs > 0.1) return "Weak";
  return "None";
}

/**
 * Render bottleneck analysis.
 */
function renderBottlenecks(): string {
  if (!batchA?.stats?.bottlenecks) return "";

  const { topBlocks, categoryTotals } = batchA.stats.bottlenecks;
  const totalRuns = batchA.metadata.runs;

  if (topBlocks.length === 0) {
    return `
      <div class="chart-panel">
        <h2>Bottleneck Analysis</h2>
        <p class="stat-note">No blocked decisions recorded</p>
      </div>
    `;
  }

  return `
    <div class="chart-panel">
      <h2>Bottleneck Analysis</h2>
      <h3>Top Blocked Decisions</h3>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Decision</th>
              <th>Blocked Count</th>
              <th>Top Reason</th>
            </tr>
          </thead>
          <tbody>
            ${topBlocks
              .map(
                (block) => `
              <tr>
                <td><code>${block.key}</code></td>
                <td>${block.count} (${((block.count / totalRuns) * 100).toFixed(0)}%)</td>
                <td>${block.reason.substring(0, 40)}${block.reason.length > 40 ? "..." : ""}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <h3>Blocks by Category</h3>
      <div class="category-bars">
        ${Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([cat, total]) => `
          <div class="category-row">
            <span class="category-name">${cat}</span>
            <span class="category-count">${total}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

/**
 * Render event impact analysis.
 */
function renderEventImpact(): string {
  if (!batchA?.stats?.eventImpact) return "";

  const { events, baselineVictoryRate } = batchA.stats.eventImpact;

  if (events.length === 0) {
    return `
      <div class="chart-panel">
        <h2>Event Impact Analysis</h2>
        <p class="stat-note">No events recorded</p>
      </div>
    `;
  }

  return `
    <div class="chart-panel">
      <h2>Event Impact Analysis</h2>
      <p class="stat-note">Baseline victory rate: ${baselineVictoryRate.toFixed(0)}%</p>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Occurrences</th>
              <th>Victory Rate</th>
              <th>vs Baseline</th>
            </tr>
          </thead>
          <tbody>
            ${events
              .slice(0, 15)
              .map(
                (event) => `
              <tr>
                <td>${formatEventName(event.eventId)}</td>
                <td>${event.count}</td>
                <td>${event.victoryRate.toFixed(0)}%</td>
                <td class="${
                  event.diffFromBaseline > 0
                    ? "positive"
                    : event.diffFromBaseline < 0
                      ? "negative"
                      : ""
                }">
                  ${event.diffFromBaseline >= 0 ? "+" : ""}${event.diffFromBaseline.toFixed(0)}%
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Render crisis timeline analysis.
 */
function renderCrisisTimeline(): string {
  if (!batchA?.stats?.crisisTimeline) return "";

  const { byType, firstCrisisTiming } = batchA.stats.crisisTimeline;

  if (Object.keys(byType).length === 0) {
    return `
      <div class="chart-panel">
        <h2>Crisis Timeline Analysis</h2>
        <p class="stat-note">No crisis events recorded</p>
      </div>
    `;
  }

  return `
    <div class="chart-panel">
      <h2>Crisis Timeline Analysis</h2>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Crisis Type</th>
              <th>Total</th>
              <th>Warning</th>
              <th>Critical</th>
              <th>Warning Timing</th>
              <th>Critical Timing</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(byType)
              .map(
                ([type, data]) => `
              <tr>
                <td>${formatCrisisType(type)}</td>
                <td>${data.total}</td>
                <td>${data.warnings}</td>
                <td>${data.critical}</td>
                <td>${
                  data.warningMedianSol !== null
                    ? `Med: sol ${data.warningMedianSol} (${data.warningRange?.[0]}-${data.warningRange?.[1]})`
                    : "N/A"
                }</td>
                <td>${
                  data.criticalMedianSol !== null
                    ? `Med: sol ${data.criticalMedianSol} (${data.criticalRange?.[0]}-${data.criticalRange?.[1]})`
                    : "N/A"
                }</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${
        firstCrisisTiming
          ? `
        <h3>First Crisis Timing</h3>
        <p class="stat-note">
          Median: sol ${firstCrisisTiming.median} | Range: sol ${firstCrisisTiming.min} - ${firstCrisisTiming.max}
        </p>
      `
          : ""
      }
    </div>
  `;
}

/**
 * Format tech name for display.
 */
function formatTechName(tech: string): string {
  return tech
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format building name for display.
 */
function formatBuildingName(building: string): string {
  return building
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format event name for display.
 */
function formatEventName(eventId: string): string {
  return eventId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format crisis type for display.
 */
function formatCrisisType(type: string): string {
  const labels: Record<string, string> = {
    low_food: "Low Food",
    low_oxygen: "Low Oxygen",
    low_water: "Low Water",
    low_morale: "Low Morale",
    low_cohesion: "Low Cohesion",
    population_drop: "Population Drop",
  };
  return labels[type] ?? type;
}

/**
 * Render social cohesion analysis.
 */
function renderSocialCohesion(): string {
  if (!batchA?.stats?.socialCohesion) return "";

  const sc = batchA.stats.socialCohesion;

  const formatCorr = (r: number): string => {
    const strength =
      Math.abs(r) > 0.5
        ? "strong"
        : Math.abs(r) > 0.3
          ? "moderate"
          : Math.abs(r) > 0.1
            ? "weak"
            : "none";
    return `<span class="corr-${strength}">${r.toFixed(3)}</span>`;
  };

  return `
    <div class="chart-panel">
      <h2>Social Cohesion Analysis</h2>
      <p class="stat-note">Cohesion measures how well-connected the social network is (0-1 scale, displayed as %)</p>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${(sc.avgFinalCohesion * 100).toFixed(1)}%</div>
          <div class="stat-label">Avg Final Cohesion</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${(sc.minCohesion * 100).toFixed(1)}%</div>
          <div class="stat-label">Min Observed</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${(sc.maxCohesion * 100).toFixed(1)}%</div>
          <div class="stat-label">Max Observed</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${sc.avgIsolatedColonists.toFixed(1)}</div>
          <div class="stat-label">Avg Isolated Colonists</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${sc.lowCohesionRuns}</div>
          <div class="stat-label">Runs with Low Cohesion</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatCorr(sc.cohesionVictoryCorrelation)}</div>
          <div class="stat-label">Victory Correlation</div>
        </div>
      </div>
      <p class="stat-note">
        ${sc.cohesionVictoryCorrelation > 0.1 ? "Higher cohesion is associated with more victories." : sc.cohesionVictoryCorrelation < -0.1 ? "Lower cohesion is associated with more victories (unexpected)." : "Cohesion has weak correlation with victory outcome."}
      </p>
    </div>
  `;
}

/**
 * Render summary cards.
 */
function renderSummary(): string {
  if (!batchA) return "";

  const { summary, victoryTimes, peakPopulations } = batchA;
  const avgVictoryTime =
    victoryTimes.length > 0
      ? Math.round(victoryTimes.reduce((a, b) => a + b, 0) / victoryTimes.length)
      : 0;
  const avgPeakPop = Math.round(
    peakPopulations.reduce((a, b) => a + b, 0) / peakPopulations.length,
  );

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
 * Render legend for resource timeline (line style indicates batch).
 */
function renderTimelineLegend(): string {
  return `
    <div class="legend">
      <div class="legend-item">
        <span class="legend-line solid"></span>
        <span>Batch A (solid)</span>
      </div>
      <div class="legend-item">
        <span class="legend-line dashed"></span>
        <span>Batch B (dashed)</span>
      </div>
    </div>
  `;
}

/**
 * Render comparison summary.
 */
function renderComparison(): string {
  if (!batchA || !batchB) return "";

  const winRateA = Math.round(batchA.summary.winRate * 100);
  const winRateB = Math.round(batchB.summary.winRate * 100);
  const winRateDiff = (batchB.summary.winRate - batchA.summary.winRate) * 100;
  const avgTimeA =
    batchA.victoryTimes.length > 0
      ? batchA.victoryTimes.reduce((a, b) => a + b, 0) / batchA.victoryTimes.length
      : 0;
  const avgTimeB =
    batchB.victoryTimes.length > 0
      ? batchB.victoryTimes.reduce((a, b) => a + b, 0) / batchB.victoryTimes.length
      : 0;
  const timeDiff = avgTimeB - avgTimeA;

  return `
    <div class="chart-panel">
      <h2>Comparison: B vs A</h2>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="value" style="color: ${
            winRateDiff >= 0 ? "var(--chart-positive)" : "var(--chart-negative)"
          }">
            ${winRateDiff >= 0 ? "+" : ""}${winRateDiff.toFixed(1)}%
          </div>
          <div class="label">Win Rate (B: ${winRateB}% vs A: ${winRateA}%)</div>
        </div>
        <div class="summary-card">
          <div class="value" style="color: ${
            timeDiff <= 0 ? "var(--chart-positive)" : "var(--chart-negative)"
          }">
            ${timeDiff >= 0 ? "+" : ""}${Math.round(timeDiff)} sols
          </div>
          <div class="label">Avg Victory Time (B: ${Math.round(avgTimeB)} vs A: ${Math.round(avgTimeA)})</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render D3 charts.
 */
function renderCharts(): void {
  if (!batchA) return;

  // Charts will be rendered by separate modules
  import("./charts/histogram.ts").then((m) => m.renderHistogram("histogram", batchA!, batchB));
  import("./charts/timeline.ts").then((m) => m.renderTimeline("timeline", batchA!, batchB));
  import("./charts/heatmap.ts").then((m) => m.renderHeatmap("heatmap", batchA!, batchB));
  import("./charts/progression.ts").then((m) =>
    m.renderProgression("progression", batchA!, batchB),
  );
}

/**
 * Initialize the app.
 */
async function init(): Promise<void> {
  setupDragAndDrop();
  setupFileInputs();
  // Check API availability before first render
  await checkApiAvailability();
  render();
}

init();
