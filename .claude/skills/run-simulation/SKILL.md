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
| `seedOffset` | 0             | Added to each seed (`1+offset … runs+offset`). For an INDEPENDENT validation set it must be ≥ `runs` — a small offset mostly overlaps the default set |

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
4. **Validate with a second, non-overlapping seed set** (`seedOffset` ≥ `runs`, e.g. 1000) before trusting a number.

**Picking a difficulty:** target ≈ `totalValue.mean − 0.8 × margin.stdev` lands near an 80% win rate; verify by simulation.

## Limitations

- The AI uses a multi-step greedy policy each turn: (1) builds the column with the highest **marginal (leveled)** value, (2) multi-card commit (straight, full-house, four-of-a-kind, three-of-a-kind, two-pair, pair — lands first, then roles), (3) single-card placement, (4) store one land toward a straight, (5) end turn. It never replaces stored cards (no-churn rule). Pattern zeros in the output indicate **deck-composition limits**, not AI limits — e.g. Generation Ship's 2-ideology deck rules out trips/quads/full-house entirely; straight-flush and royal-flush require card distributions the starting decks rarely provide.
- Simulates a single Epoch from a fresh deck: no Legacy cards, no cross-Epoch effects.

## Common Mistakes

- Comparing runs that used different `runs` or `seedOffset` values.
- "Validating" with a small seedOffset — offset 7 with 500 runs shares 493 seeds with the default set, so agreement proves nothing.
- Tuning from a 50-run sample — differences under ~5 points of win rate are noise at that size.
- Reading the heuristic win rate as the expected human win rate.
