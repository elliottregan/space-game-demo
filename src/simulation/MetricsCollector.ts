// src/simulation/MetricsCollector.ts
// Tracks and aggregates simulation data for Monte Carlo playtest analysis

import type { RunResult, AggregateStats } from "./types";

/** Display names for defeat reasons. */
const DEFEAT_REASON_NAMES: Record<string, string> = {
  starvation: "Starvation",
  suffocation: "Suffocation",
  population_collapse: "Population Collapse",
};

/** Display names for victory types. */
const VICTORY_TYPE_NAMES: Record<string, string> = {
  population: "Population (100)",
  generation_ship: "Generation Ship",
  colony_charter: "Colony Charter",
};

/**
 * MetricsCollector tracks individual simulation run results and computes
 * aggregate statistics for analyzing game balance and strategy effectiveness.
 */
export class MetricsCollector {
  private results: RunResult[] = [];

  /**
   * Record a single simulation run result.
   * @param result The result of a completed simulation run
   */
  recordRun(result: RunResult): void {
    this.results.push(result);
  }

  /**
   * Get aggregate statistics across all recorded runs.
   * @returns Computed statistics including win rate, time to win, and breakdowns
   */
  getStats(): AggregateStats {
    const totalRuns = this.results.length;

    if (totalRuns === 0) {
      return {
        totalRuns: 0,
        winRate: 0,
        avgTimeToWin: 0,
        stdDevTimeToWin: 0,
        defeatBreakdown: {},
        victoryBreakdown: {},
        fastestWin: 0,
        slowestWin: 0,
      };
    }

    // Separate victories and defeats
    const victories = this.results.filter((r) => r.outcome === "victory");
    const defeats = this.results.filter((r) => r.outcome === "defeat");

    // Calculate win rate (as decimal 0-1)
    const winRate = victories.length / totalRuns;

    // Calculate time-to-win statistics for victories
    const victoryTimes = victories.map((r) => r.finalSol);
    const avgTimeToWin = this.calculateMean(victoryTimes);
    const stdDevTimeToWin = this.calculateStdDev(victoryTimes);
    const fastestWin = victoryTimes.length > 0 ? Math.min(...victoryTimes) : 0;
    const slowestWin = victoryTimes.length > 0 ? Math.max(...victoryTimes) : 0;

    // Count defeats by reason
    const defeatBreakdown: Record<string, number> = {};
    for (const defeat of defeats) {
      if (defeat.defeatReason) {
        defeatBreakdown[defeat.defeatReason] = (defeatBreakdown[defeat.defeatReason] ?? 0) + 1;
      }
    }

    // Count victories by type
    const victoryBreakdown: Record<string, number> = {};
    for (const victory of victories) {
      if (victory.victoryType) {
        victoryBreakdown[victory.victoryType] = (victoryBreakdown[victory.victoryType] ?? 0) + 1;
      }
    }

    return {
      totalRuns,
      winRate,
      avgTimeToWin,
      stdDevTimeToWin,
      defeatBreakdown,
      victoryBreakdown,
      fastestWin,
      slowestWin,
    };
  }

  /**
   * Print a formatted summary of simulation results to console.
   */
  printSummary(): void {
    const stats = this.getStats();
    const victories = this.results.filter((r) => r.outcome === "victory").length;
    const defeats = this.results.filter((r) => r.outcome === "defeat").length;

    console.log(`=== Simulation Results (${stats.totalRuns} runs) ===`);
    console.log(
      `Win Rate: ${(stats.winRate * 100).toFixed(0)}% (${victories} victories, ${defeats} defeats)`,
    );

    if (victories > 0) {
      console.log(
        `Average Time to Win: ${stats.avgTimeToWin.toFixed(0)} sols (σ = ${stats.stdDevTimeToWin.toFixed(0)})`,
      );
      console.log(`Fastest Win: ${stats.fastestWin} sols | Slowest Win: ${stats.slowestWin} sols`);
    }

    // Defeat breakdown
    if (defeats > 0) {
      console.log("\nDefeat Breakdown:");
      for (const reason of Object.keys(DEFEAT_REASON_NAMES)) {
        const count = stats.defeatBreakdown[reason] ?? 0;
        if (count > 0) {
          const percentage = ((count / defeats) * 100).toFixed(0);
          console.log(`  - ${this.formatDefeatReason(reason)}: ${percentage}%`);
        }
      }
    }

    // Victory breakdown
    if (victories > 0) {
      console.log("\nVictory Breakdown:");
      for (const type of Object.keys(VICTORY_TYPE_NAMES)) {
        const count = stats.victoryBreakdown[type] ?? 0;
        if (count > 0) {
          const percentage = ((count / victories) * 100).toFixed(0);
          console.log(`  - ${this.formatVictoryType(type)}: ${percentage}%`);
        }
      }
    }
  }

  /**
   * Export all collected data and statistics as JSON.
   * @returns JSON string with full run data and aggregate statistics
   */
  toJSON(): string {
    return JSON.stringify(
      {
        stats: this.getStats(),
        runs: this.results,
      },
      null,
      2,
    );
  }

  /**
   * Get the raw results array (for testing or external analysis).
   */
  getResults(): readonly RunResult[] {
    return this.results;
  }

  /**
   * Clear all recorded results (useful for resetting between test batches).
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Calculate the arithmetic mean of an array of numbers.
   * @returns 0 if array is empty
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculate the population standard deviation of an array of numbers.
   * @returns 0 if array has fewer than 2 elements
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((val) => (val - mean) ** 2);
    const avgSquaredDiff = this.calculateMean(squaredDiffs);
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Format defeat reason for display (e.g., "population_collapse" -> "Population Collapse").
   */
  private formatDefeatReason(reason: string): string {
    return DEFEAT_REASON_NAMES[reason] ?? reason;
  }

  /**
   * Format victory type for display (e.g., "generation_ship" -> "Generation Ship").
   */
  private formatVictoryType(type: string): string {
    return VICTORY_TYPE_NAMES[type] ?? type;
  }
}
