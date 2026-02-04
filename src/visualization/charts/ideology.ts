// src/visualization/charts/ideology.ts
// Ideology timeline chart using D3 with percentile bands

import * as d3 from "../d3";
import type { AnalysisOutput, AggregatedIdeologySnapshot, PercentileValue } from "../types";
import { FACTION_HEX_COLORS, FACTION_FULL_NAMES } from "../../renderer/utils/ideologyDisplay";

// Colors using the unified faction color model
const COLORS = {
  earthLoyalist: FACTION_HEX_COLORS.earth,
  marsIndependence: FACTION_HEX_COLORS.mars,
  corporateInterests: FACTION_HEX_COLORS.corporate,
  conviction: "#7b1fa2", // Purple (not a faction color)
  spread: "#78909c", // Blue-gray (not a faction color)
};

// Display names for legend using the unified model
const DISPLAY_NAMES: Record<string, string> = {
  earthLoyalist: FACTION_FULL_NAMES.earth,
  marsIndependence: FACTION_FULL_NAMES.mars,
  corporateInterests: FACTION_FULL_NAMES.corporate,
  conviction: "Avg Conviction",
  spread: "Ideology Spread",
};

interface ChartConfig {
  title: string;
  metrics: Array<{
    key: string;
    accessor: (d: AggregatedIdeologySnapshot) => PercentileValue;
    color: string;
  }>;
  height: number;
  yDomain: [number, number];
  yFormat?: (value: number) => string;
}

const CHART_CONFIGS: ChartConfig[] = [
  {
    title: "Faction Affinities (Colony Average)",
    height: 180,
    yDomain: [0, 1],
    yFormat: (v) => (v * 100).toFixed(0) + "%",
    metrics: [
      { key: "earthLoyalist", accessor: (d) => d.earthLoyalist, color: COLORS.earthLoyalist },
      {
        key: "marsIndependence",
        accessor: (d) => d.marsIndependence,
        color: COLORS.marsIndependence,
      },
      {
        key: "corporateInterests",
        accessor: (d) => d.corporateInterests,
        color: COLORS.corporateInterests,
      },
    ],
  },
  {
    title: "Ideology Diversity",
    height: 140,
    yDomain: [0, 1],
    yFormat: (v) => (v * 100).toFixed(0) + "%",
    metrics: [
      { key: "spread", accessor: (d) => d.ideologySpread, color: COLORS.spread },
      { key: "conviction", accessor: (d) => d.conviction, color: COLORS.conviction },
    ],
  },
  {
    title: "Colonists with Dominant Faction",
    height: 120,
    yDomain: [0, 1],
    yFormat: (v) => (v * 100).toFixed(0) + "%",
    metrics: [
      {
        key: "dominantPct",
        accessor: (d) => d.dominantFactionPct,
        color: "#5c6bc0",
      },
    ],
  },
];

/**
 * Render a single chart panel with percentile bands and median lines
 */
function renderChartPanel(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: ChartConfig,
  data: AggregatedIdeologySnapshot[],
  xScale: d3.ScaleLinear<number, number>,
  width: number,
  isLastChart: boolean,
): void {
  const margin = { top: 25, bottom: isLastChart ? 30 : 5 };
  const chartHeight = config.height - margin.top - margin.bottom;

  const yScale = d3.scaleLinear().domain(config.yDomain).range([chartHeight, 0]);

  // Chart title
  container
    .append("text")
    .attr("x", 0)
    .attr("y", 12)
    .attr("fill", "var(--g-color-text)")
    .attr("font-size", "0.75rem")
    .attr("font-weight", "600")
    .text(config.title);

  // Chart area group
  const chartArea = container.append("g").attr("transform", `translate(0,${margin.top})`);

  // Grid lines
  chartArea
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => ""),
    );

  // Helper to safely get a finite value
  const safeValue = (val: number): number => (Number.isFinite(val) ? val : 0);

  // Area generator for percentile bands
  const areaGenerator = (metric: (typeof config.metrics)[0]) =>
    d3
      .area<AggregatedIdeologySnapshot>()
      .x((d) => xScale(d.sol))
      .y0((d) => yScale(safeValue(metric.accessor(d).p25)))
      .y1((d) => yScale(safeValue(metric.accessor(d).p75)))
      .curve(d3.curveMonotoneX);

  // Line generator for median
  const lineGenerator = (metric: (typeof config.metrics)[0]) =>
    d3
      .line<AggregatedIdeologySnapshot>()
      .x((d) => xScale(d.sol))
      .y((d) => yScale(safeValue(metric.accessor(d).median)))
      .curve(d3.curveMonotoneX);

  // Draw each metric
  for (const metric of config.metrics) {
    // Percentile band (P25-P75)
    chartArea
      .append("path")
      .datum(data)
      .attr("fill", metric.color)
      .attr("fill-opacity", 0.2)
      .attr("stroke", "none")
      .attr("d", areaGenerator(metric));

    // Median line
    chartArea
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", metric.color)
      .attr("stroke-width", 2)
      .attr("d", lineGenerator(metric));
  }

  // Y axis
  const yAxis = d3.axisLeft(yScale).ticks(4);
  if (config.yFormat) {
    const formatter = config.yFormat;
    yAxis.tickFormat((d) => formatter(d as number));
  }
  chartArea.append("g").attr("class", "axis").call(yAxis);

  // X axis (only on last chart)
  if (isLastChart) {
    chartArea
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale));

    chartArea
      .append("text")
      .attr("x", width / 2)
      .attr("y", chartHeight + 25)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--g-color-text-muted)")
      .attr("font-size", "0.75rem")
      .text("Sol");
  }
}

