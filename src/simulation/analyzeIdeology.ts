// src/simulation/analyzeIdeology.ts
// Analyzes colonist ideology evolution over a single simulation run

import { rng } from "../core/utils/random";
import { GameAPI } from "../facade/GameAPI";
import { HeuristicStrategy } from "./HeuristicStrategy";
import type { ColonistIdeology } from "../core/models/Colonist";

const MAX_SOLS = 2000;
const SNAPSHOT_INTERVAL = 25; // Capture ideology every 25 sols

interface ColonistIdeologySnapshot {
  id: string;
  name: string;
  earthLoyalist: number;
  marsIndependence: number;
  corporateInterests: number;
  conviction: number;
  dominantFaction: string | null;
  ideologySpread: number; // max - min affinity (0 = uniform, higher = more polarized)
}

interface IdeologyTimepoint {
  sol: number;
  colonists: ColonistIdeologySnapshot[];
  populationCount: number;
  // Aggregate stats
  avgEarthLoyalist: number;
  avgMarsIndependence: number;
  avgCorporateInterests: number;
  avgConviction: number;
  colonistsWithDominant: number; // Count with clear dominant faction
  avgIdeologySpread: number;
}

interface IdeologyAnalysis {
  seed: number;
  finalSol: number;
  outcome: string;
  timeline: IdeologyTimepoint[];
  // Per-colonist tracking (for colonists present at start)
  foundingColonistTracking: Map<string, { name: string; snapshots: ColonistIdeologySnapshot[] }>;
}

function getDominantFaction(ideology: ColonistIdeology): string | null {
  const { earthLoyalist, marsIndependence, corporateInterests } = ideology;
  const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);
  const threshold = 0.15; // Must be 0.15 higher than others

  if (max < 0.3) return null; // Below neutral threshold

  const factions = [
    { name: "Earth Loyalists", value: earthLoyalist },
    { name: "Mars Independence", value: marsIndependence },
    { name: "Corporate Interests", value: corporateInterests },
  ];

  const sorted = factions.sort((a, b) => b.value - a.value);
  const first = sorted[0];
  const second = sorted[1];
  if (first && second && first.value - second.value >= threshold) {
    return first.name;
  }
  return null; // Mixed/no clear dominant
}

function getIdeologySpread(ideology: ColonistIdeology): number {
  const values = [ideology.earthLoyalist, ideology.marsIndependence, ideology.corporateInterests];
  return Math.max(...values) - Math.min(...values);
}

function captureColonistSnapshot(colonist: {
  id: string;
  name: string;
  ideology?: ColonistIdeology;
}): ColonistIdeologySnapshot | null {
  if (!colonist.ideology) return null;

  return {
    id: colonist.id,
    name: colonist.name,
    earthLoyalist: colonist.ideology.earthLoyalist,
    marsIndependence: colonist.ideology.marsIndependence,
    corporateInterests: colonist.ideology.corporateInterests,
    conviction: colonist.ideology.conviction,
    dominantFaction: getDominantFaction(colonist.ideology),
    ideologySpread: getIdeologySpread(colonist.ideology),
  };
}

function runIdeologyAnalysis(seed: number): IdeologyAnalysis {
  rng.seed(seed);
  const api = new GameAPI();
  const strategy = new HeuristicStrategy(api);

  const timeline: IdeologyTimepoint[] = [];
  const foundingColonistTracking = new Map<
    string,
    { name: string; snapshots: ColonistIdeologySnapshot[] }
  >();

  // Capture founding colonists
  const initialColony = api.colony.snapshot({ lightweight: true });
  for (const colonist of initialColony.colonists) {
    if (colonist.ideology) {
      foundingColonistTracking.set(colonist.id, { name: colonist.name, snapshots: [] });
    }
  }

  let solsRun = 0;
  while (!api.game.isGameOver() && solsRun < MAX_SOLS) {
    strategy.executeTick();
    api.game.advanceSol();
    solsRun++;

    const currentSol = api.game.currentSol();

    if (currentSol % SNAPSHOT_INTERVAL === 0) {
      const colony = api.colony.snapshot({ lightweight: true });
      const colonistSnapshots: ColonistIdeologySnapshot[] = [];

      let sumEarth = 0,
        sumMars = 0,
        sumCorp = 0,
        sumConviction = 0;
      let dominantCount = 0;
      let sumSpread = 0;
      let count = 0;

      for (const colonist of colony.colonists) {
        const snapshot = captureColonistSnapshot(colonist);
        if (snapshot) {
          colonistSnapshots.push(snapshot);
          sumEarth += snapshot.earthLoyalist;
          sumMars += snapshot.marsIndependence;
          sumCorp += snapshot.corporateInterests;
          sumConviction += snapshot.conviction;
          sumSpread += snapshot.ideologySpread;
          if (snapshot.dominantFaction) dominantCount++;
          count++;

          // Track founding colonists
          const tracking = foundingColonistTracking.get(colonist.id);
          if (tracking) {
            tracking.snapshots.push(snapshot);
          }
        }
      }

      timeline.push({
        sol: currentSol,
        colonists: colonistSnapshots,
        populationCount: colony.population,
        avgEarthLoyalist: count > 0 ? sumEarth / count : 0,
        avgMarsIndependence: count > 0 ? sumMars / count : 0,
        avgCorporateInterests: count > 0 ? sumCorp / count : 0,
        avgConviction: count > 0 ? sumConviction / count : 0,
        colonistsWithDominant: dominantCount,
        avgIdeologySpread: count > 0 ? sumSpread / count : 0,
      });
    }
  }

  const victoryState = api.game.victoryState();

  return {
    seed,
    finalSol: api.game.currentSol(),
    outcome: victoryState.status,
    timeline,
    foundingColonistTracking,
  };
}

