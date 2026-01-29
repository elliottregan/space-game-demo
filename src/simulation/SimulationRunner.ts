// src/simulation/SimulationRunner.ts
// Orchestrates Monte Carlo simulation runs for playtest analysis

import { GameAPI } from "../facade/GameAPI";
import { HeuristicStrategy } from "./HeuristicStrategy";
import { MetricsCollector } from "./MetricsCollector";
import type {
  AggregateStats,
  CrisisPoint,
  CrisisSeverity,
  CrisisType,
  DefeatReason,
  ResourceFlowSnapshot,
  ResourceSnapshot,
  RunResult,
  SimulationConfig,
  VictoryType,
} from "./types";

/**
 * Maximum sols to run before considering a game stuck.
 * Prevents infinite loops in edge cases.
 */
const MAX_SOLS = 10000;

/**
 * Interval at which resource snapshots are taken.
 */
const SNAPSHOT_INTERVAL = 50;

/**
 * Thresholds for detecting crisis conditions.
 */
const CRISIS_THRESHOLDS = {
  food: { warning: 30, critical: 10 },
  oxygen: { warning: 30, critical: 10 },
  water: { warning: 20, critical: 5 },
  morale: { warning: 40, critical: 25 },
  cohesion: { warning: 0.15, critical: 0.08 },
} as const;

/**
 * Convert a Map to a Record object.
 */
function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const record: Record<string, V> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}

/**
 * Result of running simulations including both aggregate stats and individual runs.
 */
export interface SimulationResults {
  stats: AggregateStats;
  runs: RunResult[];
}

/**
 * SimulationRunner orchestrates Monte Carlo simulation runs.
 * It creates fresh game instances, runs them to completion using
 * HeuristicStrategy, and aggregates results via MetricsCollector.
 */
export class SimulationRunner {
  private collector: MetricsCollector | null = null;

  constructor(private config: SimulationConfig) {}

  /**
   * Run all simulations according to config.
   * @returns Aggregate statistics across all runs
   */
  run(): AggregateStats {
    this.collector = new MetricsCollector();

    for (let i = 0; i < this.config.runs; i++) {
      // Generate seed: config.seed + i if seed provided, otherwise use run index
      const seed = this.config.seed !== undefined ? this.config.seed + i : i;

      // Run single game and record result
      const result = this.runSingleGame(seed);
      this.collector.recordRun(result);

      // Verbose progress logging
      if (this.config.verbose) {
        const progress = (((i + 1) / this.config.runs) * 100).toFixed(0);
        const outcomeStr =
          result.outcome === "victory"
            ? `Victory (${result.victoryType})`
            : `Defeat (${result.defeatReason})`;
        console.log(
          `[${progress}%] Run ${i + 1}/${this.config.runs}: ${outcomeStr} at sol ${result.finalSol}`,
        );
      }
    }

    return this.collector.getStats();
  }

  /**
   * Run all simulations and return both aggregate stats and individual runs.
   * @returns Full simulation results including stats and all run data
   */
  runWithDetails(): SimulationResults {
    const stats = this.run();
    const runs = this.collector ? [...this.collector.getResults()] : [];
    return { stats, runs };
  }

  /**
   * Get individual run results from the last simulation batch.
   * Must be called after run().
   * @returns Array of individual run results or empty if run() hasn't been called
   */
  getRunResults(): readonly RunResult[] {
    return this.collector?.getResults() ?? [];
  }

