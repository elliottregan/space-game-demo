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