function analyzeIdeologyDrift(analysis: IdeologyAnalysis): void {
  // Categorize colonists by conviction level and track their drift
  console.log("\n" + "=".repeat(80));
  console.log("DRIFT ANALYSIS BY CONVICTION LEVEL");
  console.log("=".repeat(80));

  const byConviction = {
    high: [] as { name: string; initialSpread: number; finalSpread: number; retained: boolean }[],
    medium: [] as { name: string; initialSpread: number; finalSpread: number; retained: boolean }[],
    low: [] as { name: string; initialSpread: number; finalSpread: number; retained: boolean }[],
  };

  for (const [_id, tracking] of analysis.foundingColonistTracking) {
    if (tracking.snapshots.length < 2) continue;
    const first = tracking.snapshots[0];
    const last = tracking.snapshots[tracking.snapshots.length - 1];
    if (!first || !last) continue;

    const entry = {
      name: tracking.name,
      initialSpread: first.ideologySpread,
      finalSpread: last.ideologySpread,
      retained: first.dominantFaction === last.dominantFaction && first.dominantFaction !== null,
    };

    if (first.conviction >= 0.7) {
      byConviction.high.push(entry);
    } else if (first.conviction >= 0.5) {
      byConviction.medium.push(entry);
    } else {
      byConviction.low.push(entry);
    }
  }

  for (const [level, entries] of Object.entries(byConviction)) {
    if (entries.length === 0) continue;
    const retainedCount = entries.filter((e) => e.retained).length;
    const avgSpreadChange =
      entries.reduce((sum, e) => sum + (e.finalSpread - e.initialSpread), 0) / entries.length;

    console.log(`\n${level.toUpperCase()} conviction (n=${entries.length}):`);
    console.log(
      `  Retained faction: ${retainedCount}/${entries.length} (${((retainedCount / entries.length) * 100).toFixed(0)}%)`,
    );
    console.log(
      `  Avg spread change: ${avgSpreadChange >= 0 ? "+" : ""}${avgSpreadChange.toFixed(3)}`,
    );
    for (const e of entries) {
      const status = e.retained ? "✓" : "✗";
      console.log(
        `    ${status} ${e.name}: spread ${e.initialSpread.toFixed(2)} → ${e.finalSpread.toFixed(2)}`,
      );
    }
  }
}

