---
name: run-simulation
description: Use when validating game balance after changing crisis difficulty, project values, card effects, rules (handSize, maxTurns, influenceBaseline), or starting-deck filters — or when asked whether a Setting is winnable or too easy/hard.
---

# Run Simulation

## Overview

`scripts/analyze-crisis.ts` Monte-Carlos single Epochs with a greedy heuristic AI and prints one JSON report. It is the project's only balance simulator.

**Announce at start:** "I'm using run-simulation to test game balance."

## Command

```bash
bun run scripts/analyze-crisis.ts [runs] [settingId] [seedOffset]
```

| Arg          | Default       | Notes                                                    |
| ------------ | ------------- | -------------------------------------------------------- |
| `runs`       | 50            | Use 300–500 for tuning decisions; 50 is noisy (±5%+)     |
| `settingId`  | `homeworld`   | `homeworld` \| `generation-ship` \| `ruined-homeworld`   |
| `seedOffset` | 0             | Different offset = independent seed set; use to validate |

No flags, no log files — output is JSON on stdout only.

## Output Fields

| Field                                    | Meaning                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `winRate`                                | Fraction of runs where total project value ≥ difficulty     |
| `margin` (mean/median/stdev/min/max)     | `totalValue − difficulty` per run                           |
| `totalValue` (mean/median)               | Crisis score distribution, independent of difficulty        |
| `avgUnlocksPerPattern`, `avgTotalUnlocks`| Which patterns the AI actually builds, per run              |
| `avgFirstUnlockTurn`                     | Pacing: when each pattern first lands                       |

## Healthy Ranges

- **Win rate 80–95%.** 100% = too easy; <70% = punishing. The greedy AI is a *floor* on human skill — real players land higher, so tune relative to the AI, not to a target human win rate.
- **`margin.min` should be negative** — if even the worst run wins, the Crisis is no threat.

## Workflow

For a **pure health check** (no change being made): run 300+ runs, validate with a second seed set, and compare against Healthy Ranges. Done.

For a **tuning loop**:

1. **Baseline first.** Run 300+ runs per affected Setting *before* changing values. To baseline against `main`, use a temp worktree: `git worktree add /tmp/baseline main` → run there → `git worktree remove /tmp/baseline --force`.
2. Make the change (see CLAUDE.md "Balance tuning quick reference" for where each knob lives).
3. Re-run with identical `runs`/`seedOffset` and compare.
4. **Validate with a second seed set** (e.g. `seedOffset 7`) before trusting a number.

**Picking a difficulty:** target ≈ `totalValue.mean − 0.8 × margin.stdev` lands near an 80% win rate; verify by simulation.

## Limitations

- The AI plays one card at a time and never uses `commitHand`. It can therefore build high-card, pair, two-pair, three/four-of-a-kind, and flushes (same-rank stacking only) — but **never straights, full-houses, straight-flushes, or royal-flushes**, which all need multi-card commits. Permanent zeros for those patterns are an AI limitation, not a bug; the AI underestimates the score ceiling where they matter. Per-Setting deck filters add their own zeros (e.g. Generation Ship's 2-ideology deck rules out three/four-of-a-kind entirely).
- Simulates a single Epoch from a fresh deck: no Legacy cards, no cross-Epoch effects.

## Common Mistakes

- Comparing runs that used different `runs` or `seedOffset` values.
- Tuning from a 50-run sample — differences under ~5 points of win rate are noise at that size.
- Reading the heuristic win rate as the expected human win rate.
