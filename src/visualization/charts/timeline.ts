// src/visualization/charts/timeline.ts
// Resource timeline charts using D3 with percentile bands

import * as d3 from "../d3";
import type { AnalysisOutput, AggregatedSnapshot, PercentileValue } from "../types";

// Color definitions for each metric
const COLORS = {
  // Survival resources
  food: "#4caf50",
  oxygen: "#2196f3",
  water: "#00bcd4",
  power: "#ffc107",
  // Materials
  materials: "#795548",
  // Colony health
  morale: "#ff5722",
  cohesion: "#e91e63",
  // Population
  population: "#9c27b0",
};

// Display names for legend
const DISPLAY_NAMES: Record<string, string> = {
  food: "Food",
  oxygen: "Oxygen",
  water: "Water",
  power: "Power",
  materials: "Materials",
  morale: "Morale",
  cohesion: "Cohesion",
  population: "Population",
};

// Chart configuration
interface ChartConfig {
  title: string;
  metrics: Array<{
    key: string;
    accessor: (d: AggregatedSnapshot) => PercentileValue;
    color: string;
  }>;
  height: number;
  yDomain?: [number, number]; // Fixed domain, or auto-scale if undefined
  yFormat?: (value: number) => string;
}

// Define the four chart configurations
const CHART_CONFIGS: ChartConfig[] = [
  {
    title: "Survival Resources",
    height: 180,
    metrics: [
      { key: "food", accessor: (d) => d.food, color: COLORS.food },
      { key: "water", accessor: (d) => d.water, color: COLORS.water },
      { key: "power", accessor: (d) => d.power, color: COLORS.power },
    ],
  },
  {
    title: "Materials",
    height: 120,
    metrics: [{ key: "materials", accessor: (d) => d.materials, color: COLORS.materials }],
  },
  {
    title: "Colony Health",
    height: 120,
    yDomain: [0, 100],
    yFormat: (v) => `${v}%`,
    metrics: [
      {
        key: "morale",
        accessor: (d) => d.morale,
        color: COLORS.morale,
      },
      {
        key: "cohesion",
        accessor: (d) => ({
          median: d.socialCohesion.median * 100,
          p25: d.socialCohesion.p25 * 100,
          p75: d.socialCohesion.p75 * 100,
        }),
        color: COLORS.cohesion,
      },
    ],
  },
  {
    title: "Population",
    height: 120,
    metrics: [{ key: "population", accessor: (d) => d.population, color: COLORS.population }],
  },
];

/**
 * Render a single chart panel with percentile bands and median lines
 */
function renderChartPanel(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: ChartConfig,
  data: AggregatedSnapshot[],
  xScale: d3.ScaleLinear<number, number>,
  width: number,
  isLastChart: boolean,
): void {
  const margin = { top: 25, bottom: isLastChart ? 30 : 5 };
  const chartHeight = config.height - margin.top - margin.bottom;

  // Calculate Y domain
  let yDomain: [number, number];
  if (config.yDomain) {
    yDomain = config.yDomain;
  } else {
    // Auto-scale based on data max (using p75 for upper bound)
    let maxValue = 0;
    for (const metric of config.metrics) {
      const maxP75 = d3.max(data, (d) => metric.accessor(d).p75) ?? 0;
      maxValue = Math.max(maxValue, maxP75);
    }
    // Add 10% padding
    yDomain = [0, Math.ceil(maxValue * 1.1) || 100];
  }

  const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

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
      .area<AggregatedSnapshot>()
      .x((d) => xScale(d.sol))
      .y0((d) => yScale(safeValue(metric.accessor(d).p25)))
      .y1((d) => yScale(safeValue(metric.accessor(d).p75)))
      .curve(d3.curveMonotoneX);

  // Line generator for median
  const lineGenerator = (metric: (typeof config.metrics)[0]) =>
    d3
      .line<AggregatedSnapshot>()
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
 * Render legend for all metrics
 */
function renderLegend(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: number,
  y: number,
): void {
  const legend = container.append("g").attr("transform", `translate(${x},${y})`);

  // Group metrics by chart for legend organization
  const legendGroups = [
    { title: "Survival", metrics: ["food", "oxygen", "water", "power"] },
    { title: "Materials", metrics: ["materials"] },
    { title: "Colony", metrics: ["morale", "cohesion"] },
    { title: "Population", metrics: ["population"] },
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
      const displayName = DISPLAY_NAMES[metricKey];

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

    yOffset += 8; // Gap between groups
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

export function renderTimeline(
  containerId: string,
  batchA: AnalysisOutput,
  // TODO: Batch comparison not yet implemented for percentile charts
  _batchB: AnalysisOutput | null,
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  // Use aggregated timeline data
  const timeline = batchA.aggregatedTimeline;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = '<div class="empty-state">No aggregated timeline data</div>';
    return;
  }

  // Calculate dimensions
  const margin = { top: 10, right: 100, bottom: 10, left: 50 };
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
    const isLastChart = i === CHART_CONFIGS.length - 1;

    const chartGroup = svg.append("g").attr("transform", `translate(0,${yOffset})`);

    renderChartPanel(chartGroup, config, timeline, xScale, width, isLastChart);

    yOffset += config.height;
  }

  // Render legend to the right
  renderLegend(svg, width + 10, 10);
}