function printAnalysis(analysis: IdeologyAnalysis): void {
  console.log("\n" + "=".repeat(80));
  console.log("IDEOLOGY EVOLUTION ANALYSIS");
  console.log("=".repeat(80));
  console.log(`Seed: ${analysis.seed}`);
  console.log(`Outcome: ${analysis.outcome} at sol ${analysis.finalSol}`);
  console.log();

  // Summary over time
  console.log("COLONY-WIDE IDEOLOGY OVER TIME");
  console.log("-".repeat(80));
  console.log(
    "Sol".padEnd(6) +
      "Pop".padEnd(5) +
      "Earth".padEnd(8) +
      "Mars".padEnd(8) +
      "Corp".padEnd(8) +
      "Conv".padEnd(8) +
      "Spread".padEnd(8) +
      "Dominant",
  );

  for (const tp of analysis.timeline) {
    console.log(
      String(tp.sol).padEnd(6) +
        String(tp.populationCount).padEnd(5) +
        tp.avgEarthLoyalist.toFixed(3).padEnd(8) +
        tp.avgMarsIndependence.toFixed(3).padEnd(8) +
        tp.avgCorporateInterests.toFixed(3).padEnd(8) +
        tp.avgConviction.toFixed(3).padEnd(8) +
        tp.avgIdeologySpread.toFixed(3).padEnd(8) +
        `${tp.colonistsWithDominant}/${tp.colonists.length}`,
    );
  }

  // Founding colonist tracking
  console.log("\n" + "=".repeat(80));
  console.log("FOUNDING COLONIST IDEOLOGY EVOLUTION");
  console.log("=".repeat(80));

  for (const [id, tracking] of analysis.foundingColonistTracking) {
    if (tracking.snapshots.length === 0) continue;

    const first = tracking.snapshots[0];
    const last = tracking.snapshots[tracking.snapshots.length - 1];
    if (!first || !last) continue;

    console.log(`\n${tracking.name} (${id}):`);
    console.log(
      `  Initial: E=${first.earthLoyalist.toFixed(2)} M=${first.marsIndependence.toFixed(2)} C=${first.corporateInterests.toFixed(2)} conv=${first.conviction.toFixed(2)} [${first.dominantFaction ?? "neutral"}]`,
    );
    console.log(
      `  Final:   E=${last.earthLoyalist.toFixed(2)} M=${last.marsIndependence.toFixed(2)} C=${last.corporateInterests.toFixed(2)} conv=${last.conviction.toFixed(2)} [${last.dominantFaction ?? "neutral"}]`,
    );

    // Calculate drift
    const earthDrift = last.earthLoyalist - first.earthLoyalist;
    const marsDrift = last.marsIndependence - first.marsIndependence;
    const corpDrift = last.corporateInterests - first.corporateInterests;
    const spreadChange = last.ideologySpread - first.ideologySpread;

    console.log(
      `  Change:  E=${earthDrift >= 0 ? "+" : ""}${earthDrift.toFixed(2)} M=${marsDrift >= 0 ? "+" : ""}${marsDrift.toFixed(2)} C=${corpDrift >= 0 ? "+" : ""}${corpDrift.toFixed(2)}`,
    );
    console.log(
      `  Spread:  ${first.ideologySpread.toFixed(2)} → ${last.ideologySpread.toFixed(2)} (${spreadChange >= 0 ? "+" : ""}${spreadChange.toFixed(2)})`,
    );

    // Track faction changes
    if (first.dominantFaction !== last.dominantFaction) {
      console.log(
        `  ⚠ Faction shift: ${first.dominantFaction ?? "neutral"} → ${last.dominantFaction ?? "neutral"}`,
      );
    } else if (first.dominantFaction) {
      console.log(`  ✓ Retained: ${first.dominantFaction}`);
    }
  }

  // Convergence analysis
  console.log("\n" + "=".repeat(80));
  console.log("CONVERGENCE ANALYSIS");
  console.log("=".repeat(80));

  if (analysis.timeline.length >= 2) {
    const early = analysis.timeline[0];
    const late = analysis.timeline[analysis.timeline.length - 1];
    if (!early || !late) return;

    console.log("\nColony-wide averages:");
    console.log(
      `  Earth Loyalist:     ${early.avgEarthLoyalist.toFixed(3)} → ${late.avgEarthLoyalist.toFixed(3)}`,
    );
    console.log(
      `  Mars Independence:  ${early.avgMarsIndependence.toFixed(3)} → ${late.avgMarsIndependence.toFixed(3)}`,
    );
    console.log(
      `  Corporate:          ${early.avgCorporateInterests.toFixed(3)} → ${late.avgCorporateInterests.toFixed(3)}`,
    );
    console.log(
      `  Avg Conviction:     ${early.avgConviction.toFixed(3)} → ${late.avgConviction.toFixed(3)}`,
    );
    console.log(
      `  Avg Ideology Spread: ${early.avgIdeologySpread.toFixed(3)} → ${late.avgIdeologySpread.toFixed(3)}`,
    );

    const earlyDominantPct = ((early.colonistsWithDominant / early.colonists.length) * 100).toFixed(
      1,
    );
    const lateDominantPct = ((late.colonistsWithDominant / late.colonists.length) * 100).toFixed(1);
    console.log(`  With Dominant Faction: ${earlyDominantPct}% → ${lateDominantPct}%`);

    // Check hypothesis
    const spreadDecreased = late.avgIdeologySpread < early.avgIdeologySpread;
    const dominantDecreased =
      late.colonistsWithDominant / late.colonists.length <
      early.colonistsWithDominant / early.colonists.length;

    console.log("\nHypothesis check:");
    if (spreadDecreased) {
      console.log("  ✓ Ideology spread DECREASED over time (convergence toward uniform)");
    } else {
      console.log("  ✗ Ideology spread did NOT decrease (no convergence)");
    }
    if (dominantDecreased) {
      console.log("  ✓ Fewer colonists have dominant faction over time");
    } else {
      console.log("  ✗ Dominant faction proportion did NOT decrease");
    }
  }

  // Individual colonist detailed tracking
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED COLONIST IDEOLOGY TIMELINE (First 3 founding colonists)");
  console.log("=".repeat(80));

  let detailedCount = 0;
  for (const [_id, tracking] of analysis.foundingColonistTracking) {
    if (detailedCount >= 3) break;
    if (tracking.snapshots.length === 0) continue;

    console.log(`\n${tracking.name}:`);
    console.log(
      "Sol".padEnd(6) +
        "Earth".padEnd(8) +
        "Mars".padEnd(8) +
        "Corp".padEnd(8) +
        "Conv".padEnd(8) +
        "Spread".padEnd(8) +
        "Faction",
    );

    for (const snap of tracking.snapshots) {
      // Find the sol for this snapshot by position in timeline
      const idx = tracking.snapshots.indexOf(snap);
      const sol = (idx + 1) * SNAPSHOT_INTERVAL;
      console.log(
        String(sol).padEnd(6) +
          snap.earthLoyalist.toFixed(3).padEnd(8) +
          snap.marsIndependence.toFixed(3).padEnd(8) +
          snap.corporateInterests.toFixed(3).padEnd(8) +
          snap.conviction.toFixed(3).padEnd(8) +
          snap.ideologySpread.toFixed(3).padEnd(8) +
          (snap.dominantFaction ?? "neutral"),
      );
    }
    detailedCount++;
  }
}

