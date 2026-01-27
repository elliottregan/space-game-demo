# Simulation Visualizer Design

## Overview

A standalone web application for visualizing Monte Carlo simulation results. Serves static visual reports and enables comparison between simulation batches to evaluate balance changes.

## Goals

1. **Visual reports** - Generate charts and graphs from simulation data
2. **Batch comparison** - Compare two simulation runs side-by-side to see impact of changes

## Architecture

### File Structure

```
scripts/
  visualize.ts              # Server entry point
src/
  visualization/
    index.html              # Main HTML shell
    app.ts                  # Vue app initialization
    components/
      VisualizationApp.vue  # Main layout
      BatchSelector.vue     # Load/compare batches
      VictoryHistogram.vue  # Victory time distribution
      ResourceTimelines.vue # Resource line charts
      CrisisHeatmap.vue     # Crisis occurrence heatmap
      ProgressionChart.vue  # Tech/building timing
      ComparisonChart.vue   # Win rate bar charts
    services/
      DataLoader.ts         # Parse analysis logs
    types.ts                # Shared type definitions
```

### How It Works

1. `bun run visualize` starts a server on `localhost:3001`
2. Server scans `logs/simulations/` for analysis files
3. Frontend fetches file list via `/api/logs`
4. User selects 1-2 batches to visualize
5. Frontend fetches raw data via `/api/logs/:filename`
6. D3 renders charts based on parsed data

### Key Decisions

- Vue 3 for UI consistency with the main game
- D3.js for charts (already a dependency)
- No build step needed - Bun serves TypeScript directly
- Comparison mode overlays two batches on the same charts

## Data Format

### JSON Output

Modify `analyze-simulation.ts` to output both:
- Human-readable `.txt` (existing behavior)
- Machine-readable `.json` (new, for visualization)

```typescript
interface AnalysisOutput {
  metadata: {
    timestamp: string;
    runs: number;
    seed: number;
  };
  summary: {
    winRate: number;
    victories: number;
    defeats: number;
    victoryTypes: Record<string, number>;
    defeatReasons: Record<string, number>;
  };
  victoryTimes: number[];
  peakPopulations: number[];
  techFrequency: Record<string, number>;
  buildingCounts: Record<string, number>;

  // Aggregated timeline data (averaged across runs)
  resourceTimeline: ResourceSnapshot[];
  crisisEvents: CrisisPoint[];

  // Per-run data for detailed analysis
  runs: RunResult[];
}
```

## Visualizations

### 1. Victory Histogram

- X-axis: Sol ranges (0-500, 500-600, 600-700, etc.)
- Y-axis: Number of runs
- Interactive: Hover shows exact count
- Comparison mode: Two overlaid histograms with different colors + legend

### 2. Resource Timelines

- Multi-line chart with toggleable resources (food, oxygen, water, power, materials)
- X-axis: Sol, Y-axis: Resource amount
- Shows mean line with shaded confidence interval (+/- 1 std dev)
- Comparison mode: Solid lines for batch A, dashed for batch B

### 3. Crisis Heatmap

- Grid: Rows = crisis types (low_food, low_oxygen, etc.), Columns = sol buckets
- Cell color intensity = frequency of crisis events
- Distinguishes warning (yellow) vs critical (red)
- Comparison mode: Side-by-side heatmaps

### 4. Progression Chart

- Horizontal bar chart showing median sol when each tech/building is first acquired
- Sorted by timing (earliest first)
- Error bars showing 25th-75th percentile range
- Comparison mode: Grouped bars for each item

### 5. Comparison Chart

- Bar chart comparing key metrics: win rate, avg victory time, avg peak population
- Only visible when two batches are loaded
- Shows percentage change between batches

## UI Layout

```
+-------------------------------------------------------------+
|  Simulation Analysis Viewer                                 |
+-------------------------------------------------------------+
|  Batch A: [dropdown]       Batch B: [dropdown] (optional)   |
|  -----------------------------------------------------------+
|                                                             |
|  +---------------------+  +-----------------------------+   |
|  |  Summary Cards      |  |  Win Rate / Defeats         |   |
|  |  (runs, win%, time) |  |  (pie or donut)             |   |
|  +---------------------+  +-----------------------------+   |
|                                                             |
|  +-------------------------------------------------------+  |
|  |  Victory Time Histogram                               |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  +-------------------------------------------------------+  |
|  |  Resource Timelines (tabbed: all / food / etc)        |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  +---------------------+  +-----------------------------+   |
|  |  Crisis Heatmap     |  |  Tech/Building Progress     |   |
|  +---------------------+  +-----------------------------+   |
|                                                             |
|  +-------------------------------------------------------+  |
|  |  Comparison Summary (only when 2 batches loaded)      |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

## Interactions

- Dropdowns populate from `/api/logs` (sorted by date, newest first)
- Selecting Batch A loads and renders all charts
- Selecting Batch B overlays comparison data
- Clear button on Batch B to return to single-batch view
- Consistent color scheme: Batch A = blue tones, Batch B = orange tones

## Styling

- Dark theme (matches game aesthetic)
- Reuse CSS variables from main app where possible
- Responsive but optimized for desktop (1200px+ width)

## Implementation Notes

### Package.json Addition

```json
{
  "scripts": {
    "visualize": "bun run scripts/visualize.ts"
  }
}
```

### Server Endpoints

- `GET /` - Serve index.html
- `GET /api/logs` - List available log files
- `GET /api/logs/:filename` - Fetch specific log data (JSON)
