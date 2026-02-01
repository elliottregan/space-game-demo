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
 * - colony_charter: Colony Charter achieved (pop 50+, morale 60+ sustained)
 * - return_mission: Earth Loyalists capstone passed
 * - declaration_of_sovereignty: Mars Independence capstone passed
 * - planetary_acquisition: Corporate Interests capstone passed
 */
export type VictoryType =
  | "colony_charter"
  | "return_mission"
  | "declaration_of_sovereignty"
  | "planetary_acquisition";

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
  water: number;
  power: number;
  materials: number;
  population: number;
  morale: number;
  health: number;
  socialCohesion: number;
  isolatedColonists: number;
}

/**
 * Percentile values for aggregated metrics across multiple runs.
 */
export interface PercentileValue {
  median: number;
  p25: number;
  p75: number;
}

/**
 * Aggregated snapshot combining data from multiple runs at a given sol.
 * Uses percentile values to show distribution of metrics.
 */
export interface AggregatedSnapshot {
  sol: number;
  food: PercentileValue;
  water: PercentileValue;
  power: PercentileValue;
  materials: PercentileValue;
  population: PercentileValue;
  morale: PercentileValue;
  socialCohesion: PercentileValue;
  /** Number of simulation runs that were still active at this sol */
  runsActive: number;
}

/**
 * Net resource flow snapshot at a given sol.
 */
export interface ResourceFlowSnapshot {
  sol: number;
  netFood: number;
  netWater: number;
  netPower: number;
  netMaterials: number;
}

/**
 * Represents a decision that was blocked due to resource constraints.
 */
export interface BlockedDecision {
  sol: number;
  category: "survival" | "morale" | "infrastructure" | "growth" | "victory";
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
  | "low_water"
  | "low_morale"
  | "low_cohesion"
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

/**
 * Victory vs Defeat comparison stats.
 */
export interface VictoryDefeatComparison {
  avgPeakPopVictory: number;
  avgPeakPopDefeat: number;
  avgTechCountVictory: number;
  avgTechCountDefeat: number;
  avgBuildingCountVictory: number;
  avgBuildingCountDefeat: number;
  firstBuildingTiming: Record<
    string,
    {
      victory: number | null;
      defeat: number | null;
    }
  >;
  defeatSolStats: { min: number; median: number; max: number } | null;
}

/**
 * Correlation analysis results.
 */
export interface CorrelationAnalysis {
  firstFarmSol: number;
  techCount: number;
  peakPopulation: number;
  populationAtSol100: number;
}

/**
 * Bottleneck analysis results.
 */
export interface BottleneckAnalysis {
  topBlocks: Array<{ key: string; count: number; reason: string }>;
  categoryTotals: Record<string, number>;
}

/**
 * Event impact analysis results.
 */
export interface EventImpactAnalysis {
  events: Array<{
    eventId: string;
    count: number;
    victoryRate: number;
    diffFromBaseline: number;
  }>;
  baselineVictoryRate: number;
}

/**
 * Crisis timeline analysis results.
 */
export interface CrisisTimelineAnalysis {
  byType: Record<
    string,
    {
      total: number;
      warnings: number;
      critical: number;
      warningMedianSol: number | null;
      warningRange: [number, number] | null;
      criticalMedianSol: number | null;
      criticalRange: [number, number] | null;
    }
  >;
  firstCrisisTiming: { median: number; min: number; max: number } | null;
}

/**
 * Victory time distribution stats.
 */
export interface VictoryTimeStats {
  min: number;
  median: number;
  mean: number;
  p90: number;
  p95: number;
  max: number;
  histogram: Array<{ range: string; count: number }>;
}

/**
 * Peak population stats.
 */
export interface PeakPopulationStats {
  min: number;
  mean: number;
  max: number;
}

/**
 * Outlier analysis results.
 */
export interface OutlierAnalysis {
  count: number;
  totalVictories: number;
  percentage: number;
  avgTime: number | null;
}

/**
 * Social cohesion analysis results.
 */
export interface SocialCohesionAnalysis {
  /** Average cohesion at game end */
  avgFinalCohesion: number;
  /** Min cohesion observed across all runs */
  minCohesion: number;
  /** Max cohesion observed across all runs */
  maxCohesion: number;
  /** Average number of isolated colonists at game end */
  avgIsolatedColonists: number;
  /** Runs where cohesion dropped below critical threshold */
  lowCohesionRuns: number;
  /** Correlation between cohesion and victory */
  cohesionVictoryCorrelation: number;
}

/**
 * Complete analysis output for visualization.
 */
export interface AnalysisOutput {
  metadata: {
    timestamp: string;
    runs: number;
    seed: number;
  };
  summary: {
    winRate: number;
    victories: number;
    defeats: number;
    victoryTypes: Record<string, number>;
    defeatReasons: Record<string, number>;
  };
  victoryTimes: number[];
  peakPopulations: number[];
  techFrequency: Record<string, number>;
  buildingCounts: Record<string, number>;
  resourceTimeline: ResourceSnapshot[];
  /** Aggregated timeline with percentile bands across all runs */
  aggregatedTimeline: AggregatedSnapshot[];
  crisisEvents: CrisisPoint[];
  runs: RunResult[];

  // Extended stats for visualization
  stats?: {
    victoryTimeStats: VictoryTimeStats | null;
    peakPopulationStats: PeakPopulationStats;
    victoryDefeatComparison: VictoryDefeatComparison | null;
    correlations: CorrelationAnalysis;
    bottlenecks: BottleneckAnalysis;
    eventImpact: EventImpactAnalysis;
    crisisTimeline: CrisisTimelineAnalysis;
    outliers: OutlierAnalysis;
    socialCohesion: SocialCohesionAnalysis;
  };
}
