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

const CRISIS_DESCRIPTIONS: Record<string, string> = {
  low_food: "Food ≤30 (warning) or ≤10 (critical)",
  low_oxygen: "Oxygen ≤30 (warning) or ≤10 (critical)",
  low_water: "Water ≤20 (warning) or ≤5 (critical)",
  low_morale: "Morale ≤40 (warning) or ≤25 (critical)",
  population_drop: "Population drop ≥3 (warning) or ≥5 (critical)",
};

export function renderHeatmap(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null,
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  // Add crisis explanation legend
  const legend = document.createElement("div");
  legend.className = "heatmap-legend";
  legend.innerHTML = `
    <div class="heatmap-legend-title">Crisis Thresholds</div>
    <div class="heatmap-legend-items">
      ${CRISIS_TYPES.map(
        (type) => `
        <div class="heatmap-legend-item">
          <div class="heatmap-legend-label">${CRISIS_LABELS[type]}</div>
          <div class="heatmap-legend-desc">${CRISIS_DESCRIPTIONS[type]}</div>
        </div>
      `,
      ).join("")}
    </div>
  `;
  container.appendChild(legend);

  const chartContainer = document.createElement("div");
  container.appendChild(chartContainer);

  const margin = { top: 30, right: 30, bottom: 60, left: 80 };
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
      if (counts && counts[bin] !== undefined) {
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

  // Ensure minimum maxCount for color scaling
  maxCount = Math.max(maxCount, 1);

  // Render single heatmap or side-by-side
  if (!dataB) {
    renderSingleHeatmap(
      chartContainer,
      dataA,
      maxCount,
      margin,
      width,
      height,
      numBins,
      binWidth,
      "",
    );
  } else {
    const halfWidth = (width - 20) / 2;

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "20px";
    chartContainer.appendChild(wrapper);

    const containerA = document.createElement("div");
    containerA.style.flex = "1";
    wrapper.appendChild(containerA);

    const containerB = document.createElement("div");
    containerB.style.flex = "1";
    wrapper.appendChild(containerB);

    renderSingleHeatmap(
      containerA,
      dataA,
      maxCount,
      margin,
      halfWidth,
      height,
      numBins,
      binWidth,
      "Batch A",
    );
    renderSingleHeatmap(
      containerB,
      dataB,
      maxCount,
      margin,
      halfWidth,
      height,
      numBins,
      binWidth,
      "Batch B",
    );
  }

  // Add color legend
  addColorLegend(container, maxCount);
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
  title: string,
): void {
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title
  if (title) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--g-color-text-muted)")
      .attr("font-size", "0.75rem")
      .text(title);
  }

  // Scales
  const x = d3
    .scaleLinear()
    .domain([0, numBins * binWidth])
    .range([0, width]);
  const y = d3.scaleBand().domain(CRISIS_TYPES).range([0, height]).padding(0.1);

  // Custom color scale that works with dark theme
  // Uses a purple-to-red gradient that's visible on dark backgrounds
  const colorScale = (count: number): string => {
    if (count === 0) return "var(--g-color-bg-elevated)";
    const t = Math.min(count / maxCount, 1);
    // Interpolate from dim purple to bright red-orange
    const h = 280 - t * 250; // Hue: 280 (purple) -> 30 (orange-red)
    const s = 0.4 + t * 0.4; // Saturation: 40% -> 80%
    const l = 0.25 + t * 0.35; // Lightness: 25% -> 60%
    return `oklch(${l * 100}% ${s * 0.3} ${h})`;
  };

  // Cells
  const cellWidth = width / numBins;
  const cellHeight = y.bandwidth();

  for (const [type, counts] of data) {
    counts.forEach((count, bin) => {
      // Always render cells - empty ones get background color
      svg
        .append("rect")
        .attr("x", bin * cellWidth)
        .attr("y", y(type) ?? 0)
        .attr("width", cellWidth - 1)
        .attr("height", cellHeight)
        .attr("fill", colorScale(count))
        .attr("rx", 2)
        .attr("stroke", count > 0 ? "none" : "var(--g-color-border)")
        .attr("stroke-width", count > 0 ? 0 : 0.5);

      // Add tooltip for non-empty cells
      if (count > 0) {
        svg
          .append("title")
          .text(
            `${CRISIS_LABELS[type]}: ${count} events (sols ${bin * binWidth}-${(bin + 1) * binWidth})`,
          );
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
        .tickFormat((d) => `${d}`),
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

function addColorLegend(container: HTMLElement, maxCount: number): void {
  const legendDiv = document.createElement("div");
  legendDiv.className = "heatmap-color-legend";

  // Create gradient bar
  const gradientStops: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const h = 280 - t * 250;
    const s = 0.4 + t * 0.4;
    const l = 0.25 + t * 0.35;
    gradientStops.push(`oklch(${l * 100}% ${s * 0.3} ${h})`);
  }

  legendDiv.innerHTML = `
    <div class="heatmap-color-bar" style="background: linear-gradient(to right, ${gradientStops.join(", ")})"></div>
    <div class="heatmap-color-labels">
      <span>0</span>
      <span>Crisis Events</span>
      <span>${maxCount}</span>
    </div>
  `;
  container.appendChild(legendDiv);
}
