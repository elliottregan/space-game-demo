// src/visualization/charts/actions-histogram.ts
// Actions per sol distribution histogram using D3

import * as d3 from "../d3";
import type { AnalysisOutput } from "../types";

/**
 * Calculate actions per sol for each run.
 */
function calculateActionsPerSol(batch: AnalysisOutput): number[] {
  const actionsPerSolList: number[] = [];

  for (const result of batch.runs) {
    if (!result.actionsExecuted || result.actionsExecuted.length === 0) continue;

    // Count non-idle actions
    const nonIdleActions = result.actionsExecuted.filter((a) => a.category !== "idle");
    const finalSol = result.finalSol;

    if (finalSol > 0) {
      actionsPerSolList.push(nonIdleActions.length / finalSol);
    }
  }

  return actionsPerSolList;
}

export function renderActionsHistogram(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null,
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

  // Calculate actions per sol for both batches
  const actionsA = calculateActionsPerSol(batchA);
  const actionsB = batchB ? calculateActionsPerSol(batchB) : [];

  // Combine data to find domain
  const allActions = [...actionsA, ...actionsB];
  if (allActions.length === 0) {
    container.innerHTML = '<div class="empty-state">No action data</div>';
    return;
  }

  const maxActions = Math.max(...allActions, 1.0);
  const binWidth = 0.1;
  const bins = Math.ceil(maxActions / binWidth);

  // Create histogram bins
  const histogramA = d3
    .bin()
    .domain([0, bins * binWidth])
    .thresholds(bins)(actionsA);

  const histogramB =
    batchB && actionsB.length > 0
      ? d3
          .bin()
          .domain([0, bins * binWidth])
          .thresholds(bins)(actionsB)
      : null;

  // Scales
  const x = d3
    .scaleLinear()
    .domain([0, bins * binWidth])
    .range([0, width]);

  const maxCount = Math.max(
    d3.max(histogramA, (d) => d.length) ?? 0,
    histogramB ? (d3.max(histogramB, (d) => d.length) ?? 0) : 0,
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
        .tickFormat(() => ""),
    );

  // Bars
  const barWidth = histogramB ? (width / bins - 4) / 2 : width / bins - 2;

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
    .call(d3.axisBottom(x).tickFormat((d) => `${Number(d).toFixed(1)}`));

  // X axis label
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Actions per Sol");

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
