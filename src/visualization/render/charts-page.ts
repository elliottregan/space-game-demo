// src/visualization/render/charts-page.ts
// Charts page rendering functions

import { getBatchA, getBatchB } from "../state";

/**
 * Render charts page content.
 */
export function renderChartsContent(): string {
  const batchA = getBatchA();
  const batchB = getBatchB();

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
    <div class="chart-panel">
      <h2>Ideology Evolution</h2>
      <div id="ideology" class="chart-container timeline-container"></div>
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
  const batchA = getBatchA();
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
  const batchA = getBatchA();
  const batchB = getBatchB();
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
export function renderCharts(): void {
  const batchA = getBatchA();
  const batchB = getBatchB();
  if (!batchA) return;

  // Charts will be rendered by separate modules
  import("../charts/histogram.ts").then((m) => m.renderHistogram("histogram", batchA, batchB));
  import("../charts/timeline.ts").then((m) => m.renderTimeline("timeline", batchA, batchB));
  import("../charts/ideology.ts").then((m) => m.renderIdeologyTimeline("ideology", batchA, batchB));
  import("../charts/heatmap.ts").then((m) => m.renderHeatmap("heatmap", batchA, batchB));
  import("../charts/progression.ts").then((m) =>
    m.renderProgression("progression", batchA, batchB),
  );
}
