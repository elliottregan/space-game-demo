---
name: run-simulation
description: Run Monte Carlo simulations to test game balance and strategy effectiveness
---

# Run Simulation

## Overview

Run Monte Carlo simulations of the game using the heuristic AI strategy to validate game balance, test changes, and analyze win rates.

**Announce at start:** "I'm using run-simulation to test game balance."

## When to Use

- After making balance changes (resource rates, building costs, tech requirements)
- After modifying victory/defeat conditions
- After changing AI strategy logic
- When asked to verify game is winnable
- When debugging why the AI loses or wins too fast

## Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `simulate` | `bun run simulate` | Quick Monte Carlo runs with summary stats |
| `simulate:analyze` | `bun run simulate:analyze` | Detailed analysis with histograms and patterns |

## Quick Simulation

Run basic simulation with default settings (100 runs):

```bash
bun run simulate
```

### Options

| Flag | Description |
|------|-------------|
| `--runs N, -r N` | Number of simulation runs (default: 100) |
| `--seed N, -s N` | Seed for reproducibility |
| `--output FILE, -o` | Write results to JSON file |
| `--verbose, -v` | Print progress during simulation |

### Common Invocations

```bash
# Quick sanity check
bun run simulate --runs 50

# Full test with reproducible seed
bun run simulate --runs 500 --seed 42

# Debug a specific run
bun run simulate --runs 1 --seed 12345 --verbose

# Export results for comparison
bun run simulate --runs 100 --output results.json
```

## Detailed Analysis

Run detailed analysis with victory time distribution, technology patterns, and building stats:

```bash
bun run simulate:analyze
```

### Options

| Flag | Description |
|------|-------------|
| `--runs N, -r N` | Number of simulation runs (default: 200) |
| `--seed N, -s N` | Starting seed (default: 1) |

### Output Sections

1. **Victory Time Distribution** - Min, median, P90, P95, max victory times with histogram
2. **Peak Population Analysis** - Population statistics across all runs
3. **Technology Research Frequency** - Which techs are researched and how often
4. **Building Construction Patterns** - Average building counts per game
5. **Outlier Analysis** - Slow victories (>550 sols) analysis
6. **Critical Path Analysis** - Theoretical minimum vs actual minimum times

## Interpreting Results

### Healthy Balance Indicators

| Metric | Healthy Range |
|--------|---------------|
| Win Rate | 90-100% |
| Average Time to Win | 480-550 sols |
| Fastest Win | ~487 sols (theoretical minimum) |
| P90 Victory Time | <600 sols |

### Warning Signs

| Issue | Possible Cause |
|-------|----------------|
| Win rate <90% | Early game too harsh, resource rates too low |
| Avg time >600 sols | Victory conditions too difficult |
| Many starvation defeats | Food production insufficient |
| Many suffocation defeats | Oxygen production insufficient |
| High variance in times | Random events too impactful |

## Example Workflow

After making a balance change:

```bash
# 1. Quick check - is the game still winnable?
bun run simulate --runs 100

# 2. If win rate looks good, run detailed analysis
bun run simulate:analyze --runs 200

# 3. Compare with previous results if you saved them
bun run simulate --runs 500 --output after-change.json
```

## Technical Notes

- Simulations use `HeuristicStrategy` which mimics reasonable player decisions
- Each run uses an incrementing seed for reproducibility
- Games are capped at 10,000 sols to prevent infinite loops
- Victory conditions: Colony Charter (30 pop sustained), Population (100), Generation Ship
