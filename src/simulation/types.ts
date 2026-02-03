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
 * Victory is achieved by completing a faction capstone project, then building
 * the corresponding megastructure.
 * - return_mission: Earth Loyalists capstone → Space Elevator
 * - declaration_of_sovereignty: Mars Independence capstone → United Mars Station
 * - planetary_acquisition: Corporate Interests capstone → Generation Ship
 */
export type VictoryType = "return_mission" | "declaration_of_sovereignty" | "planetary_acquisition";

/**
 * Defeat condition types.
 * - starvation: Food resources depleted to zero
 * - suffocation: Oxygen resources depleted to zero
 * - population_collapse: Population dropped below 5
 * - earth_collapse: Earth climate crisis reached point of no return
 */
export type DefeatReason = "starvation" | "suffocation" | "population_collapse" | "earth_collapse";

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
  /** Time-series snapshots of ideology distribution */
  ideologyTimeline?: IdeologySnapshot[];
  /** First sol each building type was constructed */
  buildingFirstBuiltSol?: Record<string, number>;
  /** Sol when each technology was completed */
  techCompletedSol?: Record<string, number>;
  /** Decisions that were blocked due to resource constraints */
  blockedDecisions?: BlockedDecision[];
  /** Events that occurred and choices made */
  eventsOccurred?: EventOccurrence[];
  /** Time-series snapshots of guild statistics */
  guildTimeline?: GuildSnapshot[];
  /** Total number of guilds formed during the run */
  guildsFormed?: number;
  /** Earth crisis severity at game end (0-100) */
  earthCrisisSeverity?: number;
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
  /** Number of defeats due to Earth climate collapse */
  earthCollapseLosses: number;
  /** Average Earth crisis severity at victory (0-100) */
  avgSeverityAtVictory: number;
}

/**
 * Time-series snapshot of resources at a given sol.
 */
export interface ResourceSnapshot {
  sol: number;
  food: number;
  water: number;
  /** Power ratio (0-1) where 1.0 = production >= consumption */
  powerGrid: number;
  materials: number;
  population: number;
  morale: number;
  health: number;
  socialCohesion: number;
  isolatedColonists: number;
}

/**
 * Time-series snapshot of ideology distribution at a given sol.
 */
export interface IdeologySnapshot {
  sol: number;
  /** Average Earth Loyalist affinity across all colonists (0-1) */
  avgEarthLoyalist: number;
  /** Average Mars Independence affinity across all colonists (0-1) */
  avgMarsIndependence: number;
  /** Average Corporate Interests affinity across all colonists (0-1) */
  avgCorporateInterests: number;
  /** Average conviction level (0-1) */
  avgConviction: number;
  /** Average ideology spread (max - min affinity per colonist) */
  avgIdeologySpread: number;
  /** Number of colonists with a clear dominant faction */
  colonistsWithDominant: number;
  /** Total colonists with ideology */
  totalColonists: number;
  /** Percentage of colonists with dominant faction */
  dominantFactionPct: number;
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
  /** Power grid strain (0-1) - not a stockpiled resource */
  powerGrid: PercentileValue;
  materials: PercentileValue;
  population: PercentileValue;
  morale: PercentileValue;
  socialCohesion: PercentileValue;
  /** Number of simulation runs that were still active at this sol */
  runsActive: number;
}

/**
 * Aggregated ideology snapshot combining data from multiple runs at a given sol.
 */
export interface AggregatedIdeologySnapshot {
  sol: number;
  earthLoyalist: PercentileValue;
  marsIndependence: PercentileValue;
  corporateInterests: PercentileValue;
  conviction: PercentileValue;
  ideologySpread: PercentileValue;
  dominantFactionPct: PercentileValue;
  runsActive: number;
}

/**
 * Net resource flow snapshot at a given sol.
 */
export interface ResourceFlowSnapshot {
  sol: number;
  netFood: number;
  netWater: number;
  netMaterials: number;
}

/**
 * Time-series snapshot of guild statistics at a given sol.
 */
export interface GuildSnapshot {
  sol: number;
  /** Total number of guilds */
  guildCount: number;
  /** Total members across all guilds */
  totalMembers: number;
  /** Average guild size */
  avgGuildSize: number;
  /** Count of guilds by type */
  byType: {
    professional: number;
    social: number;
    research: number;
    civic: number;
  };
}

/**
 * Aggregated guild snapshot combining data from multiple runs at a given sol.
 */
export interface AggregatedGuildSnapshot {
  sol: number;
  guildCount: PercentileValue;
  totalMembers: PercentileValue;
  avgGuildSize: PercentileValue;
  byType: {
    professional: PercentileValue;
    social: PercentileValue;
    research: PercentileValue;
    civic: PercentileValue;
  };
  runsActive: number;
}

/**
 * Guild formation analysis results.
 */
export interface GuildAnalysis {
  /** Average total guilds formed per run */
  avgGuildsFormed: number;
  /** Percentage of runs that formed at least one guild */
  runsWithGuilds: number;
  /** Average guilds by type */
  avgByType: {
    professional: number;
    social: number;
    research: number;
    civic: number;
  };
  /** Average guild size at end of game */
  avgFinalGuildSize: number;
  /** Average total guild members at end of game */
  avgFinalMemberCount: number;
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
 * Ideology analysis results.
 */
export interface IdeologyAnalysis {
  /** Average ideology spread at game start */
  avgInitialSpread: number;
  /** Average ideology spread at game end */
  avgFinalSpread: number;
  /** Percentage of colonists with dominant faction at start */
  initialDominantPct: number;
  /** Percentage of colonists with dominant faction at end */
  finalDominantPct: number;
  /** Average conviction at start */
  avgInitialConviction: number;
  /** Average conviction at end */
  avgFinalConviction: number;
  /** Convergence rate: how much ideology homogenized (0 = no change, 1 = fully converged) */
  convergenceRate: number;
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
  /** Aggregated ideology timeline with percentile bands across all runs */
  aggregatedIdeologyTimeline?: AggregatedIdeologySnapshot[];
  /** Aggregated guild timeline with percentile bands across all runs */
  aggregatedGuildTimeline?: AggregatedGuildSnapshot[];
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
    ideology: IdeologyAnalysis;
    guilds: GuildAnalysis;
  };
}
