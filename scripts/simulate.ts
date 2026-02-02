#!/usr/bin/env bun
// scripts/simulate.ts
// Unified CLI for running Monte Carlo simulations with configurable output

import { availableParallelism } from "node:os";
import { GameAPI } from "../src/facade/GameAPI";
import { HeuristicStrategy } from "../src/simulation/HeuristicStrategy";
import type { WorkerInput, WorkerOutput } from "../src/simulation/simulation.worker";
import type {
  RunResult,
  ResourceSnapshot,
  ResourceFlowSnapshot,
  CrisisPoint,
  IdeologySnapshot,
  AggregatedIdeologySnapshot,
  IdeologyAnalysis,
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
import type { ColonistIdeology } from "../src/core/models/Colonist";

type LogLevel = "silent" | "default" | "verbose";

interface ParsedArgs {
  runs: number;
  seed: number;
  log: LogLevel;
  help: boolean;
}

/**
 * Parse command line arguments.
 */
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    runs: 100,
    seed: 1,
    log: "default",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--runs" || arg === "-r") {
      const value = args[++i];
      if (value === undefined || Number.isNaN(Number.parseInt(value, 10))) {
        console.error("Error: --runs requires a numeric argument");
        process.exit(1);
      }
      result.runs = Number.parseInt(value, 10);
      if (result.runs <= 0) {
        console.error("Error: --runs must be a positive number");
        process.exit(1);
      }
    } else if (arg === "--seed" || arg === "-s") {
      const value = args[++i];
      if (value === undefined || Number.isNaN(Number.parseInt(value, 10))) {
        console.error("Error: --seed requires a numeric argument");
        process.exit(1);
      }
      result.seed = Number.parseInt(value, 10);
    } else if (arg === "--log" || arg === "-l") {
      const value = args[++i];
      if (value !== "silent" && value !== "default" && value !== "verbose") {
        console.error("Error: --log must be one of: silent, default, verbose");
        process.exit(1);
      }
      result.log = value;
    } else if (arg?.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  return result;
}

/**
 * Print usage information.
 */
function printHelp(): void {
  console.log(`
Monte Carlo Simulation Runner for Space Colony Game

Usage: bun run simulate [options]

Options:
  --runs N, -r N     Number of simulation runs (default: 100)
  --seed N, -s N     Starting seed for reproducibility (default: 1)
  --log LEVEL, -l    Output level (default: default)
                       silent  - console only, no files
                       default - console + txt file
                       verbose - console + txt + json (large files)
  --help, -h         Show this help message

Examples:
  bun run simulate                      # 100 runs, txt output
  bun run simulate --runs 500           # 500 runs, txt output
  bun run simulate --runs 50 --log silent   # quick test, no files
  bun run simulate --runs 200 --log verbose # full analysis with json
`);
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
  const ideologyTimeline: IdeologySnapshot[] = [];
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
      const powerGrid = api.powerGrid.snapshot();
      resourceTimeline.push({
        sol: currentSol,
        food: resources.current.food,
        water: resources.current.water,
        powerGrid: powerGrid.gridStrain,
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
        netMaterials:
          (resources.production.materials ?? 0) - (resources.consumption.materials ?? 0),
      });

      // Capture ideology snapshot
      ideologyTimeline.push(captureIdeologySnapshot(currentSol, colony.colonists));
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

  let victoryType:
    | "return_mission"
    | "declaration_of_sovereignty"
    | "planetary_acquisition"
    | undefined;
  let defeatReason: "starvation" | "suffocation" | "population_collapse" | undefined;

  if (outcome === "victory") {
    const reason = victoryState.reason?.toLowerCase() ?? "";
    // Megastructure victories
    if (reason.includes("space elevator")) victoryType = "return_mission";
    else if (reason.includes("united mars station")) victoryType = "declaration_of_sovereignty";
    else if (reason.includes("generation ship")) victoryType = "planetary_acquisition";
    // Capstone project victories (legacy)
    else if (reason.includes("return mission")) victoryType = "return_mission";
    else if (reason.includes("declaration of sovereignty"))
      victoryType = "declaration_of_sovereignty";
    else if (reason.includes("planetary acquisition")) victoryType = "planetary_acquisition";
    else victoryType = "return_mission"; // Default fallback
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
      powerGrid: api.powerGrid.snapshot().gridStrain,
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
    ideologyTimeline: ideologyTimeline.length > 0 ? ideologyTimeline : undefined,
  };
}

