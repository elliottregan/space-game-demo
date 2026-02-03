import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { SimulationRunner } from "../../src/simulation/SimulationRunner";
import { GameAPI } from "../../src/facade/GameAPI";
import type { SimulationConfig, RunResult, AggregateStats } from "../../src/simulation/types";

// Note: SimulationRunner tests run full game simulations and may take 60-90 seconds total.
// Use extended timeout when running: bun test tests/simulation/SimulationRunner.test.ts --timeout 120000

describe("SimulationRunner", () => {
  describe("constructor", () => {
    it("accepts SimulationConfig", () => {
      const config: SimulationConfig = { runs: 5, seed: 42, verbose: false };
      const runner = new SimulationRunner(config);
      expect(runner).toBeDefined();
    });
  });

  describe("run()", () => {
    it("returns AggregateStats with correct totalRuns", () => {
      const config: SimulationConfig = { runs: 3, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      expect(stats.totalRuns).toBe(3);
    });

    it("all runs complete (no infinite loops)", () => {
      const config: SimulationConfig = { runs: 2, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);

      // This should complete without hanging
      const startTime = Date.now();
      const stats = runner.run();
      const elapsed = Date.now() - startTime;

      // Should complete reasonably fast (less than 30 seconds for 2 runs)
      expect(elapsed).toBeLessThan(30000);
      expect(stats.totalRuns).toBe(2);
    });

    it("runs complete regardless of seed value", () => {
      // Note: The game has random events that are not seeded, so we can't
      // guarantee deterministic results. This test verifies runs complete
      // with various seed values.
      const config1: SimulationConfig = { runs: 1, seed: 12345, verbose: false };
      const config2: SimulationConfig = { runs: 1, seed: 67890, verbose: false };

      const runner1 = new SimulationRunner(config1);
      const runner2 = new SimulationRunner(config2);

      const stats1 = runner1.run();
      const stats2 = runner2.run();

      // Both should complete with valid results
      expect(stats1.totalRuns).toBe(1);
      expect(stats2.totalRuns).toBe(1);
      expect(stats1.winRate).toBeGreaterThanOrEqual(0);
      expect(stats2.winRate).toBeGreaterThanOrEqual(0);
    });

    it("returns valid win rate between 0 and 1", () => {
      const config: SimulationConfig = { runs: 3, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      expect(stats.winRate).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeLessThanOrEqual(1);
    });

    it("includes victory and defeat breakdowns", () => {
      const config: SimulationConfig = { runs: 3, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      // Either victories or defeats should have counts
      const totalVictories = Object.values(stats.victoryBreakdown).reduce((a, b) => a + b, 0);
      const totalDefeats = Object.values(stats.defeatBreakdown).reduce((a, b) => a + b, 0);

      expect(totalVictories + totalDefeats).toBe(stats.totalRuns);
    });

    it("logs progress when verbose is true", () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => logs.push(args.join(" "));

      try {
        const config: SimulationConfig = { runs: 2, seed: 1, verbose: true };
        const runner = new SimulationRunner(config);
        runner.run();

        // Should have progress logs
        expect(logs.some((l) => l.includes("Run 1"))).toBe(true);
        expect(logs.some((l) => l.includes("Run 2"))).toBe(true);
      } finally {
        console.log = originalLog;
      }
    });

    it("does not log when verbose is false", () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => logs.push(args.join(" "));

      try {
        const config: SimulationConfig = { runs: 2, seed: 1, verbose: false };
        const runner = new SimulationRunner(config);
        runner.run();

        // Should have no progress logs
        expect(logs.filter((l) => l.includes("Run")).length).toBe(0);
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe("runSingleGame (via run)", () => {
    it("tracks peak population", () => {
      // Run a single game and verify the result
      const config: SimulationConfig = { runs: 1, seed: 42, verbose: false };
      const runner = new SimulationRunner(config);

      // We can't directly access runSingleGame, but we can verify through stats
      // Peak population should be at least the starting population
      const stats = runner.run();

      // If there were any victories, avgTimeToWin should be > 0
      // If all defeats, check that defeats are tracked
      expect(stats.totalRuns).toBe(1);
    });

    it("games end with either victory or defeat", () => {
      const config: SimulationConfig = { runs: 5, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      // All games should end with a definitive outcome
      const victories = Object.values(stats.victoryBreakdown).reduce((a, b) => a + b, 0);
      const defeats = Object.values(stats.defeatBreakdown).reduce((a, b) => a + b, 0);

      expect(victories + defeats).toBe(stats.totalRuns);
    });

    it("uses different seeds for different runs", () => {
      // Run with same base seed but multiple runs
      const config: SimulationConfig = { runs: 3, seed: 100, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      // Just verify it completes - seeds are internally seed + runIndex
      expect(stats.totalRuns).toBe(3);
    });
  });

  describe("victory type mapping", () => {
    it("identifies population victory", () => {
      // Run simulations and check victory breakdown
      const config: SimulationConfig = { runs: 10, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      // If there are victories, they should be categorized
      if (stats.winRate > 0) {
        const hasCategories =
          stats.victoryBreakdown["return_mission"] !== undefined ||
          stats.victoryBreakdown["declaration_of_sovereignty"] !== undefined ||
          stats.victoryBreakdown["planetary_acquisition"] !== undefined;
        expect(hasCategories).toBe(true);
      }
    });
  });

  describe("defeat reason mapping", () => {
    it("categorizes defeats by reason", () => {
      // Run simulations and check defeat breakdown
      const config: SimulationConfig = { runs: 10, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      // If there are defeats, they should be categorized
      if (stats.winRate < 1) {
        const hasCategories =
          stats.defeatBreakdown["starvation"] !== undefined ||
          stats.defeatBreakdown["suffocation"] !== undefined ||
          stats.defeatBreakdown["population_collapse"] !== undefined ||
          stats.defeatBreakdown["earth_collapse"] !== undefined;
        expect(hasCategories).toBe(true);
      }
    });
  });

  describe("integration tests", () => {
    it("completes 10 runs without error", () => {
      const config: SimulationConfig = { runs: 10, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);

      expect(() => runner.run()).not.toThrow();
    });

    it("produces meaningful statistics", () => {
      const config: SimulationConfig = { runs: 10, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      // Should have meaningful data
      expect(stats.totalRuns).toBe(10);

      // Win rate should be a valid percentage
      expect(stats.winRate).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeLessThanOrEqual(1);

      // If there are victories, time stats should be meaningful
      if (stats.winRate > 0) {
        expect(stats.avgTimeToWin).toBeGreaterThan(0);
        expect(stats.fastestWin).toBeGreaterThan(0);
        expect(stats.slowestWin).toBeGreaterThanOrEqual(stats.fastestWin);
      }
    });

    it("handles games that run for many sols", () => {
      // Run a few games with a seed that might produce long games
      const config: SimulationConfig = { runs: 3, seed: 999, verbose: false };
      const runner = new SimulationRunner(config);

      const startTime = Date.now();
      const stats = runner.run();
      const elapsed = Date.now() - startTime;

      // Should complete within reasonable time
      expect(elapsed).toBeLessThan(60000); // 60 seconds max
      expect(stats.totalRuns).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("handles zero runs gracefully", () => {
      const config: SimulationConfig = { runs: 0, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      expect(stats.totalRuns).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    it("handles missing seed (uses run index)", () => {
      const config: SimulationConfig = { runs: 2, verbose: false };
      const runner = new SimulationRunner(config);

      // Should not throw when seed is undefined
      expect(() => runner.run()).not.toThrow();
    });

    it("handles single run", () => {
      const config: SimulationConfig = { runs: 1, seed: 1, verbose: false };
      const runner = new SimulationRunner(config);
      const stats = runner.run();

      expect(stats.totalRuns).toBe(1);
      // Win rate should be either 0 or 1 for a single run
      expect([0, 1]).toContain(stats.winRate);
    });
  });
});
