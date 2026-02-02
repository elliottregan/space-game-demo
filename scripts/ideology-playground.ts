#!/usr/bin/env bun
/**
 * Ideology Propagation Playground
 *
 * A minimal sandbox for testing ideology spread through social networks.
 * Modify the SETUP section below and re-run to experiment.
 *
 * Usage: bun scripts/ideology-playground.ts
 */

import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

// ============================================================================
// SETUP - Modify this section to experiment
// ============================================================================

/** Number of sols to simulate */
const SOLS = 50;

/** Define colonists with their initial ideologies */
const colonists: Colonist[] = [
  // Format: createColonist(id, name, earth, mars, corporate, conviction)
  createColonist("A", "Alice", 0.2, 0.2, 0.8, 0.7), // Strong Corporate
  createColonist("B", "Bob", 0.8, 0.1, 0.1, 0.5), // Strong Earth
  createColonist("C", "Charlie", 0.33, 0.33, 0.33, 0.2), // Neutral
  createColonist("D", "Diana", 0.33, 0.33, 0.33, 0.2), // Neutral
];

/** Define relationships (who influences whom)
 *  Format: [colonistA, colonistB, strength]
 *  Strength: 0.0-1.0 (0.2 is threshold, 1.0 is max)
 */
const relationships: [string, string, number][] = [
  ["A", "C", 1.0], // Alice strongly connected to Charlie
  ["B", "D", 1.0], // Bob strongly connected to Diana
  ["C", "D", 0.5], // Charlie and Diana moderately connected
];

// ============================================================================
// HELPERS - You can ignore this section
// ============================================================================

function createColonist(
  id: string,
  name: string,
  earth: number,
  mars: number,
  corporate: number,
  conviction: number,
): Colonist {
  return {
    id,
    name,
    role: ColonistRole.UNASSIGNED,
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
    skills: [],
    ideology: {
      earthLoyalist: earth,
      marsIndependence: mars,
      corporateInterests: corporate,
      conviction,
    },
  };
}

// Store history for each colonist
type IdeologySnapshot = {
  sol: number;
  earth: number;
  mars: number;
  corporate: number;
  conviction: number;
};
const history = new Map<string, IdeologySnapshot[]>();

function recordSnapshot(sol: number, colonists: Colonist[]) {
  for (const c of colonists) {
    if (!c.ideology) continue;
    if (!history.has(c.id)) history.set(c.id, []);
    history.get(c.id)!.push({
      sol,
      earth: c.ideology.earthLoyalist,
      mars: c.ideology.marsIndependence,
      corporate: c.ideology.corporateInterests,
      conviction: c.ideology.conviction,
    });
  }
}

function makeBar(value: number, width: number = 20): string {
  const filled = Math.round(value * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function printTimeline(
  colonistId: string,
  dimension: "earth" | "mars" | "corporate" | "conviction",
) {
  const data = history.get(colonistId);
  if (!data) return;

  const label = dimension.charAt(0).toUpperCase() + dimension.slice(1);
  const values = data.map((d) => d[dimension]);

  // Sparkline using block characters
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.01;

  const sparkline = values
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.min(Math.floor(normalized * 8), 7);
      return blocks[index];
    })
    .join("");

  const start = (values[0] * 100).toFixed(0).padStart(3);
  const end = (values[values.length - 1] * 100).toFixed(0).padStart(3);
  const delta = ((values[values.length - 1] - values[0]) * 100).toFixed(0);
  const deltaStr = Number(delta) >= 0 ? `+${delta}` : delta;

  console.log(`  ${label.padEnd(10)} ${start}% ${sparkline} ${end}%  (${deltaStr})`);
}

function printColonistChart(colonist: Colonist) {
  if (!colonist.ideology) return;
  const i = colonist.ideology;

  console.log(`\n${colonist.id} (${colonist.name})`);
  console.log(
    `  Earth:      ${makeBar(i.earthLoyalist)} ${(i.earthLoyalist * 100).toFixed(0).padStart(3)}%`,
  );
  console.log(
    `  Mars:       ${makeBar(i.marsIndependence)} ${(i.marsIndependence * 100).toFixed(0).padStart(3)}%`,
  );
  console.log(
    `  Corporate:  ${makeBar(i.corporateInterests)} ${(i.corporateInterests * 100).toFixed(0).padStart(3)}%`,
  );
  console.log(
    `  Conviction: ${makeBar(i.conviction)} ${(i.conviction * 100).toFixed(0).padStart(3)}%`,
  );
}

// ============================================================================
// SIMULATION - Runs the propagation loop
// ============================================================================

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║          IDEOLOGY PROPAGATION PLAYGROUND                       ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

// Set up relationship manager
const relationshipManager = new RelationshipManager();
for (const [a, b, strength] of relationships) {
  relationshipManager.createRelationship(a, b, 0, { initialStrength: strength });
}
relationshipManager.recalculateCentrality(0);

// Print network diagram
console.log("NETWORK TOPOLOGY");
console.log("────────────────");
for (const [a, b, strength] of relationships) {
  const strengthBar = "━".repeat(Math.round(strength * 5));
  console.log(
    `  ${a} ◀${strengthBar}${(strength * 100).toFixed(0).padStart(3)}%${strengthBar}▶ ${b}`,
  );
}

// Print initial state
console.log("\n\nINITIAL STATE");
console.log("─────────────");
for (const c of colonists) {
  printColonistChart(c);
}

// Record initial state
recordSnapshot(0, colonists);

// Create ideology manager and run propagation
const ideologyManager = new IdeologyManager();

for (let sol = 1; sol <= SOLS; sol++) {
  ideologyManager.propagateIdeology(colonists, relationshipManager);
  recordSnapshot(sol, colonists);
}

// Final state
console.log("\n\nFINAL STATE (Sol " + SOLS + ")");
console.log("──────────────────────");
for (const c of colonists) {
  printColonistChart(c);
}

// Timeline visualization
console.log("\n\nTIMELINE (Sol 0 → " + SOLS + ")");
console.log("─────────────────────");
for (const c of colonists) {
  console.log(`\n${c.id} (${c.name})`);
  printTimeline(c.id, "earth");
  printTimeline(c.id, "mars");
  printTimeline(c.id, "corporate");
  printTimeline(c.id, "conviction");
}

// Summary table
console.log("\n\nSUMMARY TABLE");
console.log("─────────────");
console.log("  ID   │ Start Faction      │ End Faction        │ Conviction Δ");
console.log("───────┼────────────────────┼────────────────────┼─────────────");
for (const c of colonists) {
  const snapshots = history.get(c.id)!;
  const start = snapshots[0];
  const end = snapshots[snapshots.length - 1];

  const startIdeology: ColonistIdeology = {
    earthLoyalist: start.earth,
    marsIndependence: start.mars,
    corporateInterests: start.corporate,
    conviction: start.conviction,
  };
  const endIdeology: ColonistIdeology = {
    earthLoyalist: end.earth,
    marsIndependence: end.mars,
    corporateInterests: end.corporate,
    conviction: end.conviction,
  };

  const startFaction = IdeologyManager.getPrimaryFaction(startIdeology) || "neutral";
  const endFaction = IdeologyManager.getPrimaryFaction(endIdeology) || "neutral";
  const convDelta = ((end.conviction - start.conviction) * 100).toFixed(0);
  const convStr = Number(convDelta) >= 0 ? `+${convDelta}%` : `${convDelta}%`;

  console.log(
    `  ${c.id.padEnd(4)} │ ${startFaction.padEnd(18)} │ ${endFaction.padEnd(18)} │ ${convStr.padStart(11)}`,
  );
}
console.log("");
