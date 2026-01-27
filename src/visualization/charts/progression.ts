// src/visualization/charts/progression.ts
// Tech/building progression horizontal bar chart

import * as d3 from "../d3"
import type { AnalysisOutput } from "../types"

export function renderProgression(
  containerId: string,
  batchA: AnalysisOutput,
  batchB: AnalysisOutput | null,
): void {
  const container = document.getElementById(containerId)
  if (!container) return

  container.innerHTML = ""

  const margin = { top: 20, right: 30, bottom: 40, left: 150 }
  const width = container.clientWidth - margin.left - margin.right
  const height = 300 - margin.top - margin.bottom

  // Calculate median first-built sol for each tech
  function getMedianTechSols(data: AnalysisOutput): Map<string, number> {
    const techSols = new Map<string, number[]>()

    for (const run of data.runs) {
      if (run.techCompletedSol) {
        for (const [tech, sol] of Object.entries(run.techCompletedSol)) {
          const existing = techSols.get(tech) ?? []
          existing.push(sol)
          techSols.set(tech, existing)
        }
      }
    }

    const medians = new Map<string, number>()
    for (const [tech, sols] of techSols) {
      sols.sort((a, b) => a - b)
      medians.set(tech, sols[Math.floor(sols.length / 2)] ?? 0)
    }
    return medians
  }

  const mediansA = getMedianTechSols(batchA)
  const mediansB = batchB ? getMedianTechSols(batchB) : null

  // Combine and sort by batch A timing
  const allTechs = new Set([...mediansA.keys(), ...(mediansB?.keys() ?? [])])
  const sortedTechs = Array.from(allTechs).sort(
    (a, b) => (mediansA.get(a) ?? 9999) - (mediansA.get(b) ?? 9999),
  )

  if (sortedTechs.length === 0) {
    container.innerHTML =
      '<div class="empty-state">No tech progression data</div>'
    return
  }

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  // Scales
  const maxSol = Math.max(
    d3.max(Array.from(mediansA.values())) ?? 0,
    mediansB ? (d3.max(Array.from(mediansB.values())) ?? 0) : 0,
  )

  const x = d3
    .scaleLinear()
    .domain([0, maxSol * 1.1])
    .range([0, width])
  const y = d3
    .scaleBand()
    .domain(sortedTechs)
    .range([0, height])
    .padding(mediansB ? 0.2 : 0.3)

  // Grid
  svg
    .append("g")
    .attr("class", "grid")
    .call(
      d3
        .axisTop(x)
        .tickSize(-height)
        .tickFormat(() => ""),
    )

  const barHeight = mediansB ? y.bandwidth() / 2 - 2 : y.bandwidth()

  // Batch A bars
  svg
    .selectAll(".bar-a")
    .data(sortedTechs.filter((t) => mediansA.has(t)))
    .join("rect")
    .attr("class", "bar-a")
    .attr("x", 0)
    .attr("y", (d) => y(d) ?? 0)
    .attr("width", (d) => x(mediansA.get(d) ?? 0))
    .attr("height", barHeight)
    .attr("rx", 2)

  // Batch B bars
  if (mediansB) {
    svg
      .selectAll(".bar-b")
      .data(sortedTechs.filter((t) => mediansB.has(t)))
      .join("rect")
      .attr("class", "bar-b")
      .attr("x", 0)
      .attr("y", (d) => (y(d) ?? 0) + barHeight + 4)
      .attr("width", (d) => x(mediansB.get(d) ?? 0))
      .attr("height", barHeight)
      .attr("rx", 2)
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
    .text("Median Sol Researched")

  // Y axis
  svg
    .append("g")
    .attr("class", "axis")
    .call(
      d3
        .axisLeft(y)
        .tickFormat((d) =>
          d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        ),
    )
}
