// Path-to-victory analysis.
//
// Runs N epochs per target mega-structure using a simple greedy heuristic
// that tries to assemble the hand for the target path. Collects win rates,
// turns-to-win, completion tiers, and common failure modes.
//
// Run: bun run demo/scripts/analyze-paths.ts [runsPerPath]

import { GameAPI } from "../src/facade/GameAPI.ts";
import { HOMEWORLD } from "../src/core/homeworld.ts";
import { evaluateMegaStructure } from "../src/core/patterns.ts";
import type { Card, Epoch, MegaProject, Setting } from "../src/core/types.ts";

const RUNS_PER_PATH = parseInt(process.argv[2] ?? "200", 10);
const MAX_STEPS_PER_EPOCH = 200; // safety cap in the action loop

// -------------------------------------------------------------------------
// Heuristic
// -------------------------------------------------------------------------

/** Return the set of card ids that should be kept in hand toward the target. */
function identifyKeepers(hand: Card[], project: MegaProject): Set<string> {
  const keep = new Set<string>();
  // Always keep the keystone if we have it.
  const keystone = hand.find((c) => c.id === project.keystoneId);
  if (keystone) keep.add(keystoneInstanceKey(keystone));

  const req = project.requiredHand;
  switch (req.kind) {
    case "four-of-a-kind": {
      for (const c of hand) {
        if (c.role === req.role) keep.add(keystoneInstanceKey(c));
      }
      break;
    }
    case "flush": {
      // Keep up to `count` cards of the ideology (not the keystone, which is already kept).
      let kept = 0;
      for (const c of hand) {
        if (kept >= req.count) break;
        if (c.id === project.keystoneId) continue;
        if (c.ideology === req.ideology) {
          keep.add(keystoneInstanceKey(c));
          kept++;
        }
      }
      break;
    }
    case "straight": {
      const needed = new Set(req.ranks);
      for (const c of hand) {
        if (needed.has(c.rank)) {
          keep.add(keystoneInstanceKey(c));
          needed.delete(c.rank);
        }
      }
      break;
    }
  }
  return keep;
}

function keystoneInstanceKey(c: Card): string {
  return c.id;
}

type StepAction = { kind: "win" } | { kind: "endturn" } | { kind: "played"; what: string };

/** Execute a single action toward the target path. Returns what was done. */
function playStep(api: GameAPI, targetId: string, setting: Setting): StepAction {
  const snap = api.snapshot();
  const evalForTarget = snap.projectProgress.find((p) => p.projectId === targetId)!.evaluation;
  if (evalForTarget.canPlay) {
    const r = api.playMegaStructure(targetId);
    if (r.ok) return { kind: "win" };
  }

  const project = setting.megaProjects.find((p) => p.id === targetId)!;
  const hand = snap.epoch.hand;
  const keepers = identifyKeepers(hand, project);

  // 1) Place a non-keeper Land that has a valid slot (prefer stacking to improve slots).
  for (const card of hand) {
    if (card.kind !== "land") continue;
    if (keepers.has(card.id)) continue;
    const slots = api.validSlots(card.id);
    if (slots.length === 0) continue;
    // Prefer a slot with an existing matching Land (to create/extend a stack).
    const snap2 = api.snapshot();
    const preferred = slots.find((idx) => snap2.epoch.tableau[idx]!.lands.length >= 1) ?? slots[0]!;
    const r = api.playCard(card.id, preferred);
    if (r.ok) return { kind: "played", what: `Land ${card.name}` };
  }

  // 2) Play a non-keeper Role for its effect, if we can afford it and a slot is improved.
  for (const card of hand) {
    if (card.kind !== "role" && card.kind !== "keystone") continue;
    if (keepers.has(card.id)) continue;
    if (api.getEffectiveCost(card) > snap.epoch.influence) continue;
    const slots = api.validSlots(card.id);
    if (slots.length === 0) continue;
    const r = api.playCard(card.id, slots[0]!);
    if (r.ok) return { kind: "played", what: `Role ${card.name}` };
  }

  // 3) Discard non-keeper Dissent cards for Material.
  for (const card of hand) {
    if (!card.tags.includes("dissent")) continue;
    const r = api.discardForMaterial(card.id);
    if (r.ok) return { kind: "played", what: "Dissent → Mat" };
  }

  // 4) If hand is full and nothing else, discard oldest non-keeper non-dissent card.
  if (hand.length >= setting.rules.handSize + 2) {
    for (const card of hand) {
      if (keepers.has(card.id)) continue;
      if (card.tags.includes("dissent")) continue;
      const r = api.discardForMaterial(card.id);
      if (r.ok) return { kind: "played", what: "Discarded spare" };
    }
  }

  return { kind: "endturn" };
}

function playEpoch(api: GameAPI, targetId: string, setting: Setting): void {
  for (let step = 0; step < MAX_STEPS_PER_EPOCH; step++) {
    const s = api.snapshot();
    if (s.epoch.status.kind !== "in-progress") return;
    const action = playStep(api, targetId, setting);
    if (action.kind === "endturn") api.endTurn();
    if (action.kind === "win") return;
  }
}

// -------------------------------------------------------------------------
// Per-path analysis
// -------------------------------------------------------------------------

interface PathResult {
  pathId: string;
  runs: number;
  wins: number;
  lossPopulace: number;
  lossStarved: number;
  turnsToWin: number[];
  tiers: Record<string, number>;
  finalDissentCounts: number[];
  dissentInHandAtEnd: number[];
  finalAxis1: number[];
  finalAxis2: number[];
  tableauCards: number[]; // cards that ended up on tableau at end
}

