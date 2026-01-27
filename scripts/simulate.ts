#!/usr/bin/env bun
// scripts/simulate.ts
// CLI entry point for running Monte Carlo simulations

import { writeFileSync } from "node:fs";
import { SimulationRunner } from "../src/simulation";
import type { SimulationConfig } from "../src/simulation";

/**
 * Parse command line arguments.
 * Supports:
 *   --runs N      Number of simulation runs (default: 100)
 *   --seed N      Optional seed for reproducibility
 *   --output FILE Write results to JSON file
 *   --verbose     Print progress during simulation
 *   --help        Show usage information
 */
function parseArgs(): {
  runs: number;
  seed?: number;
  output?: string;
  verbose: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    runs: 100,
    seed: undefined as number | undefined,
    output: undefined as string | undefined,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (arg === "--runs" || arg === "-r") {
      const value = args[++i];
      if (value === undefined || Number.isNaN(Number.parseInt(value, 10))) {
        console.error("Error: --runs requires a numeric argument");
        process.exit(1);
      }
      result.runs = Number.parseInt(value, 10);
      if (result.runs <= 0) {
        console.error("Error: --runs must be a positive number");
        process.exit(1);
      }
    } else if (arg === "--seed" || arg === "-s") {
      const value = args[++i];
      if (value === undefined || Number.isNaN(Number.parseInt(value, 10))) {
        console.error("Error: --seed requires a numeric argument");
        process.exit(1);
      }
      result.seed = Number.parseInt(value, 10);
    } else if (arg === "--output" || arg === "-o") {
      const value = args[++i];
      if (value === undefined) {
        console.error("Error: --output requires a file path argument");
        process.exit(1);
      }
      result.output = value;
    } else if (arg?.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  return result;
}

/**
 * Print usage information.
 */
function printHelp(): void {
  console.log(`
Monte Carlo Simulation Runner for Space Colony Game

Usage: bun run simulate [options]

Options:
  --runs N, -r N       Number of simulation runs (default: 100)
  --seed N, -s N       Seed for reproducible random sequences
  --output FILE, -o    Write results to JSON file
  --verbose, -v        Print progress during simulation
  --help, -h           Show this help message

Examples:
  bun run simulate                           # 100 runs, console output
  bun run simulate --runs 500                # 500 runs
  bun run simulate --runs 1 --seed 12345 --verbose  # Debug single run
  bun run simulate --runs 100 --output results.json # Export to file
`);
}

/**
 * Main entry point.
 */
function main(): void {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Build simulation config
  const config: SimulationConfig = {
    runs: args.runs,
    seed: args.seed,
    verbose: args.verbose,
  };

  console.log(`Starting simulation with ${config.runs} runs...`);
  if (config.seed !== undefined) {
    console.log(`Using seed: ${config.seed}`);
  }
  console.log("");

  // Run simulation
  const startTime = Date.now();
  const runner = new SimulationRunner(config);
  // Use runWithDetails to capture individual runs for JSON export
  const { stats, runs } = runner.runWithDetails();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("");
  console.log(`Simulation completed in ${elapsed}s`);
  console.log("");

  // Calculate victories from breakdown to avoid rounding errors
  const victories = Object.values(stats.victoryBreakdown).reduce((a, b) => a + b, 0);
  const defeats = stats.totalRuns - victories;

  console.log(`=== Simulation Results (${stats.totalRuns} runs) ===`);
  console.log(
    `Win Rate: ${(stats.winRate * 100).toFixed(0)}% (${victories} victories, ${defeats} defeats)`,
  );

  if (victories > 0) {
    console.log(
      `Average Time to Win: ${stats.avgTimeToWin.toFixed(0)} sols (std dev = ${stats.stdDevTimeToWin.toFixed(0)})`,
    );
    console.log(`Fastest Win: ${stats.fastestWin} sols | Slowest Win: ${stats.slowestWin} sols`);
  }

  // Defeat breakdown
  if (defeats > 0) {
    console.log("\nDefeat Breakdown:");
    const defeatNames: Record<string, string> = {
      starvation: "Starvation",
      suffocation: "Suffocation",
      population_collapse: "Population Collapse",
    };
    for (const [reason, count] of Object.entries(stats.defeatBreakdown)) {
      const percentage = ((count / defeats) * 100).toFixed(0);
      const displayName = defeatNames[reason] ?? reason;
      console.log(`  - ${displayName}: ${percentage}%`);
    }
  }

  // Victory breakdown
  if (victories > 0) {
    console.log("\nVictory Breakdown:");
    const victoryNames: Record<string, string> = {
      colony_charter: "Colony Charter",
      population: "Population (100)",
      generation_ship: "Generation Ship",
    };
    for (const [type, count] of Object.entries(stats.victoryBreakdown)) {
      const percentage = ((count / victories) * 100).toFixed(0);
      const displayName = victoryNames[type] ?? type;
      console.log(`  - ${displayName}: ${percentage}%`);
    }
  }

  // Write to file if requested
  if (args.output) {
    const outputData = {
      stats,
      runs, // Include individual run data with enhanced tracking
      config: {
        runs: args.runs,
        seed: args.seed,
        verbose: args.verbose,
      },
      timestamp: new Date().toISOString(),
    };
    try {
      writeFileSync(args.output, JSON.stringify(outputData, null, 2));
      console.log(`\nResults written to: ${args.output}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\nError writing results to ${args.output}: ${message}`);
      process.exit(1);
    }
  }
}

// Run main
main();
