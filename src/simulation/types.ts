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
 * - colony_charter: Colony Charter achieved (pop 40+, morale 60+ sustained)
 * - population: Colony reached 100 population
 * - generation_ship: Generation Ship technology researched
 */
export type VictoryType = "colony_charter" | "population" | "generation_ship";

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

  // === Enhanced tracking fields (optional for backward compatibility) ===

  /** Time-series snapshots of resources at regular intervals */
  resourceTimeline?: ResourceSnapshot[];
  /** Time-series snapshots of resource net flows */
  flowTimeline?: ResourceFlowSnapshot[];
  /** Sol when defeat occurred (only if outcome is "defeat") */
  defeatSol?: number;
  /** Resource snapshot at the moment of defeat */
  resourcesAtDeath?: ResourceSnapshot;
  /** Crisis events detected during the run */
  crisisTimeline?: CrisisPoint[];
  /** First sol each building type was constructed */
  buildingFirstBuiltSol?: Record<string, number>;
  /** Sol when each technology was completed */
  techCompletedSol?: Record<string, number>;
  /** Decisions that were blocked due to resource constraints */
  blockedDecisions?: BlockedDecision[];
  /** Events that occurred and choices made */
  eventsOccurred?: EventOccurrence[];
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
  defeatBreakdown: Record<string, number>;
  /** Count of victories by type */
  victoryBreakdown: Record<string, number>;
  /** Minimum sols to achieve victory */
  fastestWin: number;
  /** Maximum sols to achieve victory */
  slowestWin: number;
}

/**
 * Time-series snapshot of resources at a given sol.
 */
export interface ResourceSnapshot {
  sol: number;
  food: number;
  oxygen: number;
  water: number;
  power: number;
  materials: number;
  population: number;
  morale: number;
  health: number;
}

/**
 * Net resource flow snapshot at a given sol.
 */
export interface ResourceFlowSnapshot {
  sol: number;
  netFood: number;
  netOxygen: number;
  netWater: number;
  netPower: number;
  netMaterials: number;
}

/**
 * Represents a decision that was blocked due to resource constraints.
 */
export interface BlockedDecision {
  sol: number;
  category: "survival" | "infrastructure" | "growth" | "victory";
  action: string;
  reason: string;
  missingResources?: Record<string, number>;
}

/**
 * Tracks when an event occurred and what choice was made.
 */
export interface EventOccurrence {
  sol: number;
  eventId: string;
  eventName: string;
  choiceId: string;
  choiceText: string;
  effects: {
    resources?: Record<string, number>;
    population?: number;
    support?: Record<string, number>;
  };
}

/**
 * Crisis point types.
 */
export type CrisisType =
  | "low_food"
  | "low_oxygen"
  | "low_water"
  | "low_morale"
  | "population_drop";

/**
 * Crisis severity levels.
 */
export type CrisisSeverity = "warning" | "critical";

/**
 * Tracks when a crisis condition was detected.
 */
export interface CrisisPoint {
  sol: number;
  type: CrisisType;
  severity: CrisisSeverity;
  value: number;
  threshold: number;
}
