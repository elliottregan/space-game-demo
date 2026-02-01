// src/visualization/render/stats-page.ts
// Statistics page rendering functions

import {
  formatTechName,
  formatBuildingName,
  formatEventName,
  formatCrisisType,
  getCorrelationStrength,
} from "../formatters";
import { getBatchA } from "../state";

/**
 * Render stats page content.
 */
export function renderStatsContent(): string {
  const batchA = getBatchA();
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
  const batchA = getBatchA();
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
  const batchA = getBatchA();
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
  const batchA = getBatchA();
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
  const batchA = getBatchA();
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
 * Format correlation value with styling.
 */
function formatCorrelation(r: number, interpretation: string): string {
  const strength =
    Math.abs(r) > 0.5
      ? "strong"
      : Math.abs(r) > 0.3
        ? "moderate"
        : Math.abs(r) > 0.1
          ? "weak"
          : "none";
  return `<span class="corr-${strength}">${r.toFixed(3)}</span> ${interpretation}`;
}

/**
 * Render correlation analysis.
 */
function renderCorrelations(): string {
  const batchA = getBatchA();
  if (!batchA?.stats?.correlations) return "";

  const corr = batchA.stats.correlations;

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
              <td>${formatCorrelation(corr.firstFarmSol, corr.firstFarmSol < -0.1 ? "(earlier = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.firstFarmSol)}</td>
            </tr>
            <tr>
              <td>Tech Count</td>
              <td>${formatCorrelation(corr.techCount, corr.techCount > 0.1 ? "(more = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.techCount)}</td>
            </tr>
            <tr>
              <td>Peak Population</td>
              <td>${formatCorrelation(corr.peakPopulation, corr.peakPopulation > 0.1 ? "(higher = better)" : "")}</td>
              <td>${getCorrelationStrength(corr.peakPopulation)}</td>
            </tr>
            <tr>
              <td>Population at Sol 100</td>
              <td>${formatCorrelation(corr.populationAtSol100, corr.populationAtSol100 > 0.1 ? "(higher = better)" : "")}</td>
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
 * Render social cohesion analysis.
 */
function renderSocialCohesion(): string {
  const batchA = getBatchA();
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
 * Render bottleneck analysis.
 */
function renderBottlenecks(): string {
  const batchA = getBatchA();
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
  const batchA = getBatchA();
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
  const batchA = getBatchA();
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
