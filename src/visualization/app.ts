// src/visualization/app.ts
// Main entry point for visualization app

import type { AnalysisOutput } from "./types";

// State
let logs: string[] = [];
let batchA: AnalysisOutput | null = null;
let batchB: AnalysisOutput | null = null;
let selectedFileA: string = "";
let selectedFileB: string = "";
let currentPage: "charts" | "stats" = "charts";

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
            ${logs.map((f) => `<option value="${f}"${f === selectedFileA ? " selected" : ""}>${formatFilename(f)}</option>`).join("")}
          </select>
        </div>
        <div class="batch-selector">
          <label>Batch B (compare):</label>
          <select id="select-b">
            <option value=""${selectedFileB === "" ? " selected" : ""}>None</option>
            ${logs.map((f) => `<option value="${f}"${f === selectedFileB ? " selected" : ""}>${formatFilename(f)}</option>`).join("")}
          </select>
        </div>
      </div>
    </header>
    ${renderNavigation()}
    <main class="charts-grid">
      ${currentPage === "charts" ? renderChartsContent() : renderStatsContent()}
    </main>
  `;

  // Attach event listeners
  document.getElementById("select-a")?.addEventListener("change", onSelectA);
  document.getElementById("select-b")?.addEventListener("change", onSelectB);
  document.getElementById("nav-charts")?.addEventListener("click", () => switchPage("charts"));
  document.getElementById("nav-stats")?.addEventListener("click", () => switchPage("stats"));
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
 * Handle batch A selection.
 */
async function onSelectA(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const filename = select.value;
  selectedFileA = filename;

  if (!filename) {
    batchA = null;
    render();
    return;
  }

  batchA = await fetchLog(filename);
  render();
  if (currentPage === "charts") {
    renderCharts();
  }
}

/**
 * Handle batch B selection.
 */
async function onSelectB(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const filename = select.value;
  selectedFileB = filename;

  if (!filename) {
    batchB = null;
    render();
    if (currentPage === "charts") {
      renderCharts();
    }
    return;
  }

  batchB = await fetchLog(filename);
  render();
  if (currentPage === "charts") {
    renderCharts();
  }
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
  import("./charts/progression.js").then((m) =>
    m.renderProgression("progression", batchA!, batchB),
  );
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