  /**
   * Run a single game to completion.
   * @param seed Seed for this run (for future RNG seeding)
   * @returns Result of the completed run
   */
  private runSingleGame(seed: number): RunResult {
    // Create fresh GameAPI instance
    const api = new GameAPI();

    // Create strategy for decision making
    const strategy = new HeuristicStrategy(api);

    // Initialize tracking - use lightweight snapshots to skip expensive calculations
    let peakPopulation = api.colony.snapshot({ lightweight: true }).population;
    const buildingsBuiltMap = new Map<string, number>();
    const techsResearchedSet = new Set<string>();

    // Enhanced tracking structures
    const resourceTimeline: ResourceSnapshot[] = [];
    const flowTimeline: ResourceFlowSnapshot[] = [];
    const crisisTimeline: CrisisPoint[] = [];
    const buildingFirstBuiltSol = new Map<string, number>();
    const techCompletedSol = new Map<string, number>();
    let previousPopulation = api.colony.snapshot({ lightweight: true }).population;

    // Track last crisis of each type for O(1) lookup (optimization)
    const lastCrisisOfType = new Map<CrisisType, CrisisPoint>();

    // Track initial researched techs (should be none at start)
    for (const tech of api.technology.snapshot().researched) {
      techsResearchedSet.add(tech.id);
      techCompletedSol.set(tech.id, 0);
    }

    // Track initial buildings
    for (const building of api.buildings.snapshot().active) {
      const count = buildingsBuiltMap.get(building.definitionId) ?? 0;
      buildingsBuiltMap.set(building.definitionId, count + 1);
      if (!buildingFirstBuiltSol.has(building.definitionId)) {
        buildingFirstBuiltSol.set(building.definitionId, 0);
      }
    }

    // Game loop
    let solsRun = 0;
    while (!api.game.isGameOver() && solsRun < MAX_SOLS) {
      // Execute strategy tick (make decisions)
      strategy.executeTick();

      // Advance sol
      api.game.advanceSol();
      solsRun++;

      const currentSol = api.game.currentSol();
      const colony = api.colony.snapshot({ lightweight: true });
      const resources = api.resources.snapshot();

      // Update peak population tracking
      const currentPop = colony.population;
      if (currentPop > peakPopulation) {
        peakPopulation = currentPop;
      }

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
      this.detectCrisis(
        currentSol,
        resources.current,
        colony.morale,
        crisisTimeline,
        lastCrisisOfType,
      );

      // Detect social cohesion crisis
      this.detectCohesionCrisis(
        currentSol,
        colony.socialCohesion,
        crisisTimeline,
        lastCrisisOfType,
      );

      // Take periodic snapshots
      if (currentSol % SNAPSHOT_INTERVAL === 0) {
        // Count isolated colonists
        const isolatedCount = colony.colonists.filter(
          (c) => !colony.coworkerRelationships.has(c.id),
        ).length;

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
          socialCohesion: colony.socialCohesion,
          isolatedColonists: isolatedCount,
        });

        flowTimeline.push({
          sol: currentSol,
          netFood: (resources.production.food ?? 0) - (resources.consumption.food ?? 0),
          netOxygen: (resources.production.oxygen ?? 0) - (resources.consumption.oxygen ?? 0),
          netWater: (resources.production.water ?? 0) - (resources.consumption.water ?? 0),
          netPower: (resources.production.power ?? 0) - (resources.consumption.power ?? 0),
          netMaterials:
            (resources.production.materials ?? 0) - (resources.consumption.materials ?? 0),
        });
      }

      // Track newly researched techs
      for (const tech of api.technology.snapshot().researched) {
        if (!techsResearchedSet.has(tech.id)) {
          techsResearchedSet.add(tech.id);
          techCompletedSol.set(tech.id, currentSol);
        }
      }

      // Track buildings - count current buildings of each type
      // Since buildings can be recycled, we track the max count seen for each type
      const buildingSnapshot = api.buildings.snapshot();

      // Count buildings by definition ID (iterate directly, avoid spread allocation)
      const currentCounts = new Map<string, number>();
      for (const building of buildingSnapshot.active) {
        const count = currentCounts.get(building.definitionId) ?? 0;
        currentCounts.set(building.definitionId, count + 1);
      }
      for (const building of buildingSnapshot.pending) {
        const count = currentCounts.get(building.definitionId) ?? 0;
        currentCounts.set(building.definitionId, count + 1);
      }

      // Update tracking with max seen counts and first-built sol
      for (const [defId, count] of currentCounts) {
        const prevMax = buildingsBuiltMap.get(defId) ?? 0;
        if (count > prevMax) {
          buildingsBuiltMap.set(defId, count);
          if (!buildingFirstBuiltSol.has(defId)) {
            buildingFirstBuiltSol.set(defId, currentSol);
          }
        }
      }