/**
 * Render legend for ideology metrics
 */
function renderLegend(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: number,
  y: number,
): void {
  const legend = container.append("g").attr("transform", `translate(${x},${y})`);

  const legendGroups = [
    { title: "Factions", metrics: ["earthLoyalist", "marsIndependence", "corporateInterests"] },
    { title: "Diversity", metrics: ["spread", "conviction"] },
  ];

  let yOffset = 0;

  for (const group of legendGroups) {
    // Group title
    legend
      .append("text")
      .attr("x", 0)
      .attr("y", yOffset + 10)
      .attr("fill", "var(--g-color-text-muted)")
      .attr("font-size", "0.65rem")
      .attr("font-weight", "600")
      .text(group.title);
    yOffset += 18;

    // Metrics in group
    for (const metricKey of group.metrics) {
      const color = COLORS[metricKey as keyof typeof COLORS];
      const displayName = DISPLAY_NAMES[metricKey] ?? metricKey;

      const g = legend.append("g").attr("transform", `translate(0,${yOffset})`);

      // Color line
      g.append("line")
        .attr("x1", 0)
        .attr("x2", 16)
        .attr("y1", 6)
        .attr("y2", 6)
        .attr("stroke", color)
        .attr("stroke-width", 2);

      // Label
      g.append("text")
        .attr("x", 20)
        .attr("y", 10)
        .attr("fill", "var(--g-color-text)")
        .attr("font-size", "0.7rem")
        .text(displayName);

      yOffset += 16;
    }

    yOffset += 8;
  }

  // Add note about bands
  legend
    .append("text")
    .attr("x", 0)
    .attr("y", yOffset + 10)
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.6rem")
    .text("Bands: P25-P75");
}

export function renderIdeologyTimeline(
  containerId: string,
  batchA: AnalysisOutput,
  _batchB: AnalysisOutput | null,
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  const timeline = batchA.aggregatedIdeologyTimeline;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = '<div class="empty-state">No ideology timeline data</div>';
    return;
  }

  // Calculate dimensions
  const margin = { top: 10, right: 120, bottom: 10, left: 50 };
  const width = container.clientWidth - margin.left - margin.right;
  const totalHeight = CHART_CONFIGS.reduce((sum, c) => sum + c.height, 0) + 20;

  // Create main SVG
  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", totalHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Shared X scale
  const maxSol = d3.max(timeline, (d) => d.sol) ?? 0;
  const xScale = d3.scaleLinear().domain([0, maxSol]).range([0, width]);

  // Render each chart panel
  let yOffset = 0;
  for (let i = 0; i < CHART_CONFIGS.length; i++) {
    const config = CHART_CONFIGS[i];
    if (!config) continue;
    const isLastChart = i === CHART_CONFIGS.length - 1;

    const chartGroup = svg.append("g").attr("transform", `translate(0,${yOffset})`);

    renderChartPanel(chartGroup, config, timeline, xScale, width, isLastChart);

    yOffset += config.height;
  }

  // Render legend to the right
  renderLegend(svg, width + 10, 10);
}
