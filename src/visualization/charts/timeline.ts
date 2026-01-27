// src/visualization/charts/timeline.ts
// Resource timeline line chart using D3

import * as d3 from "../d3"
import type { AnalysisOutput, ResourceSnapshot } from "../types"

const RESOURCE_COLORS: Record<string, string> = {
  food: "#4caf50",
  oxygen: "#2196f3",
  water: "#00bcd4",
  power: "#ffc107",
  population: "#9c27b0",
  morale: "#ff5722",
}

export function renderTimeline(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null,
): void {
  const container = document.getElementById(containerId)
  if (!container) return

  container.innerHTML = ""

  const margin = { top: 20, right: 120, bottom: 40, left: 50 }
  const width = container.clientWidth - margin.left - margin.right
  const height = 350 - margin.top - margin.bottom

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  const timelineA = batchA.resourceTimeline
  const timelineB = batchB?.resourceTimeline ?? []

  if (timelineA.length === 0) {
    container.innerHTML = '<div class="empty-state">No timeline data</div>'
    return
  }

  // X scale (sols)
  const maxSol = Math.max(
    d3.max(timelineA, (d) => d.sol) ?? 0,
    d3.max(timelineB, (d) => d.sol) ?? 0,
  )
  const x = d3.scaleLinear().domain([0, maxSol]).range([0, width])

  // Y scale - calculate max from all displayed resources
  const resources: keyof ResourceSnapshot[] = [
    "food",
    "oxygen",
    "water",
    "population",
    "morale",
  ]
  let maxValue = 0
  for (const resource of resources) {
    const maxA = d3.max(timelineA, (d) => d[resource] as number) ?? 0
    const maxB = d3.max(timelineB, (d) => d[resource] as number) ?? 0
    maxValue = Math.max(maxValue, maxA, maxB)
  }
  // Add 10% padding to the top
  maxValue = Math.ceil(maxValue * 1.1)
  const y = d3.scaleLinear().domain([0, maxValue]).range([height, 0])

  // Grid
  svg
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisLeft(y)
        .tickSize(-width)
        .tickFormat(() => ""),
    )

  // Line generator
  const line = (key: keyof ResourceSnapshot) =>
    d3.line<ResourceSnapshot>()
      .x((d) => x(d.sol))
      .y((d) => y(d[key] as number))
      .curve(d3.curveMonotoneX)

  // Draw lines for each resource
  for (const resource of resources) {
    // Batch A - solid lines
    svg
      .append("path")
      .datum(timelineA)
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .style("stroke", RESOURCE_COLORS[resource])
      .attr("d", line(resource))

    // Batch B - dashed lines
    if (timelineB.length > 0) {
      svg
        .append("path")
        .datum(timelineB)
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .style("stroke", RESOURCE_COLORS[resource])
        .attr("d", line(resource))
    }
  }

  // X axis
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--g-color-text-muted)")
    .attr("font-size", "0.75rem")
    .text("Sol")

  // Y axis
  svg.append("g").attr("class", "axis").call(d3.axisLeft(y))

  // Legend
  const legend = svg
    .append("g")
    .attr("transform", `translate(${width + 10}, 0)`)

  resources.forEach((resource, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 20})`)

    g.append("line")
      .attr("x1", 0)
      .attr("x2", 20)
      .attr("y1", 10)
      .attr("y2", 10)
      .attr("stroke", RESOURCE_COLORS[resource])
      .attr("stroke-width", 2)

    g.append("text")
      .attr("x", 25)
      .attr("y", 14)
      .attr("fill", "var(--g-color-text)")
      .attr("font-size", "0.75rem")
      .text(resource.charAt(0).toUpperCase() + resource.slice(1))
  })
}
