# Split Timeline Charts Design

## Problem

The current resource timeline visualization has scale issues:
- Morale/cohesion (0-100) are dwarfed by resources (10,000s)
- Materials has different dynamics (accumulate/spend) than survival resources (steady consumption)
- Single shared y-axis makes trends hard to read
- Shows single run, not typical progression across many runs

## Goal

Show typical game pacing with percentile bands to reveal where variance occurs, using separate charts for metrics with different scales and behaviors.

## Design

### Chart Structure

Four vertically stacked charts with shared x-axis (sols):

1. **Survival Resources** (~180px height)
   - Lines: food, oxygen, water, power
   - Y-axis: Raw units, auto-scaled to data max

2. **Materials** (~120px height)
   - Single line: materials
   - Y-axis: Auto-scaled (shows accumulation/spend cycles)

3. **Colony Health** (~120px height)
   - Lines: morale, cohesion
   - Y-axis: Fixed 0-100%

4. **Population** (~120px height)
   - Single line: population
   - Y-axis: Auto-scaled

### Data Representation

Each metric shows:
- **Median line**: Solid 2px stroke
- **P25-P75 band**: Shaded area with ~20% opacity

This reveals both typical progression and variance without clutter.

### Data Aggregation

Current `resourceTimeline` stores snapshots from one run. New approach aggregates across all runs:

```typescript
interface AggregatedSnapshot {
  sol: number;
  food: { median: number; p25: number; p75: number };
  oxygen: { median: number; p25: number; p75: number };
  water: { median: number; p25: number; p75: number };
  power: { median: number; p25: number; p75: number };
  materials: { median: number; p25: number; p75: number };
  population: { median: number; p25: number; p75: number };
  morale: { median: number; p25: number; p75: number };
  socialCohesion: { median: number; p25: number; p75: number };
  runsActive: number; // how many runs were still going at this sol
}
```

**Aggregation logic:**
- For each sol checkpoint (0, 50, 100, ...):
  - Collect values from all runs that reached that sol
  - Compute median, P25, P75 for each metric
- `runsActive` tracks sample size as runs end at different times

### Visual Design

- Shaded P25-P75 band at ~20% opacity
- Median line solid 2px on top of band
- Existing color scheme per metric
- X-axis labels only on bottom chart
- Y-axis on left of each chart
- Legend integrated or to the right

### Layout

```
┌─────────────────────────────────────┐
│ Survival Resources        [legend] │
│ ▓▓▓▓░░░░░▓▓▓▓▓░░░░░░▓▓▓▓░░░░░░░░░ │  ~180px
│                                     │
├─────────────────────────────────────┤
│ Materials                           │
│ ░░░▓▓▓▓▓▓░░░░░▓▓▓▓▓░░░░░░░░░░░░░░ │  ~120px
├─────────────────────────────────────┤
│ Colony Health                       │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ~120px
├─────────────────────────────────────┤
│ Population                          │
│ ░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ │  ~120px
│           sols →                    │
└─────────────────────────────────────┘
```

## Implementation

### Files to Modify

1. **`src/simulation/types.ts`**
   - Add `PercentileValue` type: `{ median, p25, p75 }`
   - Add `AggregatedSnapshot` type
   - Update `AnalysisOutput` to include `aggregatedTimeline: AggregatedSnapshot[]`

2. **`scripts/analyze-simulation.ts`**
   - Collect per-run timelines during simulation
   - After all runs, compute percentiles at each sol
   - Output both raw (backward compat) and aggregated data

3. **`src/visualization/charts/timeline.ts`**
   - Refactor to render four stacked charts
   - Each chart: shaded band + median line
   - Use `aggregatedTimeline` data

4. **`src/visualization/app.ts`**
   - Adjust container sizing for taller timeline section

### Future Enhancements (not in scope)

- Hover crosshair across all charts
- Reference lines (victory threshold, crisis thresholds)
- Toggle individual metrics on/off
- Comparison mode with two batches
