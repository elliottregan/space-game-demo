# Monte Carlo Playtest Simulation Design

## Goal

Run automated playtest simulations to answer balance validation questions:
- Is the game winnable?
- What's the typical time-to-win?
- Where do players fail most often?

## Architecture

```
┌─────────────────────────────────────────────────┐
│             SimulationRunner                    │
│  - runs N games sequentially                    │
│  - seeds RNG for reproducibility                │
│  - outputs summary statistics                   │
└──────────────────┬──────────────────────────────┘
                   │ creates
                   ▼
┌─────────────────────────────────────────────────┐
│              GameAPI instance                   │
│  (one per simulation run)                       │
└──────────────────┬──────────────────────────────┘
                   │ queries/commands
                   ▼
┌─────────────────────────────────────────────────┐
│            HeuristicStrategy                    │
│  - survival rules (food/oxygen first)           │
│  - growth rules (population, tech)              │
│  - event resolution (pick "safest" option)      │
└─────────────────────────────────────────────────┘
```

## Heuristic Strategy Rules

The strategy evaluates priorities each sol and takes the highest-priority available action. Rules are ordered by survival → stability → growth → victory.

### Priority 1: Survival (check every tick)

```
IF food < 50 AND can build "farm" → build farm
IF oxygen < 50 AND can build "oxygen_generator" → build oxygen generator
IF food production ≤ consumption → build farm
IF oxygen production ≤ consumption → build oxygen generator
```

### Priority 2: Event Resolution (blocking)

```
IF active event exists:
  - Pick choice that gives most resources, OR
  - Pick choice that avoids population loss, OR
  - Pick first choice (fallback)
```

### Priority 3: Infrastructure

```
IF no research active AND can afford any tech → start cheapest available
IF power production < consumption + 20 → build solar panel
IF materials < 100 AND can build mine → build mine
```

### Priority 4: Growth

```
IF population < 100 AND morale > 60 AND can build habitat → build habitat
IF can afford next tech tier → research it
```

### Priority 5: Victory Push

```
IF "generation_ship" available → research it
IF close to 100 pop AND can boost growth → prioritize habitats
```

## Metrics Collection

### Per-run metrics

```typescript
interface RunResult {
  seed: number;
  outcome: "victory" | "defeat";
  victoryType?: "population" | "generation_ship";
  defeatReason?: "starvation" | "suffocation" | "population_collapse";
  finalSol: number;
  peakPopulation: number;
  techsResearched: string[];
  buildingsBuilt: Record<string, number>;
}
```

### Aggregate statistics

- Win rate: X% victory, Y% defeat
- Average time to win: N sols (std dev: M)
- Defeat breakdown by cause
- Victory breakdown by type
- Fastest/slowest win
- Common failure point (sol range)

### Output format

- Console summary for quick reads
- JSON file with full run data for deeper analysis

## File Structure

```
src/simulation/
├── SimulationRunner.ts    # Orchestrates runs
├── HeuristicStrategy.ts   # Decision-making logic
├── MetricsCollector.ts    # Tracks and aggregates data
├── types.ts               # SimulationConfig, RunResult, etc.
└── index.ts               # CLI entry point

scripts/
└── simulate.ts            # bun run script entry
```

## CLI Interface

```bash
# Run 100 simulations with default heuristics
bun run simulate

# Run 500 simulations, output to file
bun run simulate --runs 500 --output results.json

# Run with specific seed for debugging
bun run simulate --seed 12345 --runs 1 --verbose
```

## Victory/Defeat Conditions

**Victory:**
- Research "generation_ship" technology, OR
- Reach 100 population

**Defeat:**
- Population drops below 5
- Food reaches 0 (starvation)
- Oxygen reaches 0 (suffocation)

## Implementation Notes

- Each simulation run uses a fresh `GameAPI` instance
- Runs execute sequentially (game logic is fast, <100ms per run)
- Game stops advancing on active events; strategy must resolve them
- RNG seeding enables reproducible runs for debugging