/**
 * Capture ideology distribution snapshot at a given sol.
 */
function captureIdeologySnapshot(
  sol: number,
  colonists: Array<{ ideology?: ColonistIdeology }>,
): IdeologySnapshot {
  let sumEarth = 0;
  let sumMars = 0;
  let sumCorp = 0;
  let sumConviction = 0;
  let sumSpread = 0;
  let dominantCount = 0;
  let count = 0;

  for (const colonist of colonists) {
    if (!colonist.ideology) continue;

    const { earthLoyalist, marsIndependence, corporateInterests, conviction } = colonist.ideology;
    sumEarth += earthLoyalist;
    sumMars += marsIndependence;
    sumCorp += corporateInterests;
    sumConviction += conviction;

    // Calculate spread (max - min affinity)
    const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);
    const min = Math.min(earthLoyalist, marsIndependence, corporateInterests);
    sumSpread += max - min;

    // Check for dominant faction (threshold of 0.15 difference)
    const values = [earthLoyalist, marsIndependence, corporateInterests].sort((a, b) => b - a);
    if (values[0]! >= 0.3 && values[0]! - values[1]! >= 0.15) {
      dominantCount++;
    }

    count++;
  }

  return {
    sol,
    avgEarthLoyalist: count > 0 ? sumEarth / count : 0.33,
    avgMarsIndependence: count > 0 ? sumMars / count : 0.33,
    avgCorporateInterests: count > 0 ? sumCorp / count : 0.33,
    avgConviction: count > 0 ? sumConviction / count : 0,
    avgIdeologySpread: count > 0 ? sumSpread / count : 0,
    colonistsWithDominant: dominantCount,
    totalColonists: count,
    dominantFactionPct: count > 0 ? dominantCount / count : 0,
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

/**
 * Output function that captures for file writing and logs to console.
 */
function output(message: string = "", flush: boolean = false): void {
  outputLines.push(message);
  if (flush) {
    process.stdout.write(message + "\n");
  } else {
    console.log(message);
  }
}

/**
 * Write analysis output to a text file in the logs directory.
 */
async function writeTextLog(runs: number, seed: number): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `simulation-${timestamp}-r${runs}-s${seed}.txt`;
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
 */
function aggregateTimelines(results: RunResult[]): AggregatedSnapshot[] {
  // Find the meaningful game range - use max victory time, or max defeat if no victories
  const victories = results.filter((r) => r.outcome === "victory");
  const maxVictorySol = victories.length > 0 ? Math.max(...victories.map((r) => r.finalSol)) : 0;
  const maxDefeatSol = Math.max(
    ...results.filter((r) => r.outcome === "defeat").map((r) => r.finalSol),
  );
  const timelineLimit = maxVictorySol > 0 ? maxVictorySol : maxDefeatSol;

  // Collect all timelines from results, limited to meaningful game range
  const timelinesBySol = new Map<number, ResourceSnapshot[]>();

  for (const result of results) {
    if (!result.resourceTimeline) continue;
    for (const snapshot of result.resourceTimeline) {
      if (snapshot.sol > timelineLimit) continue;
      const existing = timelinesBySol.get(snapshot.sol) ?? [];
      existing.push(snapshot);
      timelinesBySol.set(snapshot.sol, existing);
    }
  }

  const allSols = Array.from(timelinesBySol.keys()).sort((a, b) => a - b);
  const aggregated: AggregatedSnapshot[] = [];

  for (const sol of allSols) {
    const snapshots = timelinesBySol.get(sol);
    if (!snapshots || snapshots.length === 0) continue;

    aggregated.push({
      sol,
      food: computePercentileValue(snapshots.map((s) => s.food)),
      water: computePercentileValue(snapshots.map((s) => s.water)),
      powerGrid: computePercentileValue(snapshots.map((s) => s.powerGrid)),
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
 * Aggregate ideology timelines from multiple runs into percentile bands.
 */
function aggregateIdeologyTimelines(results: RunResult[]): AggregatedIdeologySnapshot[] {
  // Find the meaningful game range
  const victories = results.filter((r) => r.outcome === "victory");
  const maxVictorySol = victories.length > 0 ? Math.max(...victories.map((r) => r.finalSol)) : 0;
  const maxDefeatSol = Math.max(
    ...results.filter((r) => r.outcome === "defeat").map((r) => r.finalSol),
  );
  const timelineLimit = maxVictorySol > 0 ? maxVictorySol : maxDefeatSol;

  // Collect all ideology snapshots by sol
  const timelinesBySol = new Map<number, IdeologySnapshot[]>();

  for (const result of results) {
    if (!result.ideologyTimeline) continue;
    for (const snapshot of result.ideologyTimeline) {
      if (snapshot.sol > timelineLimit) continue;
      const existing = timelinesBySol.get(snapshot.sol) ?? [];
      existing.push(snapshot);
      timelinesBySol.set(snapshot.sol, existing);
    }
  }

  const allSols = Array.from(timelinesBySol.keys()).sort((a, b) => a - b);
  const aggregated: AggregatedIdeologySnapshot[] = [];

  for (const sol of allSols) {
    const snapshots = timelinesBySol.get(sol);
    if (!snapshots || snapshots.length === 0) continue;

    aggregated.push({
      sol,
      earthLoyalist: computePercentileValue(snapshots.map((s) => s.avgEarthLoyalist)),
      marsIndependence: computePercentileValue(snapshots.map((s) => s.avgMarsIndependence)),
      corporateInterests: computePercentileValue(snapshots.map((s) => s.avgCorporateInterests)),
      conviction: computePercentileValue(snapshots.map((s) => s.avgConviction)),
      ideologySpread: computePercentileValue(snapshots.map((s) => s.avgIdeologySpread)),
      dominantFactionPct: computePercentileValue(snapshots.map((s) => s.dominantFactionPct)),
      runsActive: snapshots.length,
    });
  }

  return aggregated;
}

/**
 * Compute ideology analysis statistics.
 */
function computeIdeologyAnalysis(results: RunResult[]): IdeologyAnalysis {
  const initialSpreads: number[] = [];
  const finalSpreads: number[] = [];
  const initialDominantPcts: number[] = [];
  const finalDominantPcts: number[] = [];
  const initialConvictions: number[] = [];
  const finalConvictions: number[] = [];

  for (const result of results) {
    if (!result.ideologyTimeline || result.ideologyTimeline.length < 2) continue;

    const first = result.ideologyTimeline[0]!;
    const last = result.ideologyTimeline[result.ideologyTimeline.length - 1]!;

    initialSpreads.push(first.avgIdeologySpread);
    finalSpreads.push(last.avgIdeologySpread);
    initialDominantPcts.push(first.dominantFactionPct);
    finalDominantPcts.push(last.dominantFactionPct);
    initialConvictions.push(first.avgConviction);
    finalConvictions.push(last.avgConviction);
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const avgInitialSpread = avg(initialSpreads);
  const avgFinalSpread = avg(finalSpreads);

  // Convergence rate: how much ideology homogenized (0 = no change, 1 = fully converged)
  const convergenceRate =
    avgInitialSpread > 0 ? (avgInitialSpread - avgFinalSpread) / avgInitialSpread : 0;

  return {
    avgInitialSpread,
    avgFinalSpread,
    initialDominantPct: avg(initialDominantPcts) * 100,
    finalDominantPct: avg(finalDominantPcts) * 100,
    avgInitialConviction: avg(initialConvictions),
    avgFinalConviction: avg(finalConvictions),
    convergenceRate,
  };
}

/**
 * Write analysis data as gzipped JSON for visualization.
 */
async function writeJsonOutput(results: RunResult[], runs: number, seed: number): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `simulation-${timestamp}-r${runs}-s${seed}.json.gz`;
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
      powerGrid: avg(snapshots.map((s) => s.powerGrid)),
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
  const aggregatedIdeologyTimeline = aggregateIdeologyTimelines(results);

  const analysisOutput: AnalysisOutput = {
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
    aggregatedIdeologyTimeline,
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
      ideology: computeIdeologyAnalysis(results),
    },
  };

  const jsonData = JSON.stringify(analysisOutput);
  const compressed = Bun.gzipSync(jsonData);
  await Bun.write(filepath, compressed);
  return filepath;
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

  const outcomes = results.map((r) => (r.outcome === "victory" ? 1 : 0));

  const firstFarmSols = results.map((r) => r.buildingFirstBuiltSol?.["basic_farm"] ?? 100);
  const farmCorr = pearsonCorrelation(firstFarmSols, outcomes);

  const techCounts = results.map((r) => r.techsResearched.length);
  const techCorr = pearsonCorrelation(techCounts, outcomes);

  const peakPops = results.map((r) => r.peakPopulation);
  const popCorr = pearsonCorrelation(peakPops, outcomes);

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

  if (sortedBlocks.length === 0) {
    output("  No blocked decisions recorded");
    return;
  }

  output("  Top 10 Most Frequent Blocks:");
  output("  " + "-".repeat(50));
  for (const [key, count] of sortedBlocks.slice(0, 10)) {
    const pct = ((count / results.length) * 100).toFixed(0);
    output(`    ${key.padEnd(35)} ${count} (${pct}%)`);

    const reasons = blockReasons[key];
    if (reasons) {
      const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      if (topReason) {
        output(`      └─ Reason: ${topReason[0].substring(0, 40)}`);
      }
    }
  }

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
      for (const snapshot of result.resourceTimeline) {
        allCohesions.push(snapshot.socialCohesion);
      }
    }
  }

  if (allCohesions.length === 0) {
    output("  No cohesion data available");
    return;
  }

  const avgCohesion = allCohesions.reduce((a, b) => a + b, 0) / allCohesions.length;
  output(`  Average Cohesion: ${avgCohesion.toFixed(3)}`);
  output(`  Min Cohesion: ${Math.min(...allCohesions).toFixed(3)}`);
  output(`  Max Cohesion: ${Math.max(...allCohesions).toFixed(3)}`);

  if (victoryCohesions.length > 0 && defeatCohesions.length > 0) {
    const avgVictoryCohesion =
      victoryCohesions.reduce((a, b) => a + b, 0) / victoryCohesions.length;
    const avgDefeatCohesion = defeatCohesions.reduce((a, b) => a + b, 0) / defeatCohesions.length;
    output("\n  Final Cohesion by Outcome:");
    output(`    Victory: ${avgVictoryCohesion.toFixed(3)}`);
    output(`    Defeat:  ${avgDefeatCohesion.toFixed(3)}`);
  }

  if (finalIsolated.length > 0) {
    const avgIsolated = finalIsolated.reduce((a, b) => a + b, 0) / finalIsolated.length;
    output(`\n  Avg Isolated Colonists at End: ${avgIsolated.toFixed(1)}`);
  }

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

  const allFinalCohesions = [...victoryCohesions, ...defeatCohesions];
  const outcomes = [...victoryCohesions.map(() => 1), ...defeatCohesions.map(() => 0)];
  if (allFinalCohesions.length > 0) {
    const corr = pearsonCorrelation(allFinalCohesions, outcomes);
    output(`\n  Cohesion-Victory Correlation: ${corr.toFixed(3)}`);
  }
}

/**
 * Analyze ideology evolution across runs.
 */
function analyzeIdeology(results: RunResult[]): void {
  output("\n[Ideology Evolution Analysis]");
  output("-".repeat(40));

  const initialSpreads: number[] = [];
  const finalSpreads: number[] = [];
  const initialDominantPcts: number[] = [];
  const finalDominantPcts: number[] = [];
  const initialConvictions: number[] = [];
  const finalConvictions: number[] = [];

  for (const result of results) {
    if (!result.ideologyTimeline || result.ideologyTimeline.length < 2) continue;

    const first = result.ideologyTimeline[0]!;
    const last = result.ideologyTimeline[result.ideologyTimeline.length - 1]!;

    initialSpreads.push(first.avgIdeologySpread);
    finalSpreads.push(last.avgIdeologySpread);
    initialDominantPcts.push(first.dominantFactionPct * 100);
    finalDominantPcts.push(last.dominantFactionPct * 100);
    initialConvictions.push(first.avgConviction);
    finalConvictions.push(last.avgConviction);
  }

  if (initialSpreads.length === 0) {
    output("  No ideology data available");
    return;
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const avgInitialSpread = avg(initialSpreads);
  const avgFinalSpread = avg(finalSpreads);
  const avgInitialDominant = avg(initialDominantPcts);
  const avgFinalDominant = avg(finalDominantPcts);
  const avgInitialConviction = avg(initialConvictions);
  const avgFinalConviction = avg(finalConvictions);

  output("  Ideology Metrics Over Time:");
  output("  " + "-".repeat(45));
  output("  Metric                    Initial    Final");
  output(
    `  Avg Ideology Spread       ${avgInitialSpread.toFixed(3).padStart(7)}    ${avgFinalSpread.toFixed(3).padStart(6)}`,
  );
  output(
    `  % with Dominant Faction   ${avgInitialDominant.toFixed(1).padStart(6)}%    ${avgFinalDominant.toFixed(1).padStart(5)}%`,
  );
  output(
    `  Avg Conviction            ${avgInitialConviction.toFixed(3).padStart(7)}    ${avgFinalConviction.toFixed(3).padStart(6)}`,
  );

  const convergenceRate =
    avgInitialSpread > 0 ? ((avgInitialSpread - avgFinalSpread) / avgInitialSpread) * 100 : 0;
  output(`\n  Convergence Rate: ${convergenceRate.toFixed(1)}%`);
  output(`    (How much ideology homogenized over time)`);

  if (convergenceRate > 50) {
    output("    ⚠ High convergence - ideologies becoming uniform");
  } else if (convergenceRate > 25) {
    output("    ○ Moderate convergence - some diversity retained");
  } else {
    output("    ✓ Low convergence - ideological diversity maintained");
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const workerCount = getWorkerCount();
  output(`Running ${args.runs} simulations (seed: ${args.seed})...`);
  output(`Using ${workerCount} parallel workers`);
  output();

  let lastReportedProgress = 0;
  const startTime = Date.now();
  const results = await runSimulationsParallel(args.runs, args.seed, (completed, total) => {
    if (completed - lastReportedProgress >= 50 || completed === total) {
      output(`  Progress: ${completed}/${total}`, true);
      lastReportedProgress = completed;
    }
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // === ANALYSIS ===
  output("\n" + "=".repeat(60));
  output(`SIMULATION RESULTS (${args.runs} runs in ${elapsed}s)`);
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
  output("  Megastructure Victory requires:");
  output("    - Pass 3 faction projects");
  output("    - Gain 65% council seats for faction");
  output("    - Pass capstone project");
  output("    - Build megastructure (300-400 materials, 30-40 sols)");
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

  // Enhanced analysis sections
  analyzeVictoriesVsDefeats(results, victories, defeats);
  analyzeCorrelations(results);
  analyzeBottlenecks(results);
  analyzeEventImpact(results);
  analyzeCrisisTimeline(results);
  analyzeSocialCohesion(results);
  analyzeIdeology(results);

  output("\n" + "=".repeat(60));

  // Write output files based on log level
  if (args.log !== "silent") {
    const txtPath = await writeTextLog(args.runs, args.seed);
    output(`\nText log written to: ${txtPath}`);

    if (args.log === "verbose") {
      const jsonPath = await writeJsonOutput(results, args.runs, args.seed);
      output(`JSON data written to: ${jsonPath}`);
    }
  }
}

// Run main
main().catch(console.error);