function emptyPathResult(pathId: string): PathResult {
  return {
    pathId,
    runs: 0,
    wins: 0,
    lossPopulace: 0,
    lossStarved: 0,
    turnsToWin: [],
    tiers: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    finalDissentCounts: [],
    dissentInHandAtEnd: [],
    finalAxis1: [],
    finalAxis2: [],
    tableauCards: [],
  };
}

function runPath(pathId: string, runs: number): PathResult {
  const result = emptyPathResult(pathId);
  result.runs = runs;

  for (let seed = 1; seed <= runs; seed++) {
    const api = new GameAPI(seed, { skipLoad: true });
    const snap0 = api.snapshot();
    const setting = snap0.setting;

    playEpoch(api, pathId, setting);

    const finalSnap = api.snapshot();
    const ep = finalSnap.epoch;
    const status = ep.status;

    if (status.kind === "won") {
      result.wins++;
      result.turnsToWin.push(ep.turn);
      result.tiers[status.tier] = (result.tiers[status.tier] ?? 0) + 1;
    } else if (status.kind === "lost") {
      if (status.mode === "populace-turned") result.lossPopulace++;
      else result.lossStarved++;
    }

    // Deck snapshot for post-mortem.
    const allCards = [...ep.hand, ...ep.draw, ...ep.discard];
    result.finalDissentCounts.push(allCards.filter((c) => c.tags.includes("dissent")).length);
    result.dissentInHandAtEnd.push(ep.hand.filter((c) => c.tags.includes("dissent")).length);
    result.finalAxis1.push(finalSnap.vector.axis1);
    result.finalAxis2.push(finalSnap.vector.axis2);
    result.tableauCards.push(tableauCardCount(ep));
  }

  return result;
}

function tableauCardCount(ep: Epoch): number {
  let n = 0;
  for (const slot of ep.tableau) {
    n += slot.lands.length;
    if (slot.topper) n++;
  }
  return n;
}

// -------------------------------------------------------------------------
// Report
// -------------------------------------------------------------------------

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}
function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function fmt(n: number | null, digits = 1): string {
  if (n === null) return "—";
  return n.toFixed(digits);
}

function printReport(results: PathResult[]): void {
  const paths = [
    { id: "the-ark", label: "The Ark (Straight J-Q-K + Compass)" },
    { id: "the-commune", label: "The Commune (Flush 5 Solidarity + Charter)" },
    { id: "the-reactor", label: "The Reactor (4 Engineers + Critical Mass)" },
  ];

  console.log("");
  console.log("=".repeat(78));
  console.log(` PATHS TO VICTORY — ${RUNS_PER_PATH} runs per path, greedy heuristic`);
  console.log("=".repeat(78));

  for (const path of paths) {
    const r = results.find((x) => x.pathId === path.id);
    if (!r) continue;
    const winPct = ((r.wins / r.runs) * 100).toFixed(1);
    console.log("");
    console.log(` ${path.label}`);
    console.log(` ${"-".repeat(path.label.length)}`);
    console.log(`   Runs:              ${r.runs}`);
    console.log(`   Wins:              ${r.wins} (${winPct}%)`);
    console.log(`   Losses (populace): ${r.lossPopulace}`);
    console.log(`   Losses (starved):  ${r.lossStarved}`);
    if (r.turnsToWin.length > 0) {
      console.log(
        `   Turns to win:      median ${fmt(median(r.turnsToWin), 0)}, mean ${fmt(mean(r.turnsToWin))}, min ${Math.min(...r.turnsToWin)}, max ${Math.max(...r.turnsToWin)}`,
      );
      console.log(
        `   Completion tiers:  bronze ${r.tiers.bronze}, silver ${r.tiers.silver}, gold ${r.tiers.gold}, platinum ${r.tiers.platinum}`,
      );
    }
    console.log(
      `   Final axis1:       median ${fmt(median(r.finalAxis1), 1)} (${fmt(mean(r.finalAxis1))})`,
    );
    console.log(
      `   Final axis2:       median ${fmt(median(r.finalAxis2), 1)} (${fmt(mean(r.finalAxis2))})`,
    );
    console.log(
      `   Dissent in deck:   median ${fmt(median(r.finalDissentCounts), 0)} cards at end`,
    );
    console.log(`   Tableau cards:     median ${fmt(median(r.tableauCards), 0)} at end`);
  }

  console.log("");
  console.log("=".repeat(78));
  summarize(results);
}

function summarize(results: PathResult[]): void {
  const rows = results.map((r) => ({
    path: r.pathId,
    winPct: (r.wins / r.runs) * 100,
    medianTurn: median(r.turnsToWin),
    goldOrBetter: (r.tiers.gold ?? 0) + (r.tiers.platinum ?? 0),
  }));
  rows.sort((a, b) => b.winPct - a.winPct);
  console.log(" Ranking by win rate:");
  for (const r of rows) {
    console.log(
      `   ${r.path.padEnd(14)}  win ${r.winPct.toFixed(1)}%   median turn ${fmt(r.medianTurn, 0)}   gold+ ${r.goldOrBetter}`,
    );
  }
  console.log("");
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

const targets = HOMEWORLD.megaProjects.map((p) => p.id);
const results: PathResult[] = [];
for (const t of targets) {
  process.stderr.write(`Running ${t}…\n`);
  results.push(runPath(t, RUNS_PER_PATH));
}
printReport(results);
