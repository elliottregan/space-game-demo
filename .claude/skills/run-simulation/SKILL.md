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

## Command

```bash
bun run simulate [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--runs N, -r N` | Number of simulation runs (default: 100) |
| `--seed N, -s N` | Starting seed for reproducibility (default: 1) |
| `--log LEVEL, -l` | Output level: `silent`, `default`, `verbose` |
| `--help, -h` | Show help message |

### Log Levels

| Level | Console | TXT File | JSON File |
|-------|---------|----------|-----------|
| `silent` | Yes | No | No |
| `default` | Yes | Yes | No |
| `verbose` | Yes | Yes | Yes (large) |

## Common Invocations

```bash
# Fast iteration (5 runs, no files)
bun run simulate --runs 5 --log silent

# Quick sanity check (50 runs, no files)
bun run simulate --runs 50 --log silent

# Standard run (100 runs, saves txt report)
bun run simulate

# Full analysis with json for visualization
bun run simulate --runs 200 --log verbose

# Reproducible run with specific seed
bun run simulate --runs 500 --seed 42
```

## Output Sections

1. **Victory Time Distribution** - Min, median, P90, P95, max victory times with histogram
2. **Peak Population Analysis** - Population statistics across all runs
3. **Technology Research Frequency** - Which techs are researched and how often
4. **Building Construction Patterns** - Average building counts per game
5. **Outlier Analysis** - Slow victories (>550 sols) analysis
6. **Critical Path Analysis** - Theoretical minimum vs actual minimum times
7. **Victory vs Defeat Comparison** - Key differences between winning and losing runs
8. **Correlation Analysis** - What factors correlate with victory
9. **Bottleneck Analysis** - What blocks the AI most often
10. **Event Impact Analysis** - Event frequency and effect on outcomes
11. **Crisis Timeline Analysis** - When resource/morale crises occur
12. **Social Cohesion Analysis** - Relationship network health metrics

## Interpreting Results

### Healthy Balance Indicators

| Metric | Healthy Range |
|--------|---------------|
| Win Rate | 80-95% |
| Median Victory | 500-1000 sols |
| Fastest Win | ~487 sols (theoretical minimum) |
| P90 Victory Time | <700 sols |

### Warning Signs

| Issue | Possible Cause |
|-------|----------------|
| Win rate <70% | Early game too harsh, resource rates too low |
| Win rate 100% | Game too easy, needs more challenge |
| Avg time >1000 sols | Victory conditions too difficult |
| Many starvation defeats | Food production insufficient |
| Many suffocation defeats | Oxygen production insufficient |
| High variance in times | Random events too impactful |

## Example Workflow

After making a balance change:

```bash
# 1. Fast check - does it still compile and run?
bun run simulate --runs 5 --log silent

# 2. Quick validation - is the game still winnable?
bun run simulate --runs 50 --log silent

# 3. Standard run - save results for review
bun run simulate

# 4. Full analysis with visualization data
bun run simulate --runs 200 --log verbose

# 5. Start visualizer to explore results
bun run visualize
```

## Output Files

Results are saved to `logs/simulations/` with timestamps:

- `simulation-{timestamp}-r{runs}-s{seed}.txt` - Human-readable report
- `simulation-{timestamp}-r{runs}-s{seed}.json` - Full data for visualization (verbose only)

## Technical Notes

- Simulations use `HeuristicStrategy` which mimics reasonable player decisions
- Each run uses an incrementing seed for reproducibility
- Games are capped at 5,000 sols to prevent infinite loops
- Uses parallel workers for faster execution on multi-core systems
- Victory conditions: Colony Charter (30 pop sustained), Population (100), Generation Ship