function analyzeRelationshipStrengths(api: GameAPI): void {
  console.log("\n" + "=".repeat(80));
  console.log("RELATIONSHIP STRENGTH DISTRIBUTION");
  console.log("=".repeat(80));

  const colony = api.colony.snapshot({ lightweight: false });
  const strengths: number[] = [];

  // Collect all relationship strengths
  for (const [_key, rel] of colony.coworkerRelationships) {
    strengths.push(rel.strength);
  }

  if (strengths.length === 0) {
    console.log("No relationships found.");
    return;
  }

  strengths.sort((a, b) => a - b);

  const buckets = [0, 0, 0, 0, 0]; // <0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8+
  for (const s of strengths) {
    if (s < 0.2) buckets[0]++;
    else if (s < 0.4) buckets[1]++;
    else if (s < 0.6) buckets[2]++;
    else if (s < 0.8) buckets[3]++;
    else buckets[4]++;
  }

  console.log(`Total relationships: ${strengths.length}`);
  const minStrength = strengths[0];
  const maxStrength = strengths[strengths.length - 1];
  const medianStrength = strengths[Math.floor(strengths.length / 2)];
  console.log(`Min: ${minStrength?.toFixed(3) ?? "N/A"}, Max: ${maxStrength?.toFixed(3) ?? "N/A"}`);
  console.log(`Median: ${medianStrength?.toFixed(3) ?? "N/A"}`);
  console.log("\nDistribution:");
  console.log(
    `  <0.2 (very weak): ${buckets[0]} (${((buckets[0] / strengths.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  0.2-0.4 (weak):   ${buckets[1]} (${((buckets[1] / strengths.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  0.4-0.6 (medium): ${buckets[2]} (${((buckets[2] / strengths.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  0.6-0.8 (strong): ${buckets[3]} (${((buckets[3] / strengths.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  0.8+   (v.strong): ${buckets[4]} (${((buckets[4] / strengths.length) * 100).toFixed(1)}%)`,
  );

  // Count how many would pass different thresholds
  const above03 = strengths.filter((s) => s >= 0.3).length;
  const above05 = strengths.filter((s) => s >= 0.5).length;
  const above07 = strengths.filter((s) => s >= 0.7).length;
  console.log("\nThreshold analysis:");
  console.log(
    `  ≥0.3: ${above03} (${((above03 / strengths.length) * 100).toFixed(1)}%) would spread ideology`,
  );
  console.log(
    `  ≥0.5: ${above05} (${((above05 / strengths.length) * 100).toFixed(1)}%) would spread ideology`,
  );
  console.log(
    `  ≥0.7: ${above07} (${((above07 / strengths.length) * 100).toFixed(1)}%) would spread ideology`,
  );
}

// Main execution
const seed = process.argv[2] ? parseInt(process.argv[2], 10) : 42;
console.log(`Running ideology analysis with seed ${seed}...`);

const analysis = runIdeologyAnalysis(seed);
printAnalysis(analysis);
analyzeIdeologyDrift(analysis);

// Run a quick game to check relationship distribution at end state
rng.seed(seed);
const api = new GameAPI();
const strategy = new HeuristicStrategy(api);
for (let i = 0; i < 500; i++) {
  strategy.executeTick();
  api.game.advanceSol();
  if (api.game.isGameOver()) break;
}
analyzeRelationshipStrengths(api);
