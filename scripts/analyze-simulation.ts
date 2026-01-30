#!/usr/bin/env bun
// scripts/analyze-simulation.ts
// Detailed simulation analysis tool for extracting insights from Monte Carlo runs

import { availableParallelism } from "node:os";
import { GameAPI } from "../src/facade/GameAPI";
import { HeuristicStrategy } from "../src/simulation/HeuristicStrategy";
import type { WorkerInput, WorkerOutput } from "../src/simulation/simulation.worker";
import type {
  SimulationConfig,
  RunResult,
  ResourceSnapshot,
  ResourceFlowSnapshot,
  CrisisPoint,
  BlockedDecision,
  EventOccurrence,
  AnalysisOutput,
  VictoryTimeStats,
  PeakPopulationStats,
  VictoryDefeatComparison,
  CorrelationAnalysis,
  BottleneckAnalysis,
  EventImpactAnalysis,
  CrisisTimelineAnalysis,
  OutlierAnalysis,
  SocialCohesionAnalysis,
  AggregatedSnapshot,
  PercentileValue,
} from "../src/simulation/types";

/**
 * Parse command line arguments.
 */
function parseArgs(): { runs: number; seed: number; quiet: boolean } {
  const args = process.argv.slice(2);
  const result = { runs: 200, seed: 1, quiet: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--runs" || arg === "-r") {
      const value = args[++i];
      if (value) result.runs = parseInt(value, 10);
    } else if (arg === "--seed" || arg === "-s") {
      const value = args[++i];
      if (value) result.seed = parseInt(value, 10);
    } else if (arg === "--quiet" || arg === "-q") {
      result.quiet = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Simulation Analysis Tool

Usage: bun run scripts/analyze-simulation.ts [options]

Options:
  --runs N, -r N    Number of simulation runs (default: 200)
  --seed N, -s N    Starting seed (default: 1)
  --quiet, -q       Suppress console output (logs still saved)
  --help, -h        Show this help message

Output:
  JSON and TXT analysis files are saved to logs/simulations/
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
  water: { warning: 20, critical: 5 },
  morale: { warning: 40, critical: 25 },
  cohesion: { warning: 0.15, critical: 0.08 },
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
  while (!api.game.isGameOver() && solsRun < 5000) {
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
    detectCrisis(
      currentSol,
      { food: resources.current.food, water: resources.current.water },
      colony.morale,
      crisisTimeline,
    );

    // Detect social cohesion crisis
    detectCohesionCrisis(currentSol, colony.socialCohesion, crisisTimeline);

    // Count isolated colonists
    const isolatedCount = colony.colonists.filter(
      (c) => !colony.coworkerRelationships.has(c.id),
    ).length;

    // Take periodic snapshots
    if (currentSol % SNAPSHOT_INTERVAL === 0) {
      resourceTimeline.push({
        sol: currentSol,
        food: resources.current.food,
        water: resources.current.water,
        power: resources.current.power,
        materials: resources.current.materials,
        population: currentPop,
        morale: colony.morale,
        health: colony.health,
        socialCohesion: colony.socialCohesion,
        isolatedColonists: isolatedCount,
      });

      flowTimeline.push({
        sol: currentSol,
        netFood: (resources.production.food ?? 0) - (resources.consumption.food ?? 0),
        netWater: (resources.production.water ?? 0) - (resources.consumption.water ?? 0),
        netPower: (resources.production.power ?? 0) - (resources.consumption.power ?? 0),
        netMaterials:
          (resources.production.materials ?? 0) - (resources.consumption.materials ?? 0),
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
    const isolatedCount = colony.colonists.filter(
      (c) => !colony.coworkerRelationships.has(c.id),
    ).length;
    resourcesAtDeath = {
      sol: finalSol,
      food: resources.current.food,
      water: resources.current.water,
      power: resources.current.power,
      materials: resources.current.materials,
      population: colony.population,
      morale: colony.morale,
      health: colony.health,
      socialCohesion: colony.socialCohesion,
      isolatedColonists: isolatedCount,
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
    buildingFirstBuiltSol:
      Object.keys(buildingFirstBuiltSolRecord).length > 0 ? buildingFirstBuiltSolRecord : undefined,
    techCompletedSol:
      Object.keys(techCompletedSolRecord).length > 0 ? techCompletedSolRecord : undefined,
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
  resources: { food: number; water: number },
  morale: number,
  crisisTimeline: CrisisPoint[],
): void {
  const checkResource = (
    type: CrisisPoint["type"],
    value: number,
    thresholds: { warning: number; critical: number },
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
  checkResource("low_water", resources.water, CRISIS_THRESHOLDS.water);
  checkResource("low_morale", morale, CRISIS_THRESHOLDS.morale);
}

/**
 * Detect social cohesion crisis conditions.
 */
function detectCohesionCrisis(sol: number, cohesion: number, crisisTimeline: CrisisPoint[]): void {
  let severity: CrisisPoint["severity"] | null = null;
  let threshold = 0;

  if (cohesion <= CRISIS_THRESHOLDS.cohesion.critical) {
    severity = "critical";
    threshold = CRISIS_THRESHOLDS.cohesion.critical;
  } else if (cohesion <= CRISIS_THRESHOLDS.cohesion.warning) {
    severity = "warning";
    threshold = CRISIS_THRESHOLDS.cohesion.warning;
  }

  if (severity) {
    const lastCrisis = crisisTimeline.filter((c) => c.type === "low_cohesion").pop();
    if (
      !lastCrisis ||
      lastCrisis.sol < sol - 10 ||
      (lastCrisis.severity === "warning" && severity === "critical")
    ) {
      crisisTimeline.push({
        sol,
        type: "low_cohesion",
        severity,
        value: cohesion,
        threshold,
      });
    }
  }
}

/**
 * Get the number of worker threads to use.
 */
function getWorkerCount(): number {
  const cpus = availableParallelism();
  return Math.max(1, cpus);
}

/**
 * Distribute seeds across workers as evenly as possible.
 */
function distributeSeedsToWorkers(seeds: number[], workerCount: number): number[][] {
  const batches: number[][] = Array.from({ length: workerCount }, () => []);
  for (let i = 0; i < seeds.length; i++) {
    batches[i % workerCount]!.push(seeds[i]!);
  }
  return batches.filter((batch) => batch.length > 0);
}

/**
 * Run simulations in parallel using worker threads.
 */
async function runSimulationsParallel(
  runs: number,
  seed: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<RunResult[]> {
  const workerCount = getWorkerCount();

  // Generate all seeds
  const seeds: number[] = [];
  for (let i = 0; i < runs; i++) {
    seeds.push(seed + i);
  }

  // For very small runs, use sequential execution
  if (runs <= 4 || workerCount === 1) {
    const results: RunResult[] = [];
    for (let i = 0; i < runs; i++) {
      results.push(runSingleGame(seed + i));
      if (onProgress && (i + 1) % 10 === 0) {
        onProgress(i + 1, runs);
      }
    }
    return results;
  }

  // Distribute seeds across workers
  const seedBatches = distributeSeedsToWorkers(seeds, workerCount);

  // Track progress across all workers
  const progressByWorker = new Map<number, { completed: number; total: number }>();

  // Create and run workers
  const workerPromises = seedBatches.map((batch, index) => {
    return new Promise<RunResult[]>((resolve, reject) => {
      const worker = new Worker(
        new URL("../src/simulation/simulation.worker.ts", import.meta.url).href,
      );

      worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
        const data = event.data;

        if (data.type === "progress" && onProgress) {
          progressByWorker.set(data.workerId!, {
            completed: data.completed!,
            total: data.total!,
          });

          // Calculate total progress
          let totalCompleted = 0;
          for (const progress of progressByWorker.values()) {
            totalCompleted += progress.completed;
          }

          onProgress(totalCompleted, runs);
        }

        if (data.type === "results") {
          worker.terminate();
          resolve(data.results!);
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };

      // Send work to worker
      const input: WorkerInput = {
        type: "run",
        seeds: batch,
        workerId: index,
      };
      worker.postMessage(input);
    });
  });

  // Wait for all workers to complete
  const resultBatches = await Promise.all(workerPromises);

  // Flatten results while preserving seed order
  const allResults = resultBatches.flat();
  allResults.sort((a, b) => a.seed - b.seed);

  return allResults;
}

// Module-level output capture for logging
const outputLines: string[] = [];
let quietMode = false;

/**
 * Output function that captures for file writing and optionally logs to console.
 */
function output(message: string = "", flush: boolean = false): void {
  outputLines.push(message);
  if (!quietMode) {
    if (flush) {
      // Use synchronous write for immediate output
      process.stdout.write(message + "\n");
    } else {
      console.log(message);
    }
  }
}

/**
 * Write analysis output to a text file in the logs directory.
 */
async function writeTextLog(runs: number, seed: number): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `analysis-${timestamp}-r${runs}-s${seed}.txt`;
  const filepath = `logs/simulations/${filename}`;

  await Bun.write(filepath, outputLines.join("\n"));
  return filepath;
}

/**
 * Compute victory time distribution stats.
 */
function computeVictoryTimeStats(victoryTimes: number[]): VictoryTimeStats | null {
  if (victoryTimes.length === 0) return null;

  const sorted = [...victoryTimes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const mean = victoryTimes.reduce((a, b) => a + b, 0) / victoryTimes.length;

  // Histogram buckets
  const buckets = [486, 490, 500, 550, 600, 700, 1000, 1500, 2000];
  const histogram: Array<{ range: string; count: number }> = [];
  let prevBucket = 0;
  for (const bucket of buckets) {
    const count = victoryTimes.filter((t) => t > prevBucket && t <= bucket).length;
    histogram.push({ range: `${prevBucket}-${bucket}`, count });
    prevBucket = bucket;
  }
  // Add overflow bucket
  const overflow = victoryTimes.filter((t) => t > prevBucket).length;
  if (overflow > 0) {
    histogram.push({ range: `${prevBucket}+`, count: overflow });
  }

  return {
    min: Math.min(...victoryTimes),
    median,
    mean,
    p90,
    p95,
    max: Math.max(...victoryTimes),
    histogram,
  };
}

/**
 * Compute peak population stats.
 */
function computePeakPopulationStats(peakPops: number[]): PeakPopulationStats {
  return {
    min: Math.min(...peakPops),
    mean: peakPops.reduce((a, b) => a + b, 0) / peakPops.length,
    max: Math.max(...peakPops),
  };
}

/**
 * Compute victory vs defeat comparison.
 */
function computeVictoryDefeatComparison(
  victories: RunResult[],
  defeats: RunResult[],
): VictoryDefeatComparison | null {
  if (victories.length === 0 || defeats.length === 0) return null;

  const avgPeakPopVictory = victories.reduce((a, r) => a + r.peakPopulation, 0) / victories.length;
  const avgPeakPopDefeat = defeats.reduce((a, r) => a + r.peakPopulation, 0) / defeats.length;

  const avgTechCountVictory =
    victories.reduce((a, r) => a + r.techsResearched.length, 0) / victories.length;
  const avgTechCountDefeat =
    defeats.reduce((a, r) => a + r.techsResearched.length, 0) / defeats.length;

  const avgBuildingCountVictory =
    victories.reduce((a, r) => a + Object.values(r.buildingsBuilt).reduce((s, c) => s + c, 0), 0) /
    victories.length;
  const avgBuildingCountDefeat =
    defeats.reduce((a, r) => a + Object.values(r.buildingsBuilt).reduce((s, c) => s + c, 0), 0) /
    defeats.length;

  // First building timing
  const buildings = ["basic_farm", "oxygen_generator", "solar_panel", "habitat"];
  const firstBuildingTiming: Record<
    string,
    {
      victory: number | null;
      defeat: number | null;
    }
  > = {};

  for (const building of buildings) {
    const victoryTimes = victories
      .filter((r) => r.buildingFirstBuiltSol?.[building] !== undefined)
      .map((r) => r.buildingFirstBuiltSol?.[building] ?? 0);
    const defeatTimes = defeats
      .filter((r) => r.buildingFirstBuiltSol?.[building] !== undefined)
      .map((r) => r.buildingFirstBuiltSol?.[building] ?? 0);

    firstBuildingTiming[building] = {
      victory:
        victoryTimes.length > 0
          ? victoryTimes.reduce((a, b) => a + b, 0) / victoryTimes.length
          : null,
      defeat:
        defeatTimes.length > 0 ? defeatTimes.reduce((a, b) => a + b, 0) / defeatTimes.length : null,
    };
  }

  // Defeat sol stats
  let defeatSolStats: { min: number; median: number; max: number } | null = null;
  if (defeats.length > 0) {
    const defeatSols = defeats.map((r) => r.defeatSol ?? r.finalSol);
    const sortedDefeatSols = [...defeatSols].sort((a, b) => a - b);
    defeatSolStats = {
      min: Math.min(...defeatSols),
      median: sortedDefeatSols[Math.floor(sortedDefeatSols.length / 2)] ?? 0,
      max: Math.max(...defeatSols),
    };
  }

  return {
    avgPeakPopVictory,
    avgPeakPopDefeat,
    avgTechCountVictory,
    avgTechCountDefeat,
    avgBuildingCountVictory,
    avgBuildingCountDefeat,
    firstBuildingTiming,
    defeatSolStats,
  };
}

/**
 * Compute correlation analysis.
 */
function computeCorrelations(results: RunResult[]): CorrelationAnalysis {
  const outcomes = results.map((r) => (r.outcome === "victory" ? 1 : 0));

  const firstFarmSols = results.map((r) => r.buildingFirstBuiltSol?.["basic_farm"] ?? 100);
  const techCounts = results.map((r) => r.techsResearched.length);
  const peakPops = results.map((r) => r.peakPopulation);
  const popAt100 = results.map((r) => {
    const snapshot = r.resourceTimeline?.find((s) => s.sol === 100);
    return snapshot?.population ?? r.peakPopulation;
  });

  return {
    firstFarmSol: pearsonCorrelation(firstFarmSols, outcomes),
    techCount: pearsonCorrelation(techCounts, outcomes),
    peakPopulation: pearsonCorrelation(peakPops, outcomes),
    populationAtSol100: pearsonCorrelation(popAt100, outcomes),
  };
}

/**
 * Compute bottleneck analysis.
 */
function computeBottlenecks(results: RunResult[]): BottleneckAnalysis {
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

  const sortedBlocks = Object.entries(blockCounts).sort((a, b) => b[1] - a[1]);
  const topBlocks = sortedBlocks.slice(0, 10).map(([key, count]) => {
    const reasons = blockReasons[key];
    const topReason = reasons
      ? (Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "")
      : "";
    return { key, count, reason: topReason };
  });

  const categoryTotals: Record<string, number> = {};
  for (const [key, count] of sortedBlocks) {
    const category = key.split(":")[0] ?? "unknown";
    categoryTotals[category] = (categoryTotals[category] ?? 0) + count;
  }

  return { topBlocks, categoryTotals };
}

/**
 * Compute event impact analysis.
 */
function computeEventImpact(results: RunResult[]): EventImpactAnalysis {
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

  const baselineVictoryRate =
    (results.filter((r) => r.outcome === "victory").length / results.length) * 100;

  const events = Object.entries(eventStats)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([eventId, stats]) => {
      const victoryRate = stats.total > 0 ? (stats.victories / stats.total) * 100 : 0;
      return {
        eventId,
        count: stats.total,
        victoryRate,
        diffFromBaseline: victoryRate - baselineVictoryRate,
      };
    });

  return { events, baselineVictoryRate };
}

/**
 * Compute crisis timeline analysis.
 */
function computeCrisisTimeline(results: RunResult[]): CrisisTimelineAnalysis {
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

  const byType: CrisisTimelineAnalysis["byType"] = {};
  for (const [type, data] of Object.entries(crisisByType)) {
    const sortedWarnings = [...data.warning].sort((a, b) => a - b);
    const sortedCritical = [...data.critical].sort((a, b) => a - b);

    byType[type] = {
      total: data.warning.length + data.critical.length,
      warnings: data.warning.length,
      critical: data.critical.length,
      warningMedianSol:
        sortedWarnings.length > 0
          ? (sortedWarnings[Math.floor(sortedWarnings.length / 2)] ?? null)
          : null,
      warningRange:
        sortedWarnings.length > 0
          ? [Math.min(...sortedWarnings), Math.max(...sortedWarnings)]
          : null,
      criticalMedianSol:
        sortedCritical.length > 0
          ? (sortedCritical[Math.floor(sortedCritical.length / 2)] ?? null)
          : null,
      criticalRange:
        sortedCritical.length > 0
          ? [Math.min(...sortedCritical), Math.max(...sortedCritical)]
          : null,
    };
  }

  // First crisis timing
  const allCrisisSols: number[] = [];
  for (const result of results) {
    if (result.crisisTimeline && result.crisisTimeline.length > 0) {
      const firstCrisis = Math.min(...result.crisisTimeline.map((c) => c.sol));
      allCrisisSols.push(firstCrisis);
    }
  }

  let firstCrisisTiming: { median: number; min: number; max: number } | null = null;
  if (allCrisisSols.length > 0) {
    const sorted = [...allCrisisSols].sort((a, b) => a - b);
    firstCrisisTiming = {
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      min: Math.min(...sorted),
      max: Math.max(...sorted),
    };
  }

  return { byType, firstCrisisTiming };
}

/**
 * Compute outlier analysis.
 */
function computeOutliers(victories: RunResult[]): OutlierAnalysis {
  const slowRuns = victories.filter((r) => r.finalSol > 550);
  return {
    count: slowRuns.length,
    totalVictories: victories.length,
    percentage: victories.length > 0 ? (slowRuns.length / victories.length) * 100 : 0,
    avgTime:
      slowRuns.length > 0 ? slowRuns.reduce((a, r) => a + r.finalSol, 0) / slowRuns.length : null,
  };
}

/**
 * Compute social cohesion analysis.
 */
function computeSocialCohesion(results: RunResult[]): SocialCohesionAnalysis {
  const victories = results.filter((r) => r.outcome === "victory");

  // Get final cohesion values from the last resource snapshot of each run
  const finalCohesions: number[] = [];
  const allCohesions: number[] = [];
  const finalIsolated: number[] = [];

  for (const result of results) {
    if (result.resourceTimeline && result.resourceTimeline.length > 0) {
      const lastSnapshot = result.resourceTimeline[result.resourceTimeline.length - 1];
      if (lastSnapshot) {
        finalCohesions.push(lastSnapshot.socialCohesion);
        finalIsolated.push(lastSnapshot.isolatedColonists);
      }
      // Collect all cohesion values for min/max
      for (const snapshot of result.resourceTimeline) {
        allCohesions.push(snapshot.socialCohesion);
      }
    }
  }

  // Count runs with low cohesion (ever dropped below critical)
  let lowCohesionRuns = 0;
  for (const result of results) {
    if (result.crisisTimeline) {
      const hasCohesionCrisis = result.crisisTimeline.some((c) => c.type === "low_cohesion");
      if (hasCohesionCrisis) lowCohesionRuns++;
    }
  }

  // Correlation between cohesion and victory
  const outcomes = results.map((r) => (r.outcome === "victory" ? 1 : 0));
  const cohesionVictoryCorrelation = pearsonCorrelation(finalCohesions, outcomes);

  return {
    avgFinalCohesion:
      finalCohesions.length > 0
        ? finalCohesions.reduce((a, b) => a + b, 0) / finalCohesions.length
        : 0,
    minCohesion: allCohesions.length > 0 ? Math.min(...allCohesions) : 0,
    maxCohesion: allCohesions.length > 0 ? Math.max(...allCohesions) : 0,
    avgIsolatedColonists:
      finalIsolated.length > 0
        ? finalIsolated.reduce((a, b) => a + b, 0) / finalIsolated.length
        : 0,
    lowCohesionRuns,
    cohesionVictoryCorrelation,
  };
}

/**
 * Calculate a percentile value from an array.
 * Uses linear interpolation between adjacent values.
 * Returns 0 for empty arrays.
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  // oxlint-disable-next-line no-non-null-assertion
  if (lower === upper) return sorted[lower]!;
  // oxlint-disable-next-line no-non-null-assertion
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
}

/**
 * Create a PercentileValue from an array of numbers.
 */
function computePercentileValue(values: number[]): PercentileValue {
  return {
    median: percentile(values, 50),
    p25: percentile(values, 25),
    p75: percentile(values, 75),
  };
}

/**
 * Aggregate resource timelines from multiple runs into percentile bands.
 * For each sol checkpoint, computes median and P25-P75 bands for each metric.
 * Only includes sols up to the slowest victory (or max defeat if no victories),
 * since games that timeout at the simulation limit aren't meaningful data.
 */
function aggregateTimelines(results: RunResult[]): AggregatedSnapshot[] {
  // Find the meaningful game range - use max victory time, or max defeat if no victories
  const victories = results.filter((r) => r.outcome === "victory");
  const maxVictorySol = victories.length > 0 ? Math.max(...victories.map((r) => r.finalSol)) : 0;
  const maxDefeatSol = Math.max(
    ...results.filter((r) => r.outcome === "defeat").map((r) => r.finalSol),
  );
  // Use max victory time if we have victories, otherwise fall back to max defeat time
  const timelineLimit = maxVictorySol > 0 ? maxVictorySol : maxDefeatSol;

  // Collect all timelines from results, limited to meaningful game range
  const timelinesBySol = new Map<number, ResourceSnapshot[]>();

  for (const result of results) {
    if (!result.resourceTimeline) continue;
    for (const snapshot of result.resourceTimeline) {
      // Only include snapshots within the meaningful game range
      if (snapshot.sol > timelineLimit) continue;
      const existing = timelinesBySol.get(snapshot.sol) ?? [];
      existing.push(snapshot);
      timelinesBySol.set(snapshot.sol, existing);
    }
  }

  // Find all unique sols and sort them
  const allSols = Array.from(timelinesBySol.keys()).sort((a, b) => a - b);

  // For each sol, compute percentiles for each metric
  const aggregated: AggregatedSnapshot[] = [];

  for (const sol of allSols) {
    const snapshots = timelinesBySol.get(sol);
    if (!snapshots || snapshots.length === 0) continue;

    aggregated.push({
      sol,
      food: computePercentileValue(snapshots.map((s) => s.food)),
      water: computePercentileValue(snapshots.map((s) => s.water)),
      power: computePercentileValue(snapshots.map((s) => s.power)),
      materials: computePercentileValue(snapshots.map((s) => s.materials)),
      population: computePercentileValue(snapshots.map((s) => s.population)),
      morale: computePercentileValue(snapshots.map((s) => s.morale)),
      socialCohesion: computePercentileValue(snapshots.map((s) => s.socialCohesion)),
      runsActive: snapshots.length,
    });
  }

  return aggregated;
}

/**
 * Write analysis data as JSON for visualization.
 */
async function writeJsonOutput(results: RunResult[], runs: number, seed: number): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `analysis-${timestamp}-r${runs}-s${seed}.json`;
  const filepath = `logs/simulations/${filename}`;

  const victories = results.filter((r) => r.outcome === "victory");
  const defeats = results.filter((r) => r.outcome === "defeat");

  // Aggregate tech frequency
  const techFrequency: Record<string, number> = {};
  for (const result of results) {
    for (const tech of result.techsResearched) {
      techFrequency[tech] = (techFrequency[tech] ?? 0) + 1;
    }
  }

  // Aggregate building counts
  const buildingCounts: Record<string, number> = {};
  for (const result of results) {
    for (const [building, count] of Object.entries(result.buildingsBuilt)) {
      buildingCounts[building] = (buildingCounts[building] ?? 0) + count;
    }
  }

  // Victory type breakdown
  const victoryTypes: Record<string, number> = {};
  for (const v of victories) {
    if (v.victoryType) {
      victoryTypes[v.victoryType] = (victoryTypes[v.victoryType] ?? 0) + 1;
    }
  }

  // Defeat reason breakdown
  const defeatReasons: Record<string, number> = {};
  for (const d of defeats) {
    if (d.defeatReason) {
      defeatReasons[d.defeatReason] = (defeatReasons[d.defeatReason] ?? 0) + 1;
    }
  }

  // Aggregate resource timeline (average across runs at each snapshot interval)
  const timelineBySOL = new Map<number, ResourceSnapshot[]>();
  for (const result of results) {
    if (!result.resourceTimeline) continue;
    for (const snapshot of result.resourceTimeline) {
      const existing = timelineBySOL.get(snapshot.sol) ?? [];
      existing.push(snapshot);
      timelineBySOL.set(snapshot.sol, existing);
    }
  }

  const resourceTimeline: ResourceSnapshot[] = [];
  for (const [sol, snapshots] of Array.from(timelineBySOL.entries()).sort((a, b) => a[0] - b[0])) {
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    resourceTimeline.push({
      sol,
      food: avg(snapshots.map((s) => s.food)),
      water: avg(snapshots.map((s) => s.water)),
      power: avg(snapshots.map((s) => s.power)),
      materials: avg(snapshots.map((s) => s.materials)),
      population: avg(snapshots.map((s) => s.population)),
      morale: avg(snapshots.map((s) => s.morale)),
      health: avg(snapshots.map((s) => s.health)),
      socialCohesion: avg(snapshots.map((s) => s.socialCohesion)),
      isolatedColonists: avg(snapshots.map((s) => s.isolatedColonists)),
    });
  }

  // Aggregate crisis events
  const crisisEvents: CrisisPoint[] = [];
  for (const result of results) {
    if (result.crisisTimeline) {
      crisisEvents.push(...result.crisisTimeline);
    }
  }

  // Compute extended stats
  const victoryTimes = victories.map((r) => r.finalSol);
  const peakPops = results.map((r) => r.peakPopulation);

  // Aggregate timelines with percentile bands
  const aggregatedTimeline = aggregateTimelines(results);

  const output: AnalysisOutput = {
    metadata: {
      timestamp: now.toISOString(),
      runs,
      seed,
    },
    summary: {
      winRate: victories.length / results.length,
      victories: victories.length,
      defeats: defeats.length,
      victoryTypes,
      defeatReasons,
    },
    victoryTimes,
    peakPopulations: peakPops,
    techFrequency,
    buildingCounts,
    resourceTimeline,
    aggregatedTimeline,
    crisisEvents,
    runs: results,
    stats: {
      victoryTimeStats: computeVictoryTimeStats(victoryTimes),
      peakPopulationStats: computePeakPopulationStats(peakPops),
      victoryDefeatComparison: computeVictoryDefeatComparison(victories, defeats),
      correlations: computeCorrelations(results),
      bottlenecks: computeBottlenecks(results),
      eventImpact: computeEventImpact(results),
      crisisTimeline: computeCrisisTimeline(results),
      outliers: computeOutliers(victories),
      socialCohesion: computeSocialCohesion(results),
    },
  };

  await Bun.write(filepath, JSON.stringify(output, null, 2));
  return filepath;
}

/**
 * Main analysis function.
 */
async function main(): Promise<void> {
  const { runs, seed, quiet } = parseArgs();

  if (quiet) {
    quietMode = true;
  }

  const workerCount = getWorkerCount();
  output(`Running ${runs} simulations for detailed analysis (seed: ${seed})...`);
  output(`Using ${workerCount} parallel workers`);
  output();

  let lastReportedProgress = 0;
  const results = await runSimulationsParallel(runs, seed, (completed, total) => {
    // Report progress every 50 runs
    if (completed - lastReportedProgress >= 50 || completed === total) {
      output(`  Progress: ${completed}/${total}`, true);
      lastReportedProgress = completed;
    }
  });

  // === ANALYSIS ===
  output("\n" + "=".repeat(60));
  output(`SIMULATION INSIGHTS ANALYSIS (${runs} runs)`);
  output("=".repeat(60));

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

    output("\n[Victory Time Distribution]");
    output("-".repeat(40));
    output(`  Min:    ${Math.min(...victoryTimes)} sols`);
    output(`  Median: ${median} sols`);
    output(`  Mean:   ${mean.toFixed(0)} sols`);
    output(`  P90:    ${p90} sols`);
    output(`  P95:    ${p95} sols`);
    output(`  Max:    ${Math.max(...victoryTimes)} sols`);

    // Histogram of victory times
    output("\n  Time Distribution Histogram:");
    const buckets = [486, 490, 500, 550, 600, 700, 1000];
    let prevBucket = 0;
    for (const bucket of buckets) {
      const count = victoryTimes.filter((t) => t > prevBucket && t <= bucket).length;
      const bar = "#".repeat(Math.ceil(count / 3));
      output(
        `  ${prevBucket.toString().padStart(4)}-${bucket.toString().padStart(4)}: ${bar} (${count})`,
      );
      prevBucket = bucket;
    }
  }

  // 2. Peak Population Analysis
  const peakPops = results.map((r) => r.peakPopulation);
  output("\n[Peak Population Analysis]");
  output("-".repeat(40));
  output(`  Min:  ${Math.min(...peakPops)}`);
  output(`  Mean: ${(peakPops.reduce((a, b) => a + b, 0) / peakPops.length).toFixed(1)}`);
  output(`  Max:  ${Math.max(...peakPops)}`);

  // 3. Technology Research Patterns
  output("\n[Technology Research Frequency]");
  output("-".repeat(40));
  const techCounts: Record<string, number> = {};
  for (const result of results) {
    for (const tech of result.techsResearched) {
      techCounts[tech] = (techCounts[tech] ?? 0) + 1;
    }
  }
  const sortedTechs = Object.entries(techCounts).sort((a, b) => b[1] - a[1]);
  for (const [tech, count] of sortedTechs) {
    const pct = ((count / results.length) * 100).toFixed(0);
    output(`  ${tech.padEnd(25)} ${pct}%`);
  }

  // 4. Building Construction Patterns
  output("\n[Building Construction (avg count per game)]");
  output("-".repeat(40));
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
    output(`  ${building.padEnd(20)} ${avg.toFixed(1)}`);
  }

  // 5. Outlier Analysis (slow victories)
  const slowRuns = results.filter((r) => r.outcome === "victory" && r.finalSol > 550);
  output("\n[Outlier Analysis (victories > 550 sols)]");
  output("-".repeat(40));
  output(
    `  Count: ${slowRuns.length} / ${victories.length} (${((slowRuns.length / Math.max(victories.length, 1)) * 100).toFixed(1)}%)`,
  );
  if (slowRuns.length > 0) {
    const avgSlowTime = slowRuns.reduce((a, r) => a + r.finalSol, 0) / slowRuns.length;
    output(`  Avg time: ${avgSlowTime.toFixed(0)} sols`);
    output(`  Likely cause: Random events disrupting morale/resources`);
  }

  // 6. Critical Path Analysis
  output("\n[Critical Path Analysis]");
  output("-".repeat(40));
  output("  Colony Charter requires:");
  output("    - hydroponics (60 sols)");
  output("    - water_recycling (45 sols)");
  output("    - advanced_materials (75 sols)");
  output("    = 180 sols minimum for tech");
  output("    + 300 sols sustained = 480 sols theoretical minimum");
  if (victoryTimes.length > 0) {
    output(`  Actual minimum achieved: ${Math.min(...victoryTimes)} sols`);
    output(`  Gap: ${Math.min(...victoryTimes) - 480} sols (setup/building time)`);
  }

  // 7. Overall Statistics
  output("\n[Overall Statistics]");
  output("-".repeat(40));
  output(`  Win Rate: ${((victories.length / results.length) * 100).toFixed(0)}%`);
  output(`  Victories: ${victories.length}`);
  output(`  Defeats: ${defeats.length}`);

  if (defeats.length > 0) {
    output("\n  Defeat Reasons:");
    const defeatCounts: Record<string, number> = {};
    for (const d of defeats) {
      if (d.defeatReason) {
        defeatCounts[d.defeatReason] = (defeatCounts[d.defeatReason] ?? 0) + 1;
      }
    }
    for (const [reason, count] of Object.entries(defeatCounts)) {
      output(`    - ${reason}: ${count}`);
    }
  }

  // Victory breakdown
  if (victories.length > 0) {
    output("\n  Victory Types:");
    const victoryCounts: Record<string, number> = {};
    for (const v of victories) {
      if (v.victoryType) {
        victoryCounts[v.victoryType] = (victoryCounts[v.victoryType] ?? 0) + 1;
      }
    }
    for (const [type, count] of Object.entries(victoryCounts)) {
      const pct = ((count / victories.length) * 100).toFixed(0);
      output(`    - ${type}: ${count} (${pct}%)`);
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

  // 13. Social Cohesion Analysis
  analyzeSocialCohesion(results);

  output("\n" + "=".repeat(60));

  // Write analysis logs
  const txtPath = await writeTextLog(runs, seed);
  const jsonPath = await writeJsonOutput(results, runs, seed);

  output(`\nAnalysis written to: ${txtPath}`);
  output(`JSON data written to: ${jsonPath}`);
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
  defeats: RunResult[],
): void {
  output("\n[Victory vs Defeat Comparison]");
  output("-".repeat(40));

  if (victories.length === 0 || defeats.length === 0) {
    output("  Need both victories and defeats for comparison");
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

  output("  Metric                   Victory    Defeat");
  output("  " + "-".repeat(45));
  output(
    `  Avg Peak Population      ${avgPeakPopVictory.toFixed(1).padStart(7)}    ${avgPeakPopDefeat.toFixed(1).padStart(6)}`,
  );
  output(
    `  Avg Tech Count           ${avgTechCountVictory.toFixed(1).padStart(7)}    ${avgTechCountDefeat.toFixed(1).padStart(6)}`,
  );
  output(
    `  Avg Building Count       ${avgBuildingCountVictory.toFixed(1).padStart(7)}    ${avgBuildingCountDefeat.toFixed(1).padStart(6)}`,
  );

  // First building timing comparison
  const getFirstBuildingSol = (results: RunResult[], buildingId: string): number[] => {
    return results
      .filter((r) => r.buildingFirstBuiltSol?.[buildingId] !== undefined)
      .map((r) => r.buildingFirstBuiltSol?.[buildingId] ?? 0);
  };

  output("\n  First Building Timing (avg sol):");
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
      output(`    ${building.padEnd(20)} ${avgVictory.padStart(7)}    ${avgDefeat.padStart(6)}`);
    }
  }

  // Defeat sol distribution
  if (defeats.length > 0) {
    const defeatSols = defeats.map((r) => r.defeatSol ?? r.finalSol);
    const sortedDefeatSols = [...defeatSols].sort((a, b) => a - b);
    const medianDefeatSol = sortedDefeatSols[Math.floor(sortedDefeatSols.length / 2)] ?? 0;

    output("\n  Defeat Sol Distribution:");
    output(`    Min: ${Math.min(...defeatSols)}`);
    output(`    Median: ${medianDefeatSol}`);
    output(`    Max: ${Math.max(...defeatSols)}`);
  }
}

/**
 * Analyze correlations between early game metrics and outcomes.
 */
function analyzeCorrelations(results: RunResult[]): void {
  output("\n[Correlation Analysis]");
  output("-".repeat(40));

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

  output("  Correlation with Victory (Pearson r):");
  output(
    `    First Farm Sol:        ${farmCorr.toFixed(3)} ${
      farmCorr < -0.1 ? "(earlier = better)" : ""
    }`,
  );
  output(
    `    Tech Count:            ${techCorr.toFixed(3)} ${techCorr > 0.1 ? "(more = better)" : ""}`,
  );
  output(
    `    Peak Population:       ${popCorr.toFixed(3)} ${popCorr > 0.1 ? "(higher = better)" : ""}`,
  );
  output(
    `    Population at Sol 100: ${pop100Corr.toFixed(3)} ${
      pop100Corr > 0.1 ? "(higher = better)" : ""
    }`,
  );

  output("\n  Interpretation:");
  output("    |r| > 0.5: Strong correlation");
  output("    |r| > 0.3: Moderate correlation");
  output("    |r| > 0.1: Weak correlation");
}

/**
 * Analyze blocked decisions to identify bottlenecks.
 */
function analyzeBottlenecks(results: RunResult[]): void {
  output("\n[Bottleneck Analysis]");
  output("-".repeat(40));

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
    output("  No blocked decisions recorded");
    return;
  }

  output("  Top 10 Most Frequent Blocks:");
  output("  " + "-".repeat(50));
  for (const [key, count] of sortedBlocks.slice(0, 10)) {
    const pct = ((count / results.length) * 100).toFixed(0);
    output(`    ${key.padEnd(35)} ${count} (${pct}%)`);

    // Show top reason for this block
    const reasons = blockReasons[key];
    if (reasons) {
      const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      if (topReason) {
        output(`      └─ Reason: ${topReason[0].substring(0, 40)}`);
      }
    }
  }

  // Resource bottleneck frequency
  output("\n  Bottleneck by Category:");
  const categoryTotals: Record<string, number> = {};
  for (const [key, count] of sortedBlocks) {
    const category = key.split(":")[0] ?? "unknown";
    categoryTotals[category] = (categoryTotals[category] ?? 0) + count;
  }
  for (const [category, total] of Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])) {
    output(`    ${category.padEnd(15)} ${total}`);
  }
}

/**
 * Analyze event impact on game outcomes.
 */
function analyzeEventImpact(results: RunResult[]): void {
  output("\n[Event Impact Analysis]");
  output("-".repeat(40));

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
    output("  No events recorded");
    return;
  }

  // Sort by frequency
  const sortedEvents = Object.entries(eventStats).sort((a, b) => b[1].total - a[1].total);

  output("  Events by Frequency and Victory Rate:");
  output("  " + "-".repeat(55));
  output("  Event ID                  Count    Victory Rate");
  for (const [eventId, stats] of sortedEvents) {
    const victoryRate = stats.total > 0 ? (stats.victories / stats.total) * 100 : 0;
    const baseVictoryRate =
      (results.filter((r) => r.outcome === "victory").length / results.length) * 100;
    const diff = victoryRate - baseVictoryRate;
    const diffStr = diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`;
    output(
      `  ${eventId.padEnd(25)} ${stats.total.toString().padStart(5)}    ${victoryRate.toFixed(0)}% (${diffStr})`,
    );
  }

  // Calculate baseline victory rate for reference
  const baseVictoryRate =
    (results.filter((r) => r.outcome === "victory").length / results.length) * 100;
  output(`\n  Baseline Victory Rate: ${baseVictoryRate.toFixed(0)}%`);
}

/**
 * Analyze crisis timeline to understand when problems occur.
 */
function analyzeCrisisTimeline(results: RunResult[]): void {
  output("\n[Crisis Timeline Analysis]");
  output("-".repeat(40));

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
    output("  No crisis events recorded");
    return;
  }

  output("  Crisis Events by Type:");
  output("  " + "-".repeat(55));

  for (const [type, data] of Object.entries(crisisByType)) {
    const totalWarnings = data.warning.length;
    const totalCritical = data.critical.length;
    const total = totalWarnings + totalCritical;

    if (total === 0) continue;

    output(`\n  ${type}:`);
    output(`    Total: ${total} events (${totalWarnings} warning, ${totalCritical} critical)`);

    if (data.warning.length > 0) {
      const sorted = [...data.warning].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      output(
        `    Warning - Median Sol: ${median}, Range: ${Math.min(...sorted)}-${Math.max(...sorted)}`,
      );
    }

    if (data.critical.length > 0) {
      const sorted = [...data.critical].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      output(
        `    Critical - Median Sol: ${median}, Range: ${Math.min(...sorted)}-${Math.max(...sorted)}`,
      );
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
    output("\n  First Crisis Timing:");
    output(`    Median: Sol ${median}`);
    output(`    Range: Sol ${Math.min(...sorted)} - ${Math.max(...sorted)}`);
  }
}

/**
 * Analyze social cohesion patterns across runs.
 */
function analyzeSocialCohesion(results: RunResult[]): void {
  output("\n[Social Cohesion Analysis]");
  output("-".repeat(40));

  const victories = results.filter((r) => r.outcome === "victory");
  const defeats = results.filter((r) => r.outcome === "defeat");

  // Get final cohesion values from the last resource snapshot
  const victoryCohesions: number[] = [];
  const defeatCohesions: number[] = [];
  const allCohesions: number[] = [];
  const finalIsolated: number[] = [];

  for (const result of results) {
    if (result.resourceTimeline && result.resourceTimeline.length > 0) {
      const lastSnapshot = result.resourceTimeline[result.resourceTimeline.length - 1];
      if (lastSnapshot) {
        if (result.outcome === "victory") {
          victoryCohesions.push(lastSnapshot.socialCohesion);
        } else {
          defeatCohesions.push(lastSnapshot.socialCohesion);
        }
        finalIsolated.push(lastSnapshot.isolatedColonists);
      }
      // Collect all cohesion values for min/max
      for (const snapshot of result.resourceTimeline) {
        allCohesions.push(snapshot.socialCohesion);
      }
    }
  }

  if (allCohesions.length === 0) {
    output("  No cohesion data available");
    return;
  }

  // Overall stats
  const avgCohesion = allCohesions.reduce((a, b) => a + b, 0) / allCohesions.length;
  output(`  Average Cohesion: ${avgCohesion.toFixed(3)}`);
  output(`  Min Cohesion: ${Math.min(...allCohesions).toFixed(3)}`);
  output(`  Max Cohesion: ${Math.max(...allCohesions).toFixed(3)}`);

  // Victory vs defeat comparison
  if (victoryCohesions.length > 0 && defeatCohesions.length > 0) {
    const avgVictoryCohesion =
      victoryCohesions.reduce((a, b) => a + b, 0) / victoryCohesions.length;
    const avgDefeatCohesion = defeatCohesions.reduce((a, b) => a + b, 0) / defeatCohesions.length;
    output("\n  Final Cohesion by Outcome:");
    output(`    Victory: ${avgVictoryCohesion.toFixed(3)}`);
    output(`    Defeat:  ${avgDefeatCohesion.toFixed(3)}`);
  }

  // Isolated colonists stats
  if (finalIsolated.length > 0) {
    const avgIsolated = finalIsolated.reduce((a, b) => a + b, 0) / finalIsolated.length;
    output(`\n  Avg Isolated Colonists at End: ${avgIsolated.toFixed(1)}`);
  }

  // Cohesion crisis stats
  let lowCohesionRuns = 0;
  let criticalCohesionRuns = 0;
  for (const result of results) {
    if (result.crisisTimeline) {
      const hasWarning = result.crisisTimeline.some(
        (c) => c.type === "low_cohesion" && c.severity === "warning",
      );
      const hasCritical = result.crisisTimeline.some(
        (c) => c.type === "low_cohesion" && c.severity === "critical",
      );
      if (hasWarning || hasCritical) lowCohesionRuns++;
      if (hasCritical) criticalCohesionRuns++;
    }
  }

  output(
    `\n  Runs with Low Cohesion: ${lowCohesionRuns}/${results.length} (${((lowCohesionRuns / results.length) * 100).toFixed(0)}%)`,
  );
  output(
    `  Runs with Critical Cohesion: ${criticalCohesionRuns}/${results.length} (${((criticalCohesionRuns / results.length) * 100).toFixed(0)}%)`,
  );

  // Correlation with victory
  const allFinalCohesions = [...victoryCohesions, ...defeatCohesions];
  const outcomes = [...victoryCohesions.map(() => 1), ...defeatCohesions.map(() => 0)];
  if (allFinalCohesions.length > 0) {
    const corr = pearsonCorrelation(allFinalCohesions, outcomes);
    output(`\n  Cohesion-Victory Correlation: ${corr.toFixed(3)}`);
  }
}

// Run main
main().catch(console.error);
