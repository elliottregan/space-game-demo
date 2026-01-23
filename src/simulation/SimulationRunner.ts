// src/simulation/SimulationRunner.ts
// Orchestrates Monte Carlo simulation runs for playtest analysis

import { GameAPI } from "../facade/GameAPI";
import { HeuristicStrategy } from "./HeuristicStrategy";
import { MetricsCollector } from "./MetricsCollector";
import type {
  SimulationConfig,
  RunResult,
  AggregateStats,
  VictoryType,
  DefeatReason,
} from "./types";

/**
 * Maximum sols to run before considering a game stuck.
 * Prevents infinite loops in edge cases.
 */
const MAX_SOLS = 10000;

/**
 * SimulationRunner orchestrates Monte Carlo simulation runs.
 * It creates fresh game instances, runs them to completion using
 * HeuristicStrategy, and aggregates results via MetricsCollector.
 */
export class SimulationRunner {
  constructor(private config: SimulationConfig) {}

  /**
   * Run all simulations according to config.
   * @returns Aggregate statistics across all runs
   */
  run(): AggregateStats {
    const collector = new MetricsCollector();

    for (let i = 0; i < this.config.runs; i++) {
      // Generate seed: config.seed + i if seed provided, otherwise use run index
      const seed = this.config.seed !== undefined ? this.config.seed + i : i;

      // Run single game and record result
      const result = this.runSingleGame(seed);
      collector.recordRun(result);

      // Verbose progress logging
      if (this.config.verbose) {
        const progress = ((i + 1) / this.config.runs * 100).toFixed(0);
        const outcomeStr = result.outcome === "victory"
          ? `Victory (${result.victoryType})`
          : `Defeat (${result.defeatReason})`;
        console.log(
          `[${progress}%] Run ${i + 1}/${this.config.runs}: ${outcomeStr} at sol ${result.finalSol}`
        );
      }
    }

    return collector.getStats();
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

    // Initialize tracking
    let peakPopulation = api.colony.snapshot().population;
    const buildingsBuiltMap = new Map<string, number>();
    const techsResearchedSet = new Set<string>();

    // Track initial researched techs (should be none at start)
    for (const tech of api.technology.snapshot().researched) {
      techsResearchedSet.add(tech.id);
    }

    // Track initial buildings
    for (const building of api.buildings.snapshot().active) {
      const count = buildingsBuiltMap.get(building.definitionId) ?? 0;
      buildingsBuiltMap.set(building.definitionId, count + 1);
    }

    // Game loop
    let solsRun = 0;
    while (!api.game.isGameOver() && solsRun < MAX_SOLS) {
      // Execute strategy tick (make decisions)
      strategy.executeTick();

      // Advance sol
      api.game.advanceSol();
      solsRun++;

      // Update peak population tracking
      const currentPop = api.colony.snapshot().population;
      if (currentPop > peakPopulation) {
        peakPopulation = currentPop;
      }

      // Track newly researched techs
      for (const tech of api.technology.snapshot().researched) {
        techsResearchedSet.add(tech.id);
      }

      // Track buildings - count current buildings of each type
      // Since buildings can be recycled, we track the max count seen for each type
      const buildingSnapshot = api.buildings.snapshot();
      const allBuildings = [...buildingSnapshot.active, ...buildingSnapshot.pending];

      // Count buildings by definition ID
      const currentCounts = new Map<string, number>();
      for (const building of allBuildings) {
        const count = currentCounts.get(building.definitionId) ?? 0;
        currentCounts.set(building.definitionId, count + 1);
      }

      // Update tracking with max seen counts
      for (const [defId, count] of currentCounts) {
        const prevMax = buildingsBuiltMap.get(defId) ?? 0;
        if (count > prevMax) {
          buildingsBuiltMap.set(defId, count);
        }
      }

      // Events are resolved in the strategy's handleEventResolution
    }

    // Determine outcome from victory state
    const victoryState = api.game.victoryState();
    const finalSol = api.game.currentSol();

    // Convert to RunResult
    return this.buildRunResult(
      seed,
      finalSol,
      peakPopulation,
      victoryState,
      techsResearchedSet,
      buildingsBuiltMap
    );
  }

  /**
   * Build RunResult from game state.
   */
  private buildRunResult(
    seed: number,
    finalSol: number,
    peakPopulation: number,
    victoryState: { status: string; reason?: string },
    techsResearched: Set<string>,
    buildingsBuilt: Map<string, number>
  ): RunResult {
    const outcome = victoryState.status === "victory" ? "victory" : "defeat";

    // Map victory/defeat reason to typed values
    let victoryType: VictoryType | undefined;
    let defeatReason: DefeatReason | undefined;

    if (outcome === "victory") {
      victoryType = this.mapVictoryType(victoryState.reason);
    } else {
      defeatReason = this.mapDefeatReason(victoryState.reason);
    }

    // Convert buildings map to record
    const buildingsRecord: Record<string, number> = {};
    for (const [defId, count] of buildingsBuilt) {
      buildingsRecord[defId] = count;
    }

    return {
      seed,
      outcome,
      victoryType,
      defeatReason,
      finalSol,
      peakPopulation,
      techsResearched: Array.from(techsResearched),
      buildingsBuilt: buildingsRecord,
    };
  }

  /**
   * Map victory reason string to VictoryType.
   */
  private mapVictoryType(reason?: string): VictoryType {
    if (!reason) return "population";

    // Check for colony charter victory
    if (reason.toLowerCase().includes("colony charter")) {
      return "colony_charter";
    }

    // Check for generation ship victory
    if (reason.toLowerCase().includes("generation ship")) {
      return "generation_ship";
    }

    // Check for population victory
    if (reason.toLowerCase().includes("100 population") || reason.toLowerCase().includes("thriving")) {
      return "population";
    }

    // Default to population
    return "population";
  }

  /**
   * Map defeat reason string to DefeatReason.
   */
  private mapDefeatReason(reason?: string): DefeatReason {
    if (!reason) return "population_collapse";

    const lowerReason = reason.toLowerCase();

    // Check for starvation
    if (lowerReason.includes("food") || lowerReason.includes("starv")) {
      return "starvation";
    }

    // Check for suffocation
    if (lowerReason.includes("oxygen") || lowerReason.includes("suffocat")) {
      return "suffocation";
    }

    // Check for population collapse
    if (lowerReason.includes("population") || lowerReason.includes("below 5")) {
      return "population_collapse";
    }

    // Default to population collapse
    return "population_collapse";
  }
}
