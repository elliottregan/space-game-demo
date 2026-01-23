// src/simulation/types.ts
// Type definitions for Monte Carlo playtest simulation system

/**
 * Configuration for running simulation batches.
 */
export interface SimulationConfig {
  /** Number of simulation runs to execute */
  runs: number;
  /** Optional seed for reproducible random sequences */
  seed?: number;
  /** Enable verbose logging during simulation */
  verbose?: boolean;
}

/**
 * Victory condition types.
 * - population: Colony reached 100 population
 * - generation_ship: Generation Ship technology researched
 */
export type VictoryType = "population" | "generation_ship";

/**
 * Defeat condition types.
 * - starvation: Food resources depleted to zero
 * - suffocation: Oxygen resources depleted to zero
 * - population_collapse: Population dropped below 5
 */
export type DefeatReason = "starvation" | "suffocation" | "population_collapse";

/**
 * Outcome of a single simulation run.
 */
export type RunOutcome = "victory" | "defeat";

/**
 * Result of a single simulation run.
 * Captures the outcome and key metrics from one playthrough.
 */
export interface RunResult {
  /** Seed used for this run's random number generation */
  seed: number;
  /** Whether the run ended in victory or defeat */
  outcome: RunOutcome;
  /** Type of victory achieved (only present if outcome is "victory") */
  victoryType?: VictoryType;
  /** Reason for defeat (only present if outcome is "defeat") */
  defeatReason?: DefeatReason;
  /** Sol (day) number when the game ended */
  finalSol: number;
  /** Maximum population reached during the run */
  peakPopulation: number;
  /** IDs of technologies researched during the run */
  techsResearched: string[];
  /** Count of each building type constructed */
  buildingsBuilt: Record<string, number>;
}

/**
 * Aggregate statistics across multiple simulation runs.
 * Used for analyzing strategy effectiveness and balance.
 */
export interface AggregateStats {
  /** Total number of runs completed */
  totalRuns: number;
  /** Percentage of runs that ended in victory (0-1) */
  winRate: number;
  /** Average number of sols to achieve victory */
  avgTimeToWin: number;
  /** Standard deviation of sols to victory */
  stdDevTimeToWin: number;
  /** Count of defeats by reason */
  defeatBreakdown: Record<DefeatReason, number>;
  /** Count of victories by type */
  victoryBreakdown: Record<VictoryType, number>;
  /** Minimum sols to achieve victory */
  fastestWin: number;
  /** Maximum sols to achieve victory */
  slowestWin: number;
}
