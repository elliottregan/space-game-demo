// Greedy heuristic: per Setting, run N Epochs and report Crisis stats.
//
// Usage: bun run scripts/analyze-crisis.ts [runs] [settingId] [seedOffset]
//   runs (default 50) — number of simulated Epochs.
//   settingId (default "homeworld") — "homeworld" | "generation-ship" | "ruined-homeworld".
//   seedOffset (default 0) — added to each iteration's seed (for re-runs).

import { GameAPI } from "../src/facade/GameAPI.ts";
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import type { PatternKind } from "../src/core/types.ts";

const runs = Number(process.argv[2] ?? 50);
const settingId = String(process.argv[3] ?? "homeworld");
const seedOffset = Number(process.argv[4] ?? 0);

interface RunResult {
  won: boolean;
  margin: number;
  totalValue: number;
  difficulty: number;
  unlocksByPattern: Record<PatternKind, number>;
  firstByPattern: Partial<Record<PatternKind, number>>;
  turnsPlayed: number;
}

function runEpoch(api: GameAPI): RunResult {
  const firstByPattern: Partial<Record<PatternKind, number>> = {};
  const unlocksByPattern: Record<PatternKind, number> = {
    "high-card": 0,
    pair: 0,
    "three-of-a-kind": 0,
    flush: 0,
    "four-of-a-kind": 0,
  };
  let steps = 0;
  const MAX_STEPS = 1000;
  while (api.snapshot().epoch.phase === "play" && steps < MAX_STEPS) {
    steps++;
    const snap = api.snapshot();
    // 1) place any playable hand card to its first valid column.
    let played = false;
    for (const card of snap.epoch.hand) {
      const cols = api.validColumns(card.id);
      const col = cols[0];
      if (col === undefined) continue;
      const r = api.placeCard(card.id, col);
      if (r.ok) {
        played = true;
        break;
      }
    }
    // 2) build any buildable column.
    const snap2 = api.snapshot();
    for (let i = 0; i < snap2.epoch.columns.length; i++) {
      const m = evaluateColumn(snap2.epoch.columns[i], snap2.setting.projects);
      if (!m) continue;
      const r = api.buildColumn(i);
      if (r.ok) {
        unlocksByPattern[m.kind] += 1;
        if (firstByPattern[m.kind] === undefined) {
          firstByPattern[m.kind] = api.snapshot().epoch.turn;
        }
        played = true;
        break;
      }
    }
    if (!played) api.endTurn();
  }
  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const snap = api.snapshot();
  const outcome = snap.epoch.crisis.outcome;
  if (!outcome) throw new Error("Crisis did not resolve after MAX_STEPS.");
  const difficulty = snap.setting.crisis.difficulty;
  return {
    won: outcome.cleared,
    margin: outcome.totalValue - difficulty,
    totalValue: outcome.totalValue,
    difficulty,
    unlocksByPattern,
    firstByPattern,
    turnsPlayed: snap.epoch.turn - 1, // turn is 1-based after Crisis fires
  };
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const m = mean(arr);
  if (m === null) return null;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function round(n: number | null, digits = 2): number | null {
  if (n === null) return null;
  return Math.round(n * 10 ** digits) / 10 ** digits;
}

function reportFor(settingId: string, runs: number): unknown {
  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    const seed = i + 1 + seedOffset;
    const api = new GameAPI(seed, { skipLoad: true, forceSettingId: settingId });
    results.push(runEpoch(api));
  }
  const margins = results.map((r) => r.margin);
  const totals = results.map((r) => r.totalValue);
  const wins = results.filter((r) => r.won).length;

  const patternKinds: PatternKind[] = [
    "high-card",
    "pair",
    "three-of-a-kind",
    "flush",
    "four-of-a-kind",
  ];

  const avgUnlocks: Record<string, number | null> = {};
  const avgFirst: Record<string, number | null> = {};
  for (const p of patternKinds) {
    avgUnlocks[p] = round(mean(results.map((r) => r.unlocksByPattern[p])));
    const firsts = results
      .map((r) => r.firstByPattern[p])
      .filter((x): x is number => x !== undefined);
    avgFirst[p] = round(mean(firsts));
  }
  const avgTotalUnlocks = round(
    mean(results.map((r) => Object.values(r.unlocksByPattern).reduce((a, b) => a + b, 0))),
  );

  return {
    setting: settingId,
    runs,
    wins,
    winRate: round(wins / runs, 3),
    difficulty: results[0]?.difficulty,
    margin: {
      mean: round(mean(margins)),
      median: round(median(margins)),
      stdev: round(stdev(margins)),
      min: Math.min(...margins),
      max: Math.max(...margins),
    },
    totalValue: {
      mean: round(mean(totals)),
      median: round(median(totals)),
    },
    avgTotalUnlocks,
    avgUnlocksPerPattern: avgUnlocks,
    avgFirstUnlockTurn: avgFirst,
  };
}

const report = reportFor(settingId, runs);
console.log(JSON.stringify(report, null, 2));
