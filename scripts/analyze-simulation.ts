#!/usr/bin/env bun
// scripts/analyze-simulation.ts
// Detailed simulation analysis tool for extracting insights from Monte Carlo runs

import { GameAPI } from "../src/facade/GameAPI";
import { HeuristicStrategy } from "../src/simulation/HeuristicStrategy";
import type {
  SimulationConfig,
  RunResult,
  ResourceSnapshot,
  ResourceFlowSnapshot,
  CrisisPoint,
  BlockedDecision,
  EventOccurrence,
} from "../src/simulation/types";

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

/** Snapshot interval for resource tracking */
const SNAPSHOT_INTERVAL = 50;

/** Crisis detection thresholds */
const CRISIS_THRESHOLDS = {
  food: { warning: 30, critical: 10 },
  oxygen: { warning: 30, critical: 10 },
  water: { warning: 20, critical: 5 },
  morale: { warning: 40, critical: 25 },
} as const;

/**
 * Run a single game and return detailed results with enhanced tracking.
 */
function runSingleGame(seed: number): RunResult {
  const api = new GameAPI();
  const strategy = new HeuristicStrategy(api);

  let peakPopulation = api.colony.snapshot().population;
  const buildingsBuiltMap = new Map<string, number>();
  const techsResearchedSet = new Set<string>();

  // Enhanced tracking structures
  const resourceTimeline: ResourceSnapshot[] = [];
  const flowTimeline: ResourceFlowSnapshot[] = [];
  const crisisTimeline: CrisisPoint[] = [];
  const buildingFirstBuiltSol = new Map<string, number>();
  const techCompletedSol = new Map<string, number>();
  let previousPopulation = api.colony.snapshot().population;

  // Track initial buildings
  for (const building of api.buildings.snapshot().active) {
    const count = buildingsBuiltMap.get(building.definitionId) ?? 0;
    buildingsBuiltMap.set(building.definitionId, count + 1);
    if (!buildingFirstBuiltSol.has(building.definitionId)) {
      buildingFirstBuiltSol.set(building.definitionId, 0);
    }
  }

  let solsRun = 0;
  while (!api.game.isGameOver() && solsRun < 10000) {
    strategy.executeTick();
    api.game.advanceSol();
    solsRun++;

    const currentSol = api.game.currentSol();
    const colony = api.colony.snapshot();
    const resources = api.resources.snapshot();

    const currentPop = colony.population;
    if (currentPop > peakPopulation) peakPopulation = currentPop;

    // Track population drops as crisis events
    if (currentPop < previousPopulation) {
      const drop = previousPopulation - currentPop;
      if (drop >= 3) {
        crisisTimeline.push({
          sol: currentSol,
          type: "population_drop",
          severity: drop >= 5 ? "critical" : "warning",
          value: currentPop,
          threshold: previousPopulation,
        });
      }
    }
    previousPopulation = currentPop;

    // Detect and record crisis conditions
    detectCrisis(currentSol, resources.current, colony.morale, crisisTimeline);

    // Take periodic snapshots
    if (currentSol % SNAPSHOT_INTERVAL === 0) {
      resourceTimeline.push({
        sol: currentSol,
        food: resources.current.food,
        oxygen: resources.current.oxygen,
        water: resources.current.water,
        power: resources.current.power,
        materials: resources.current.materials,
        population: currentPop,
        morale: colony.morale,
        health: colony.health,
      });

      flowTimeline.push({
        sol: currentSol,
        netFood: (resources.production.food ?? 0) - (resources.consumption.food ?? 0),
        netOxygen: (resources.production.oxygen ?? 0) - (resources.consumption.oxygen ?? 0),
        netWater: (resources.production.water ?? 0) - (resources.consumption.water ?? 0),
        netPower: (resources.production.power ?? 0) - (resources.consumption.power ?? 0),
        netMaterials: (resources.production.materials ?? 0) - (resources.consumption.materials ?? 0),
      });
    }

    for (const tech of api.technology.snapshot().researched) {
      if (!techsResearchedSet.has(tech.id)) {
        techsResearchedSet.add(tech.id);
        techCompletedSol.set(tech.id, currentSol);
      }
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
      if (count > prevMax) {
        buildingsBuiltMap.set(defId, count);
        if (!buildingFirstBuiltSol.has(defId)) {
          buildingFirstBuiltSol.set(defId, currentSol);
        }
      }
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

  // Convert maps to records
  const buildingFirstBuiltSolRecord: Record<string, number> = {};
  for (const [defId, sol] of buildingFirstBuiltSol) {
    buildingFirstBuiltSolRecord[defId] = sol;
  }

  const techCompletedSolRecord: Record<string, number> = {};
  for (const [techId, sol] of techCompletedSol) {
    techCompletedSolRecord[techId] = sol;
  }

  // Capture resources at death if defeated
  let resourcesAtDeath: ResourceSnapshot | undefined;
  let defeatSol: number | undefined;
  if (outcome === "defeat") {
    defeatSol = finalSol;
    const resources = api.resources.snapshot();
    const colony = api.colony.snapshot();
    resourcesAtDeath = {
      sol: finalSol,
      food: resources.current.food,
      oxygen: resources.current.oxygen,
      water: resources.current.water,
      power: resources.current.power,
      materials: resources.current.materials,
      population: colony.population,
      morale: colony.morale,
      health: colony.health,
    };
  }

  // Get tracked data from strategy
  const blockedDecisions = strategy.getBlockedDecisions();
  const eventsOccurred = strategy.getEventsOccurred();

  return {
    seed,
    outcome,
    victoryType,
    defeatReason,
    finalSol,
    peakPopulation,
    techsResearched: Array.from(techsResearchedSet),
    buildingsBuilt: buildingsRecord,
    // Enhanced tracking
    resourceTimeline,
    flowTimeline,
    crisisTimeline,
    buildingFirstBuiltSol: Object.keys(buildingFirstBuiltSolRecord).length > 0
      ? buildingFirstBuiltSolRecord
      : undefined,
    techCompletedSol: Object.keys(techCompletedSolRecord).length > 0
      ? techCompletedSolRecord
      : undefined,
    defeatSol,
    resourcesAtDeath,
    blockedDecisions: blockedDecisions.length > 0 ? blockedDecisions : undefined,
    eventsOccurred: eventsOccurred.length > 0 ? eventsOccurred : undefined,
  };
}

/**
 * Detect crisis conditions and record them.
 */
function detectCrisis(
  sol: number,
  resources: { food: number; oxygen: number; water: number },
  morale: number,
  crisisTimeline: CrisisPoint[]
): void {
  const checkResource = (
    type: CrisisPoint["type"],
    value: number,
    thresholds: { warning: number; critical: number }
  ) => {
    let severity: CrisisPoint["severity"] | null = null;
    let threshold = 0;

    if (value <= thresholds.critical) {
      severity = "critical";
      threshold = thresholds.critical;
    } else if (value <= thresholds.warning) {
      severity = "warning";
      threshold = thresholds.warning;
    }

    if (severity) {
      // Only record if this is a new crisis or escalation
      const lastCrisis = crisisTimeline.filter((c) => c.type === type).pop();
      if (
        !lastCrisis ||
        lastCrisis.sol < sol - 10 ||
        (lastCrisis.severity === "warning" && severity === "critical")
      ) {
        crisisTimeline.push({ sol, type, severity, value, threshold });
      }
    }
  };

  checkResource("low_food", resources.food, CRISIS_THRESHOLDS.food);
  checkResource("low_oxygen", resources.oxygen, CRISIS_THRESHOLDS.oxygen);
  checkResource("low_water", resources.water, CRISIS_THRESHOLDS.water);
  checkResource("low_morale", morale, CRISIS_THRESHOLDS.morale);
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

  // === NEW ENHANCED ANALYSIS SECTIONS ===

  // 8. Victory vs Defeat Comparison
  analyzeVictoriesVsDefeats(results, victories, defeats);

  // 9. Correlation Analysis
  analyzeCorrelations(results);

  // 10. Bottleneck Analysis
  analyzeBottlenecks(results);

  // 11. Event Impact Analysis
  analyzeEventImpact(results);

  // 12. Crisis Timeline Analysis
  analyzeCrisisTimeline(results);

  console.log("\n" + "=".repeat(60));
}

/**
 * Calculate Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * (y[i] ?? 0), 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Compare victories vs defeats to identify winning patterns.
 */
function analyzeVictoriesVsDefeats(
  results: RunResult[],
  victories: RunResult[],
  defeats: RunResult[]
): void {
  console.log("\n[Victory vs Defeat Comparison]");
  console.log("-".repeat(40));

  if (victories.length === 0 || defeats.length === 0) {
    console.log("  Need both victories and defeats for comparison");
    return;
  }

  // Average peak population
  const avgPeakPopVictory = victories.reduce((a, r) => a + r.peakPopulation, 0) / victories.length;
  const avgPeakPopDefeat = defeats.reduce((a, r) => a + r.peakPopulation, 0) / defeats.length;

  // Average tech count
  const avgTechCountVictory =
    victories.reduce((a, r) => a + r.techsResearched.length, 0) / victories.length;
  const avgTechCountDefeat =
    defeats.reduce((a, r) => a + r.techsResearched.length, 0) / defeats.length;

  // Average building count
  const avgBuildingCountVictory =
    victories.reduce((a, r) => a + Object.values(r.buildingsBuilt).reduce((s, c) => s + c, 0), 0) /
    victories.length;
  const avgBuildingCountDefeat =
    defeats.reduce((a, r) => a + Object.values(r.buildingsBuilt).reduce((s, c) => s + c, 0), 0) /
    defeats.length;

  console.log("  Metric                   Victory    Defeat");
  console.log("  " + "-".repeat(45));
  console.log(`  Avg Peak Population      ${avgPeakPopVictory.toFixed(1).padStart(7)}    ${avgPeakPopDefeat.toFixed(1).padStart(6)}`);
  console.log(`  Avg Tech Count           ${avgTechCountVictory.toFixed(1).padStart(7)}    ${avgTechCountDefeat.toFixed(1).padStart(6)}`);
  console.log(`  Avg Building Count       ${avgBuildingCountVictory.toFixed(1).padStart(7)}    ${avgBuildingCountDefeat.toFixed(1).padStart(6)}`);

  // First building timing comparison
  const getFirstBuildingSol = (results: RunResult[], buildingId: string): number[] => {
    return results
      .filter((r) => r.buildingFirstBuiltSol?.[buildingId] !== undefined)
      .map((r) => r.buildingFirstBuiltSol?.[buildingId] ?? 0);
  };

  console.log("\n  First Building Timing (avg sol):");
  const buildings = ["basic_farm", "oxygen_generator", "solar_panel", "habitat"];
  for (const building of buildings) {
    const victoryTimes = getFirstBuildingSol(victories, building);
    const defeatTimes = getFirstBuildingSol(defeats, building);

    if (victoryTimes.length > 0 || defeatTimes.length > 0) {
      const avgVictory =
        victoryTimes.length > 0
          ? (victoryTimes.reduce((a, b) => a + b, 0) / victoryTimes.length).toFixed(0)
          : "N/A";
      const avgDefeat =
        defeatTimes.length > 0
          ? (defeatTimes.reduce((a, b) => a + b, 0) / defeatTimes.length).toFixed(0)
          : "N/A";
      console.log(`    ${building.padEnd(20)} ${avgVictory.padStart(7)}    ${avgDefeat.padStart(6)}`);
    }
  }

  // Defeat sol distribution
  if (defeats.length > 0) {
    const defeatSols = defeats.map((r) => r.defeatSol ?? r.finalSol);
    const sortedDefeatSols = [...defeatSols].sort((a, b) => a - b);
    const medianDefeatSol = sortedDefeatSols[Math.floor(sortedDefeatSols.length / 2)] ?? 0;

    console.log("\n  Defeat Sol Distribution:");
    console.log(`    Min: ${Math.min(...defeatSols)}`);
    console.log(`    Median: ${medianDefeatSol}`);
    console.log(`    Max: ${Math.max(...defeatSols)}`);
  }
}

/**
 * Analyze correlations between early game metrics and outcomes.
 */
function analyzeCorrelations(results: RunResult[]): void {
  console.log("\n[Correlation Analysis]");
  console.log("-".repeat(40));

  // Convert outcome to numeric (1 = victory, 0 = defeat)
  const outcomes = results.map((r) => (r.outcome === "victory" ? 1 : 0));

  // First farm sol correlation
  const firstFarmSols = results.map((r) => r.buildingFirstBuiltSol?.["basic_farm"] ?? 100);
  const farmCorr = pearsonCorrelation(firstFarmSols, outcomes);

  // Tech count correlation
  const techCounts = results.map((r) => r.techsResearched.length);
  const techCorr = pearsonCorrelation(techCounts, outcomes);

  // Peak population correlation
  const peakPops = results.map((r) => r.peakPopulation);
  const popCorr = pearsonCorrelation(peakPops, outcomes);

  // Population at sol 100 (from timeline)
  const popAt100 = results.map((r) => {
    const snapshot = r.resourceTimeline?.find((s) => s.sol === 100);
    return snapshot?.population ?? r.peakPopulation;
  });
  const pop100Corr = pearsonCorrelation(popAt100, outcomes);

  console.log("  Correlation with Victory (Pearson r):");
  console.log(`    First Farm Sol:        ${farmCorr.toFixed(3)} ${farmCorr < -0.1 ? "(earlier = better)" : ""}`);
  console.log(`    Tech Count:            ${techCorr.toFixed(3)} ${techCorr > 0.1 ? "(more = better)" : ""}`);
  console.log(`    Peak Population:       ${popCorr.toFixed(3)} ${popCorr > 0.1 ? "(higher = better)" : ""}`);
  console.log(`    Population at Sol 100: ${pop100Corr.toFixed(3)} ${pop100Corr > 0.1 ? "(higher = better)" : ""}`);

  console.log("\n  Interpretation:");
  console.log("    |r| > 0.5: Strong correlation");
  console.log("    |r| > 0.3: Moderate correlation");
  console.log("    |r| > 0.1: Weak correlation");
}

/**
 * Analyze blocked decisions to identify bottlenecks.
 */
function analyzeBottlenecks(results: RunResult[]): void {
  console.log("\n[Bottleneck Analysis]");
  console.log("-".repeat(40));

  // Aggregate blocked decisions
  const blockCounts: Record<string, number> = {};
  const blockReasons: Record<string, Record<string, number>> = {};

  for (const result of results) {
    if (!result.blockedDecisions) continue;

    for (const blocked of result.blockedDecisions) {
      const key = `${blocked.category}:${blocked.action}`;
      blockCounts[key] = (blockCounts[key] ?? 0) + 1;

      if (!blockReasons[key]) blockReasons[key] = {};
      blockReasons[key][blocked.reason] = (blockReasons[key][blocked.reason] ?? 0) + 1;
    }
  }

  // Sort by frequency
  const sortedBlocks = Object.entries(blockCounts).sort((a, b) => b[1] - a[1]);

  if (sortedBlocks.length === 0) {
    console.log("  No blocked decisions recorded");
    return;
  }

  console.log("  Top 10 Most Frequent Blocks:");
  console.log("  " + "-".repeat(50));
  for (const [key, count] of sortedBlocks.slice(0, 10)) {
    const pct = ((count / results.length) * 100).toFixed(0);
    console.log(`    ${key.padEnd(35)} ${count} (${pct}%)`);

    // Show top reason for this block
    const reasons = blockReasons[key];
    if (reasons) {
      const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      if (topReason) {
        console.log(`      └─ Reason: ${topReason[0].substring(0, 40)}`);
      }
    }
  }

  // Resource bottleneck frequency
  console.log("\n  Bottleneck by Category:");
  const categoryTotals: Record<string, number> = {};
  for (const [key, count] of sortedBlocks) {
    const category = key.split(":")[0] ?? "unknown";
    categoryTotals[category] = (categoryTotals[category] ?? 0) + count;
  }
  for (const [category, total] of Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${category.padEnd(15)} ${total}`);
  }
}

/**
 * Analyze event impact on game outcomes.
 */
function analyzeEventImpact(results: RunResult[]): void {
  console.log("\n[Event Impact Analysis]");
  console.log("-".repeat(40));

  // Count events by type and track victory rate
  const eventStats: Record<string, { total: number; victories: number }> = {};

  for (const result of results) {
    if (!result.eventsOccurred) continue;

    const eventsSeen = new Set<string>();
    for (const event of result.eventsOccurred) {
      eventsSeen.add(event.eventId);
    }

    for (const eventId of eventsSeen) {
      if (!eventStats[eventId]) {
        eventStats[eventId] = { total: 0, victories: 0 };
      }
      eventStats[eventId].total++;
      if (result.outcome === "victory") {
        eventStats[eventId].victories++;
      }
    }
  }

  if (Object.keys(eventStats).length === 0) {
    console.log("  No events recorded");
    return;
  }

  // Sort by frequency
  const sortedEvents = Object.entries(eventStats).sort((a, b) => b[1].total - a[1].total);

  console.log("  Events by Frequency and Victory Rate:");
  console.log("  " + "-".repeat(55));
  console.log("  Event ID                  Count    Victory Rate");
  for (const [eventId, stats] of sortedEvents) {
    const victoryRate = stats.total > 0 ? (stats.victories / stats.total) * 100 : 0;
    const baseVictoryRate = (results.filter((r) => r.outcome === "victory").length / results.length) * 100;
    const diff = victoryRate - baseVictoryRate;
    const diffStr = diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`;
    console.log(
      `  ${eventId.padEnd(25)} ${stats.total.toString().padStart(5)}    ${victoryRate.toFixed(0)}% (${diffStr})`
    );
  }

  // Calculate baseline victory rate for reference
  const baseVictoryRate =
    (results.filter((r) => r.outcome === "victory").length / results.length) * 100;
  console.log(`\n  Baseline Victory Rate: ${baseVictoryRate.toFixed(0)}%`);
}

/**
 * Analyze crisis timeline to understand when problems occur.
 */
function analyzeCrisisTimeline(results: RunResult[]): void {
  console.log("\n[Crisis Timeline Analysis]");
  console.log("-".repeat(40));

  // Aggregate crisis points
  const crisisByType: Record<string, { warning: number[]; critical: number[] }> = {};

  for (const result of results) {
    if (!result.crisisTimeline) continue;

    for (const crisis of result.crisisTimeline) {
      let typeData = crisisByType[crisis.type];
      if (!typeData) {
        typeData = { warning: [], critical: [] };
        crisisByType[crisis.type] = typeData;
      }
      typeData[crisis.severity].push(crisis.sol);
    }
  }

  if (Object.keys(crisisByType).length === 0) {
    console.log("  No crisis events recorded");
    return;
  }

  console.log("  Crisis Events by Type:");
  console.log("  " + "-".repeat(55));

  for (const [type, data] of Object.entries(crisisByType)) {
    const totalWarnings = data.warning.length;
    const totalCritical = data.critical.length;
    const total = totalWarnings + totalCritical;

    if (total === 0) continue;

    console.log(`\n  ${type}:`);
    console.log(`    Total: ${total} events (${totalWarnings} warning, ${totalCritical} critical)`);

    if (data.warning.length > 0) {
      const sorted = [...data.warning].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      console.log(`    Warning - Median Sol: ${median}, Range: ${Math.min(...sorted)}-${Math.max(...sorted)}`);
    }

    if (data.critical.length > 0) {
      const sorted = [...data.critical].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      console.log(`    Critical - Median Sol: ${median}, Range: ${Math.min(...sorted)}-${Math.max(...sorted)}`);
    }
  }

  // When do crises typically start?
  const allCrisisSols: number[] = [];
  for (const result of results) {
    if (result.crisisTimeline && result.crisisTimeline.length > 0) {
      const firstCrisis = Math.min(...result.crisisTimeline.map((c) => c.sol));
      allCrisisSols.push(firstCrisis);
    }
  }

  if (allCrisisSols.length > 0) {
    const sorted = [...allCrisisSols].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    console.log("\n  First Crisis Timing:");
    console.log(`    Median: Sol ${median}`);
    console.log(`    Range: Sol ${Math.min(...sorted)} - ${Math.max(...sorted)}`);
  }
}

// Run main
main();
