#!/usr/bin/env bun
// scripts/analyze-simulation.ts
// Detailed simulation analysis tool for extracting insights from Monte Carlo runs

import { GameAPI } from "../src/facade/GameAPI";
import { HeuristicStrategy } from "../src/simulation/HeuristicStrategy";
import type { SimulationConfig, RunResult } from "../src/simulation/types";

/**
 * Parse command line arguments.
 */
function parseArgs(): { runs: number; seed: number } {
  const args = process.argv.slice(2);
  const result = { runs: 200, seed: 1 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--runs" || arg === "-r") {
      const value = args[++i];
      if (value) result.runs = parseInt(value, 10);
    } else if (arg === "--seed" || arg === "-s") {
      const value = args[++i];
      if (value) result.seed = parseInt(value, 10);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Simulation Analysis Tool

Usage: bun run scripts/analyze-simulation.ts [options]

Options:
  --runs N, -r N    Number of simulation runs (default: 200)
  --seed N, -s N    Starting seed (default: 1)
  --help, -h        Show this help message
`);
      process.exit(0);
    }
  }

  return result;
}

/**
 * Run a single game and return detailed results.
 */
function runSingleGame(seed: number): RunResult {
  const api = new GameAPI();
  const strategy = new HeuristicStrategy(api);

  let peakPopulation = api.colony.snapshot().population;
  const buildingsBuiltMap = new Map<string, number>();
  const techsResearchedSet = new Set<string>();

  // Track initial buildings
  for (const building of api.buildings.snapshot().active) {
    const count = buildingsBuiltMap.get(building.definitionId) ?? 0;
    buildingsBuiltMap.set(building.definitionId, count + 1);
  }

  let solsRun = 0;
  while (!api.game.isGameOver() && solsRun < 10000) {
    strategy.executeTick();
    api.game.advanceSol();
    solsRun++;

    const currentPop = api.colony.snapshot().population;
    if (currentPop > peakPopulation) peakPopulation = currentPop;

    for (const tech of api.technology.snapshot().researched) {
      techsResearchedSet.add(tech.id);
    }

    const buildingSnapshot = api.buildings.snapshot();
    const allBuildings = [...buildingSnapshot.active, ...buildingSnapshot.pending];
    const currentCounts = new Map<string, number>();
    for (const building of allBuildings) {
      const count = currentCounts.get(building.definitionId) ?? 0;
      currentCounts.set(building.definitionId, count + 1);
    }
    for (const [defId, count] of currentCounts) {
      const prevMax = buildingsBuiltMap.get(defId) ?? 0;
      if (count > prevMax) buildingsBuiltMap.set(defId, count);
    }
  }

  const victoryState = api.game.victoryState();
  const finalSol = api.game.currentSol();
  const outcome = victoryState.status === "victory" ? "victory" : "defeat";

  let victoryType: "colony_charter" | "population" | "generation_ship" | undefined;
  let defeatReason: "starvation" | "suffocation" | "population_collapse" | undefined;

  if (outcome === "victory") {
    const reason = victoryState.reason?.toLowerCase() ?? "";
    if (reason.includes("colony charter")) victoryType = "colony_charter";
    else if (reason.includes("generation ship")) victoryType = "generation_ship";
    else victoryType = "population";
  } else {
    const reason = victoryState.reason?.toLowerCase() ?? "";
    if (reason.includes("food") || reason.includes("starv")) defeatReason = "starvation";
    else if (reason.includes("oxygen") || reason.includes("suffocat")) defeatReason = "suffocation";
    else defeatReason = "population_collapse";
  }

  const buildingsRecord: Record<string, number> = {};
  for (const [defId, count] of buildingsBuiltMap) {
    buildingsRecord[defId] = count;
  }

  return {
    seed,
    outcome,
    victoryType,
    defeatReason,
    finalSol,
    peakPopulation,
    techsResearched: Array.from(techsResearchedSet),
    buildingsBuilt: buildingsRecord,
  };
}

/**
 * Main analysis function.
 */
function main(): void {
  const { runs, seed } = parseArgs();

  console.log(`Running ${runs} simulations for detailed analysis (seed: ${seed})...\n`);

  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(runSingleGame(seed + i));
    if ((i + 1) % 50 === 0) {
      console.log(`  Progress: ${i + 1}/${runs}`);
    }
  }

  // === ANALYSIS ===
  console.log("\n" + "=".repeat(60));
  console.log(`SIMULATION INSIGHTS ANALYSIS (${runs} runs)`);
  console.log("=".repeat(60));

  // 1. Victory Time Distribution
  const victories = results.filter((r) => r.outcome === "victory");
  const defeats = results.filter((r) => r.outcome === "defeat");
  const victoryTimes = victories.map((r) => r.finalSol);
  const sortedTimes = [...victoryTimes].sort((a, b) => a - b);

  if (victoryTimes.length > 0) {
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)] ?? 0;
    const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)] ?? 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] ?? 0;
    const mean = victoryTimes.reduce((a, b) => a + b, 0) / victoryTimes.length;

    console.log("\n[Victory Time Distribution]");
    console.log("-".repeat(40));
    console.log(`  Min:    ${Math.min(...victoryTimes)} sols`);
    console.log(`  Median: ${median} sols`);
    console.log(`  Mean:   ${mean.toFixed(0)} sols`);
    console.log(`  P90:    ${p90} sols`);
    console.log(`  P95:    ${p95} sols`);
    console.log(`  Max:    ${Math.max(...victoryTimes)} sols`);

    // Histogram of victory times
    console.log("\n  Time Distribution Histogram:");
    const buckets = [486, 490, 500, 550, 600, 700, 1000];
    let prevBucket = 0;
    for (const bucket of buckets) {
      const count = victoryTimes.filter((t) => t > prevBucket && t <= bucket).length;
      const bar = "#".repeat(Math.ceil(count / 3));
      console.log(`  ${prevBucket.toString().padStart(4)}-${bucket.toString().padStart(4)}: ${bar} (${count})`);
      prevBucket = bucket;
    }
  }

  // 2. Peak Population Analysis
  const peakPops = results.map((r) => r.peakPopulation);
  console.log("\n[Peak Population Analysis]");
  console.log("-".repeat(40));
  console.log(`  Min:  ${Math.min(...peakPops)}`);
  console.log(`  Mean: ${(peakPops.reduce((a, b) => a + b, 0) / peakPops.length).toFixed(1)}`);
  console.log(`  Max:  ${Math.max(...peakPops)}`);

  // 3. Technology Research Patterns
  console.log("\n[Technology Research Frequency]");
  console.log("-".repeat(40));
  const techCounts: Record<string, number> = {};
  for (const result of results) {
    for (const tech of result.techsResearched) {
      techCounts[tech] = (techCounts[tech] ?? 0) + 1;
    }
  }
  const sortedTechs = Object.entries(techCounts).sort((a, b) => b[1] - a[1]);
  for (const [tech, count] of sortedTechs) {
    const pct = ((count / results.length) * 100).toFixed(0);
    console.log(`  ${tech.padEnd(25)} ${pct}%`);
  }

  // 4. Building Construction Patterns
  console.log("\n[Building Construction (avg count per game)]");
  console.log("-".repeat(40));
  const buildingTotals: Record<string, number> = {};
  for (const result of results) {
    for (const [building, count] of Object.entries(result.buildingsBuilt)) {
      buildingTotals[building] = (buildingTotals[building] ?? 0) + count;
    }
  }
  const sortedBuildings = Object.entries(buildingTotals)
    .map(([name, total]) => [name, total / results.length] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  for (const [building, avg] of sortedBuildings) {
    console.log(`  ${building.padEnd(20)} ${avg.toFixed(1)}`);
  }

  // 5. Outlier Analysis (slow victories)
  const slowRuns = results.filter((r) => r.outcome === "victory" && r.finalSol > 550);
  console.log("\n[Outlier Analysis (victories > 550 sols)]");
  console.log("-".repeat(40));
  console.log(`  Count: ${slowRuns.length} / ${victories.length} (${((slowRuns.length / Math.max(victories.length, 1)) * 100).toFixed(1)}%)`);
  if (slowRuns.length > 0) {
    const avgSlowTime = slowRuns.reduce((a, r) => a + r.finalSol, 0) / slowRuns.length;
    console.log(`  Avg time: ${avgSlowTime.toFixed(0)} sols`);
    console.log(`  Likely cause: Random events disrupting morale/resources`);
  }

  // 6. Critical Path Analysis
  console.log("\n[Critical Path Analysis]");
  console.log("-".repeat(40));
  console.log("  Colony Charter requires:");
  console.log("    - hydroponics (60 sols)");
  console.log("    - water_recycling (45 sols)");
  console.log("    - advanced_materials (75 sols)");
  console.log("    = 180 sols minimum for tech");
  console.log("    + 300 sols sustained = 480 sols theoretical minimum");
  if (victoryTimes.length > 0) {
    console.log(`  Actual minimum achieved: ${Math.min(...victoryTimes)} sols`);
    console.log(`  Gap: ${Math.min(...victoryTimes) - 480} sols (setup/building time)`);
  }

  // 7. Overall Statistics
  console.log("\n[Overall Statistics]");
  console.log("-".repeat(40));
  console.log(`  Win Rate: ${((victories.length / results.length) * 100).toFixed(0)}%`);
  console.log(`  Victories: ${victories.length}`);
  console.log(`  Defeats: ${defeats.length}`);

  if (defeats.length > 0) {
    console.log("\n  Defeat Reasons:");
    const defeatCounts: Record<string, number> = {};
    for (const d of defeats) {
      if (d.defeatReason) {
        defeatCounts[d.defeatReason] = (defeatCounts[d.defeatReason] ?? 0) + 1;
      }
    }
    for (const [reason, count] of Object.entries(defeatCounts)) {
      console.log(`    - ${reason}: ${count}`);
    }
  }

  // Victory breakdown
  if (victories.length > 0) {
    console.log("\n  Victory Types:");
    const victoryCounts: Record<string, number> = {};
    for (const v of victories) {
      if (v.victoryType) {
        victoryCounts[v.victoryType] = (victoryCounts[v.victoryType] ?? 0) + 1;
      }
    }
    for (const [type, count] of Object.entries(victoryCounts)) {
      const pct = ((count / victories.length) * 100).toFixed(0);
      console.log(`    - ${type}: ${count} (${pct}%)`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

// Run main
main();