      // Events are resolved in the strategy's handleEventResolution
    }

    // Determine outcome from victory state
    const victoryState = api.game.victoryState();
    const finalSol = api.game.currentSol();

    // Capture resources at death if defeated
    let resourcesAtDeath: ResourceSnapshot | undefined;
    let defeatSol: number | undefined;
    if (victoryState.status !== "victory") {
      defeatSol = finalSol;
      const resources = api.resources.snapshot();
      const colony = api.colony.snapshot({ lightweight: true });
      const isolatedCount = colony.colonists.filter(
        (c) => !colony.coworkerRelationships.has(c.id),
      ).length;
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
        socialCohesion: colony.socialCohesion,
        isolatedColonists: isolatedCount,
      };
    }

    // Get blocked decisions and events from strategy
    const blockedDecisions = strategy.getBlockedDecisions();
    const eventsOccurred = strategy.getEventsOccurred();

    // Convert to RunResult
    return this.buildRunResult(
      seed,
      finalSol,
      peakPopulation,
      victoryState,
      techsResearchedSet,
      buildingsBuiltMap,
      {
        resourceTimeline,
        flowTimeline,
        crisisTimeline,
        buildingFirstBuiltSol,
        techCompletedSol,
        defeatSol,
        resourcesAtDeath,
        blockedDecisions,
        eventsOccurred,
      },
    );
  }

  /**
   * Detect crisis conditions and record them.
   * Uses lastCrisisOfType map for O(1) lookup instead of filtering array.
   */
  private detectCrisis(
    sol: number,
    resources: { food: number; oxygen: number; water: number },
    morale: number,
    crisisTimeline: CrisisPoint[],
    lastCrisisOfType: Map<CrisisType, CrisisPoint>,
  ): void {
    const checkResource = (
      type: CrisisType,
      value: number,
      thresholds: { warning: number; critical: number },
    ) => {
      let severity: CrisisSeverity | null = null;
      let threshold = 0;

      if (value <= thresholds.critical) {
        severity = "critical";
        threshold = thresholds.critical;
      } else if (value <= thresholds.warning) {
        severity = "warning";
        threshold = thresholds.warning;
      }

      if (severity) {
        // Only record if this is a new crisis or escalation (O(1) lookup)
        const lastCrisis = lastCrisisOfType.get(type);
        if (
          !lastCrisis ||
          lastCrisis.sol < sol - 10 ||
          (lastCrisis.severity === "warning" && severity === "critical")
        ) {
          const crisis: CrisisPoint = { sol, type, severity, value, threshold };
          crisisTimeline.push(crisis);
          lastCrisisOfType.set(type, crisis);
        }
      }
    };

    checkResource("low_food", resources.food, CRISIS_THRESHOLDS.food);
    checkResource("low_oxygen", resources.oxygen, CRISIS_THRESHOLDS.oxygen);
    checkResource("low_water", resources.water, CRISIS_THRESHOLDS.water);
    checkResource("low_morale", morale, CRISIS_THRESHOLDS.morale);
  }

  /**
   * Detect social cohesion crisis conditions.
   * Uses lastCrisisOfType map for O(1) lookup instead of filtering array.
   */
  private detectCohesionCrisis(
    sol: number,
    cohesion: number,
    crisisTimeline: CrisisPoint[],
    lastCrisisOfType: Map<CrisisType, CrisisPoint>,
  ): void {
    let severity: CrisisSeverity | null = null;
    let threshold = 0;

    if (cohesion <= CRISIS_THRESHOLDS.cohesion.critical) {
      severity = "critical";
      threshold = CRISIS_THRESHOLDS.cohesion.critical;
    } else if (cohesion <= CRISIS_THRESHOLDS.cohesion.warning) {
      severity = "warning";
      threshold = CRISIS_THRESHOLDS.cohesion.warning;
    }

    if (severity) {
      const lastCrisis = lastCrisisOfType.get("low_cohesion");
      if (
        !lastCrisis ||
        lastCrisis.sol < sol - 10 ||
        (lastCrisis.severity === "warning" && severity === "critical")
      ) {
        const crisis: CrisisPoint = {
          sol,
          type: "low_cohesion",
          severity,
          value: cohesion,
          threshold,
        };
        crisisTimeline.push(crisis);
        lastCrisisOfType.set("low_cohesion", crisis);
      }
    }
  }

  /**
   * Enhanced tracking data passed to buildRunResult.
   */
  private buildRunResult(
    seed: number,
    finalSol: number,
    peakPopulation: number,
    victoryState: { status: string; reason?: string },
    techsResearched: Set<string>,
    buildingsBuilt: Map<string, number>,
    enhanced?: {
      resourceTimeline: ResourceSnapshot[];
      flowTimeline: ResourceFlowSnapshot[];
      crisisTimeline: CrisisPoint[];
      buildingFirstBuiltSol: Map<string, number>;
      techCompletedSol: Map<string, number>;
      defeatSol?: number;
      resourcesAtDeath?: ResourceSnapshot;
      blockedDecisions: import("./types").BlockedDecision[];
      eventsOccurred: import("./types").EventOccurrence[];
    },
  ): RunResult {
    const outcome = victoryState.status === "victory" ? "victory" : "defeat";

    // Map victory/defeat reason to typed values
    const victoryType =
      outcome === "victory" ? this.mapVictoryType(victoryState.reason) : undefined;
    const defeatReason =
      outcome === "defeat" ? this.mapDefeatReason(victoryState.reason) : undefined;

    // Convert maps to records
    const buildingsRecord = mapToRecord(buildingsBuilt);
    const buildingFirstBuiltSolRecord = enhanced?.buildingFirstBuiltSol
      ? mapToRecord(enhanced.buildingFirstBuiltSol)
      : {};
    const techCompletedSolRecord = enhanced?.techCompletedSol
      ? mapToRecord(enhanced.techCompletedSol)
      : {};

    return {
      seed,
      outcome,
      victoryType,
      defeatReason,
      finalSol,
      peakPopulation,
      techsResearched: Array.from(techsResearched),
      buildingsBuilt: buildingsRecord,
      // Enhanced tracking fields
      resourceTimeline: enhanced?.resourceTimeline,
      flowTimeline: enhanced?.flowTimeline,
      crisisTimeline: enhanced?.crisisTimeline,
      buildingFirstBuiltSol:
        Object.keys(buildingFirstBuiltSolRecord).length > 0
          ? buildingFirstBuiltSolRecord
          : undefined,
      techCompletedSol:
        Object.keys(techCompletedSolRecord).length > 0 ? techCompletedSolRecord : undefined,
      defeatSol: enhanced?.defeatSol,
      resourcesAtDeath: enhanced?.resourcesAtDeath,
      blockedDecisions: enhanced?.blockedDecisions?.length ? enhanced.blockedDecisions : undefined,
      eventsOccurred: enhanced?.eventsOccurred?.length ? enhanced.eventsOccurred : undefined,
    };
  }

  /**
   * Map victory reason string to VictoryType.
   */
  private mapVictoryType(reason?: string): VictoryType {
    if (!reason) return "population";

    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes("colony charter")) return "colony_charter";
    if (lowerReason.includes("generation ship")) return "generation_ship";
    if (lowerReason.includes("100 population") || lowerReason.includes("thriving")) {
      return "population";
    }

    return "population";
  }

  /**
   * Map defeat reason string to DefeatReason.
   */
  private mapDefeatReason(reason?: string): DefeatReason {
    if (!reason) return "population_collapse";

    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes("food") || lowerReason.includes("starv")) return "starvation";
    if (lowerReason.includes("oxygen") || lowerReason.includes("suffocat")) return "suffocation";
    if (lowerReason.includes("population") || lowerReason.includes("below 5")) {
      return "population_collapse";
    }

    return "population_collapse";
  }
}
