import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { MetricsCollector } from "../../src/simulation/MetricsCollector";
import type { RunResult } from "../../src/simulation/types";
import { BuildingId } from "../../src/core/models/Building";
import { TechnologyId } from "../../src/core/models/Technology";

// Helper to create test run results
function createVictoryResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    seed: Math.floor(Math.random() * 100000),
    outcome: "victory",
    victoryType: "earth_relief_compact",
    finalSol: 250,
    peakPopulation: 100,
    techsResearched: [TechnologyId.HYDROPONICS],
    buildingsBuilt: { [BuildingId.BASIC_FARM]: 5 },
    ...overrides,
  };
}

function createDefeatResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    seed: Math.floor(Math.random() * 100000),
    outcome: "defeat",
    defeatReason: "starvation",
    finalSol: 45,
    peakPopulation: 12,
    techsResearched: [],
    buildingsBuilt: { [BuildingId.BASIC_FARM]: 1 },
    ...overrides,
  };
}

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("recordRun", () => {
    it("records a single victory result", () => {
      const result = createVictoryResult();
      collector.recordRun(result);

      const results = collector.getResults();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(result);
    });

    it("records a single defeat result", () => {
      const result = createDefeatResult();
      collector.recordRun(result);

      const results = collector.getResults();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(result);
    });

    it("records multiple results in order", () => {
      const victory = createVictoryResult({ seed: 1 });
      const defeat = createDefeatResult({ seed: 2 });
      const victory2 = createVictoryResult({ seed: 3 });

      collector.recordRun(victory);
      collector.recordRun(defeat);
      collector.recordRun(victory2);

      const results = collector.getResults();
      expect(results).toHaveLength(3);
      expect(results[0]!.seed).toBe(1);
      expect(results[1]!.seed).toBe(2);
      expect(results[2]!.seed).toBe(3);
    });
  });

  describe("getStats", () => {
    describe("with no runs", () => {
      it("returns zero values for empty collector", () => {
        const stats = collector.getStats();

        expect(stats.totalRuns).toBe(0);
        expect(stats.winRate).toBe(0);
        expect(stats.avgTimeToWin).toBe(0);
        expect(stats.stdDevTimeToWin).toBe(0);
        expect(stats.fastestWin).toBe(0);
        expect(stats.slowestWin).toBe(0);
        expect(stats.defeatBreakdown).toEqual({});
        expect(stats.victoryBreakdown).toEqual({});
      });
    });

    describe("with only victories", () => {
      it("calculates 100% win rate", () => {
        collector.recordRun(createVictoryResult());
        collector.recordRun(createVictoryResult());
        collector.recordRun(createVictoryResult());

        const stats = collector.getStats();
        expect(stats.winRate).toBe(1);
        expect(stats.totalRuns).toBe(3);
      });

      it("calculates average time to win", () => {
        collector.recordRun(createVictoryResult({ finalSol: 100 }));
        collector.recordRun(createVictoryResult({ finalSol: 200 }));
        collector.recordRun(createVictoryResult({ finalSol: 300 }));

        const stats = collector.getStats();
        expect(stats.avgTimeToWin).toBe(200);
      });

      it("calculates standard deviation of time to win", () => {
        // Values: 100, 200, 300 -> mean = 200
        // Deviations: -100, 0, 100 -> squared: 10000, 0, 10000
        // Variance = 20000/3 = 6666.67 -> stddev = 81.65
        collector.recordRun(createVictoryResult({ finalSol: 100 }));
        collector.recordRun(createVictoryResult({ finalSol: 200 }));
        collector.recordRun(createVictoryResult({ finalSol: 300 }));

        const stats = collector.getStats();
        expect(stats.stdDevTimeToWin).toBeCloseTo(81.65, 1);
      });

      it("calculates fastest and slowest win", () => {
        collector.recordRun(createVictoryResult({ finalSol: 150 }));
        collector.recordRun(createVictoryResult({ finalSol: 250 }));
        collector.recordRun(createVictoryResult({ finalSol: 350 }));

        const stats = collector.getStats();
        expect(stats.fastestWin).toBe(150);
        expect(stats.slowestWin).toBe(350);
      });

      it("tracks victory breakdown by type", () => {
        collector.recordRun(createVictoryResult({ victoryType: "earth_relief_compact" }));
        collector.recordRun(createVictoryResult({ victoryType: "earth_relief_compact" }));
        collector.recordRun(createVictoryResult({ victoryType: "declaration_of_sovereignty" }));

        const stats = collector.getStats();
        expect(stats.victoryBreakdown.earth_relief_compact).toBe(2);
        expect(stats.victoryBreakdown.declaration_of_sovereignty).toBe(1);
      });
    });

    describe("with only defeats", () => {
      it("calculates 0% win rate", () => {
        collector.recordRun(createDefeatResult());
        collector.recordRun(createDefeatResult());

        const stats = collector.getStats();
        expect(stats.winRate).toBe(0);
        expect(stats.totalRuns).toBe(2);
      });

      it("returns zero for win timing stats with no victories", () => {
        collector.recordRun(createDefeatResult());
        collector.recordRun(createDefeatResult());

        const stats = collector.getStats();
        expect(stats.avgTimeToWin).toBe(0);
        expect(stats.stdDevTimeToWin).toBe(0);
        expect(stats.fastestWin).toBe(0);
        expect(stats.slowestWin).toBe(0);
      });

      it("tracks defeat breakdown by reason", () => {
        collector.recordRun(createDefeatResult({ defeatReason: "starvation" }));
        collector.recordRun(createDefeatResult({ defeatReason: "starvation" }));
        collector.recordRun(createDefeatResult({ defeatReason: "suffocation" }));
        collector.recordRun(createDefeatResult({ defeatReason: "population_collapse" }));

        const stats = collector.getStats();
        expect(stats.defeatBreakdown.starvation).toBe(2);
        expect(stats.defeatBreakdown.suffocation).toBe(1);
        expect(stats.defeatBreakdown.population_collapse).toBe(1);
      });
    });

    describe("with mixed results", () => {
      it("calculates correct win rate", () => {
        // 7 victories, 3 defeats = 70% win rate
        for (let i = 0; i < 7; i++) {
          collector.recordRun(createVictoryResult());
        }
        for (let i = 0; i < 3; i++) {
          collector.recordRun(createDefeatResult());
        }

        const stats = collector.getStats();
        expect(stats.winRate).toBe(0.7);
        expect(stats.totalRuns).toBe(10);
      });

      it("only uses victories for time-to-win calculations", () => {
        collector.recordRun(createVictoryResult({ finalSol: 200 }));
        collector.recordRun(createVictoryResult({ finalSol: 300 }));
        collector.recordRun(createDefeatResult({ finalSol: 50 })); // Should be ignored

        const stats = collector.getStats();
        expect(stats.avgTimeToWin).toBe(250);
        expect(stats.fastestWin).toBe(200);
        expect(stats.slowestWin).toBe(300);
      });
    });

    describe("edge cases", () => {
      it("handles single victory", () => {
        collector.recordRun(createVictoryResult({ finalSol: 150 }));

        const stats = collector.getStats();
        expect(stats.totalRuns).toBe(1);
        expect(stats.winRate).toBe(1);
        expect(stats.avgTimeToWin).toBe(150);
        expect(stats.stdDevTimeToWin).toBe(0); // No std dev with single value
        expect(stats.fastestWin).toBe(150);
        expect(stats.slowestWin).toBe(150);
      });

      it("handles single defeat", () => {
        collector.recordRun(createDefeatResult({ defeatReason: "suffocation" }));

        const stats = collector.getStats();
        expect(stats.totalRuns).toBe(1);
        expect(stats.winRate).toBe(0);
        expect(stats.defeatBreakdown.suffocation).toBe(1);
      });

      it("handles two victories for std dev calculation", () => {
        collector.recordRun(createVictoryResult({ finalSol: 100 }));
        collector.recordRun(createVictoryResult({ finalSol: 200 }));

        const stats = collector.getStats();
        // Mean = 150, deviations = -50, 50, squared = 2500, 2500
        // Variance = 5000/2 = 2500, stddev = 50
        expect(stats.stdDevTimeToWin).toBe(50);
      });
    });
  });

  describe("printSummary", () => {
    it("prints summary with victories and defeats", () => {
      const consoleSpy = spyOn(console, "log");

      collector.recordRun(
        createVictoryResult({ finalSol: 200, victoryType: "earth_relief_compact" }),
      );
      collector.recordRun(
        createVictoryResult({ finalSol: 300, victoryType: "earth_relief_compact" }),
      );
      collector.recordRun(createDefeatResult({ defeatReason: "starvation" }));

      collector.printSummary();

      const calls = consoleSpy.mock.calls.map((c) => c[0]);

      expect(calls.some((c) => c.includes("3 runs"))).toBe(true);
      expect(calls.some((c) => c.includes("67%"))).toBe(true); // 2/3 win rate
      expect(calls.some((c) => c.includes("2 victories"))).toBe(true);
      expect(calls.some((c) => c.includes("1 defeats"))).toBe(true);
      expect(calls.some((c) => c.includes("Average Time to Win"))).toBe(true);
      expect(calls.some((c) => c.includes("Fastest Win"))).toBe(true);
      expect(calls.some((c) => c.includes("Starvation"))).toBe(true);
      expect(calls.some((c) => c.includes("Earth Relief Compact"))).toBe(true);

      consoleSpy.mockRestore();
    });

    it("handles all defeats (no time-to-win stats)", () => {
      const consoleSpy = spyOn(console, "log");

      collector.recordRun(createDefeatResult({ defeatReason: "starvation" }));
      collector.recordRun(createDefeatResult({ defeatReason: "suffocation" }));

      collector.printSummary();

      const calls = consoleSpy.mock.calls.map((c) => c[0]);

      expect(calls.some((c) => c.includes("0%"))).toBe(true);
      expect(calls.some((c) => c.includes("0 victories"))).toBe(true);
      expect(calls.some((c) => c.includes("2 defeats"))).toBe(true);
      // Should not print time-to-win stats
      expect(calls.some((c) => c.includes("Average Time to Win"))).toBe(false);

      consoleSpy.mockRestore();
    });

    it("handles all victories (no defeat breakdown)", () => {
      const consoleSpy = spyOn(console, "log");

      collector.recordRun(createVictoryResult({ victoryType: "earth_relief_compact" }));
      collector.recordRun(createVictoryResult({ victoryType: "earth_relief_compact" }));

      collector.printSummary();

      const calls = consoleSpy.mock.calls.map((c) => c[0]);

      expect(calls.some((c) => c.includes("100%"))).toBe(true);
      expect(calls.some((c) => c.includes("Defeat Breakdown"))).toBe(false);

      consoleSpy.mockRestore();
    });

    it("formats defeat reasons correctly", () => {
      const consoleSpy = spyOn(console, "log");

      collector.recordRun(createDefeatResult({ defeatReason: "population_collapse" }));

      collector.printSummary();

      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      expect(calls.some((c) => c.includes("Population Collapse"))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe("toJSON", () => {
    it("exports valid JSON with stats and runs", () => {
      collector.recordRun(createVictoryResult({ seed: 12345 }));
      collector.recordRun(createDefeatResult({ seed: 67890 }));

      const json = collector.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.stats).toBeDefined();
      expect(parsed.stats.totalRuns).toBe(2);
      expect(parsed.stats.winRate).toBe(0.5);

      expect(parsed.runs).toBeDefined();
      expect(parsed.runs).toHaveLength(2);
      expect(parsed.runs[0].seed).toBe(12345);
      expect(parsed.runs[1].seed).toBe(67890);
    });

    it("exports empty data for empty collector", () => {
      const json = collector.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.stats.totalRuns).toBe(0);
      expect(parsed.runs).toEqual([]);
    });

    it("produces formatted JSON with indentation", () => {
      collector.recordRun(createVictoryResult());

      const json = collector.toJSON();
      expect(json).toContain("\n"); // Has newlines
      expect(json).toContain("  "); // Has indentation
    });
  });

  describe("clear", () => {
    it("removes all recorded results", () => {
      collector.recordRun(createVictoryResult());
      collector.recordRun(createDefeatResult());

      expect(collector.getResults()).toHaveLength(2);

      collector.clear();

      expect(collector.getResults()).toHaveLength(0);
      expect(collector.getStats().totalRuns).toBe(0);
    });
  });

  describe("getResults", () => {
    it("returns readonly array", () => {
      collector.recordRun(createVictoryResult());

      const results = collector.getResults();
      // TypeScript readonly prevents direct mutations
      expect(results).toHaveLength(1);
    });
  });

  describe("statistical accuracy", () => {
    it("calculates win rate as decimal (0-1 range)", () => {
      collector.recordRun(createVictoryResult());
      collector.recordRun(createDefeatResult());

      const stats = collector.getStats();
      expect(stats.winRate).toBe(0.5);
      expect(stats.winRate).toBeGreaterThanOrEqual(0);
      expect(stats.winRate).toBeLessThanOrEqual(1);
    });

    it("handles large number of runs", () => {
      // Add 100 victories and 50 defeats
      for (let i = 0; i < 100; i++) {
        collector.recordRun(createVictoryResult({ finalSol: 200 + i }));
      }
      for (let i = 0; i < 50; i++) {
        collector.recordRun(createDefeatResult());
      }

      const stats = collector.getStats();
      expect(stats.totalRuns).toBe(150);
      expect(stats.winRate).toBeCloseTo(0.667, 2);
      expect(stats.fastestWin).toBe(200);
      expect(stats.slowestWin).toBe(299);
    });

    it("calculates std dev correctly for known values", () => {
      // Test with known values: 2, 4, 4, 4, 5, 5, 7, 9
      // Mean = 5, Population variance = 4, std dev = 2
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      for (const v of values) {
        collector.recordRun(createVictoryResult({ finalSol: v }));
      }

      const stats = collector.getStats();
      expect(stats.avgTimeToWin).toBe(5);
      expect(stats.stdDevTimeToWin).toBe(2);
    });
  });
});
