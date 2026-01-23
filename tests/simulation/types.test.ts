import { describe, it, expect } from "bun:test";
import type {
  SimulationConfig,
  RunResult,
  AggregateStats,
  VictoryType,
  DefeatReason,
  RunOutcome,
} from "../../src/simulation/types";

describe("simulation/types", () => {
  describe("SimulationConfig", () => {
    it("accepts minimal configuration with only runs", () => {
      const config: SimulationConfig = {
        runs: 100,
      };
      expect(config.runs).toBe(100);
      expect(config.seed).toBeUndefined();
      expect(config.verbose).toBeUndefined();
    });

    it("accepts full configuration with all options", () => {
      const config: SimulationConfig = {
        runs: 1000,
        seed: 42,
        verbose: true,
      };
      expect(config.runs).toBe(1000);
      expect(config.seed).toBe(42);
      expect(config.verbose).toBe(true);
    });
  });

  describe("RunResult", () => {
    it("represents a victory result", () => {
      const result: RunResult = {
        seed: 12345,
        outcome: "victory",
        victoryType: "population",
        finalSol: 250,
        peakPopulation: 100,
        techsResearched: ["hydroponics", "water_recycling"],
        buildingsBuilt: { habitat: 5, farm: 3, solar_panel: 4 },
      };

      expect(result.outcome).toBe("victory");
      expect(result.victoryType).toBe("population");
      expect(result.defeatReason).toBeUndefined();
    });

    it("represents a generation ship victory", () => {
      const result: RunResult = {
        seed: 67890,
        outcome: "victory",
        victoryType: "generation_ship",
        finalSol: 500,
        peakPopulation: 85,
        techsResearched: ["advanced_materials", "robotics", "generation_ship"],
        buildingsBuilt: { research_lab: 2, factory: 3 },
      };

      expect(result.victoryType).toBe("generation_ship");
    });

    it("represents a defeat result from starvation", () => {
      const result: RunResult = {
        seed: 11111,
        outcome: "defeat",
        defeatReason: "starvation",
        finalSol: 45,
        peakPopulation: 12,
        techsResearched: [],
        buildingsBuilt: { habitat: 1 },
      };

      expect(result.outcome).toBe("defeat");
      expect(result.defeatReason).toBe("starvation");
      expect(result.victoryType).toBeUndefined();
    });

    it("represents a defeat result from suffocation", () => {
      const result: RunResult = {
        seed: 22222,
        outcome: "defeat",
        defeatReason: "suffocation",
        finalSol: 30,
        peakPopulation: 10,
        techsResearched: ["hydroponics"],
        buildingsBuilt: { farm: 2 },
      };

      expect(result.defeatReason).toBe("suffocation");
    });

    it("represents a defeat result from population collapse", () => {
      const result: RunResult = {
        seed: 33333,
        outcome: "defeat",
        defeatReason: "population_collapse",
        finalSol: 150,
        peakPopulation: 25,
        techsResearched: ["water_recycling"],
        buildingsBuilt: { habitat: 2, water_extractor: 1 },
      };

      expect(result.defeatReason).toBe("population_collapse");
    });
  });

  describe("AggregateStats", () => {
    it("represents aggregate statistics from multiple runs", () => {
      const stats: AggregateStats = {
        totalRuns: 1000,
        winRate: 0.72,
        avgTimeToWin: 280,
        stdDevTimeToWin: 45.5,
        defeatBreakdown: {
          starvation: 150,
          suffocation: 80,
          population_collapse: 50,
        },
        victoryBreakdown: {
          population: 650,
          generation_ship: 70,
        },
        fastestWin: 180,
        slowestWin: 450,
      };

      expect(stats.totalRuns).toBe(1000);
      expect(stats.winRate).toBe(0.72);
      expect(stats.defeatBreakdown.starvation).toBe(150);
      expect(stats.victoryBreakdown.population).toBe(650);
    });

    it("handles zero wins correctly", () => {
      const stats: AggregateStats = {
        totalRuns: 10,
        winRate: 0,
        avgTimeToWin: 0,
        stdDevTimeToWin: 0,
        defeatBreakdown: {
          starvation: 5,
          suffocation: 3,
          population_collapse: 2,
        },
        victoryBreakdown: {},
        fastestWin: 0,
        slowestWin: 0,
      };

      expect(stats.winRate).toBe(0);
      expect(stats.fastestWin).toBe(0);
    });

    it("allows partial breakdowns with only outcomes that occurred", () => {
      const stats: AggregateStats = {
        totalRuns: 50,
        winRate: 0.8,
        avgTimeToWin: 300,
        stdDevTimeToWin: 30,
        defeatBreakdown: {
          starvation: 10,
        },
        victoryBreakdown: {
          population: 40,
        },
        fastestWin: 250,
        slowestWin: 400,
      };

      expect(stats.defeatBreakdown.starvation).toBe(10);
      expect(stats.defeatBreakdown.suffocation).toBeUndefined();
      expect(stats.victoryBreakdown.population).toBe(40);
      expect(stats.victoryBreakdown.generation_ship).toBeUndefined();
    });
  });

  describe("Type aliases", () => {
    it("VictoryType covers all victory conditions", () => {
      const types: VictoryType[] = ["population", "generation_ship"];
      expect(types).toHaveLength(2);
    });

    it("DefeatReason covers all defeat conditions", () => {
      const reasons: DefeatReason[] = [
        "starvation",
        "suffocation",
        "population_collapse",
      ];
      expect(reasons).toHaveLength(3);
    });

    it("RunOutcome covers victory and defeat", () => {
      const outcomes: RunOutcome[] = ["victory", "defeat"];
      expect(outcomes).toHaveLength(2);
    });
  });
});
