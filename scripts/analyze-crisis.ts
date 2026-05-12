// Greedy heuristic: per Setting, run N Epochs and report Crisis win rate
// and project-unlock cadence.

import { GameAPI } from "../src/facade/GameAPI.ts";
import { evaluateColumn } from "../src/core/columnPatterns.ts";

const runsPerSetting = Number(process.argv[2] ?? 50);

interface Report {
  setting: string;
  wins: number;
  runs: number;
  avgFirstPair: number | null;
  avgFirstThree: number | null;
  avgFirstFlush: number | null;
  avgFirstFour: number | null;
  avgMargin: number;
}

function runEpoch(api: GameAPI): { won: boolean; firstByPattern: Record<string, number>; margin: number } {
  const firstByPattern: Record<string, number> = {};
  let steps = 0;
  const MAX_STEPS = 500;
  while (api.snapshot().epoch.phase === "play" && steps < MAX_STEPS) {
    steps++;
    const snap = api.snapshot();
    // Try to place any hand card to its first valid column.
    let played = false;
    for (const card of snap.epoch.hand) {
      const cols = api.validColumns(card.id);
      if (cols.length === 0) continue;
      const r = api.placeCard(card.id, cols[0]!);
      if (r.ok) { played = true; break; }
    }
    // Try to build any buildable column.
    const snap2 = api.snapshot();
    for (let i = 0; i < snap2.epoch.columns.length; i++) {
      const m = evaluateColumn(snap2.epoch.columns[i]!, snap2.setting.projects);
      if (!m) continue;
      const r = api.buildColumn(i);
      if (r.ok) {
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
  const outcome = snap.epoch.crisis.outcome!;
  const margin = outcome.totalValue - snap.setting.crisis.difficulty;
  return { won: outcome.cleared, firstByPattern, margin };
}

function reportFor(settingId: string, runs: number): Report {
  let wins = 0;
  let totalMargin = 0;
  const firsts: Record<string, number[]> = { pair: [], "three-of-a-kind": [], flush: [], "four-of-a-kind": [] };
  for (let i = 0; i < runs; i++) {
    const api = new GameAPI(i + 1, { skipLoad: true });
    // Restart into the target setting if different — for now we assume Homeworld start.
    const r = runEpoch(api);
    if (r.won) wins++;
    totalMargin += r.margin;
    for (const k of Object.keys(firsts)) {
      if (r.firstByPattern[k] !== undefined) firsts[k]!.push(r.firstByPattern[k]!);
    }
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return {
    setting: settingId,
    wins,
    runs,
    avgFirstPair: avg(firsts["pair"]!),
    avgFirstThree: avg(firsts["three-of-a-kind"]!),
    avgFirstFlush: avg(firsts["flush"]!),
    avgFirstFour: avg(firsts["four-of-a-kind"]!),
    avgMargin: totalMargin / runs,
  };
}

const report = reportFor("homeworld", runsPerSetting);
console.log(JSON.stringify(report, null, 2));
