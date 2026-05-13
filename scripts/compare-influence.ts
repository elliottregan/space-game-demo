// Compare win rates across different influenceBaseline values per Setting.
//
// Usage: bun run scripts/compare-influence.ts [runs] [settingId]
//   runs      (default 200) — simulated Epochs per variant.
//   settingId (default "all") — "homeworld" | "generation-ship" | "ruined-homeworld" | "all".

import { GameAPI } from "../src/facade/GameAPI.ts";
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import { getSetting } from "../src/core/settings/index.ts";

const runs = Number(process.argv[2] ?? 200);
const settingArg = String(process.argv[3] ?? "all");

const SETTINGS_TO_TEST =
  settingArg === "all" ? ["homeworld", "generation-ship", "ruined-homeworld"] : [settingArg];

const INFLUENCE_VARIANTS = [
  { label: "default", baseline: null }, // null = use setting's own default
  { label: "high (6)", baseline: 6 },
  { label: "unlimited (99)", baseline: 99 },
];

function runEpoch(api: GameAPI): { won: boolean; margin: number } {
  let steps = 0;
  const MAX_STEPS = 1000;
  while (api.snapshot().epoch.phase === "play" && steps < MAX_STEPS) {
    steps++;
    const snap = api.snapshot();
    let acted = false;
    for (const card of snap.epoch.hand) {
      const cols = api.validColumns(card.id);
      if (cols[0] === undefined) continue;
      const r = api.placeCard(card.id, cols[0]);
      if (r.ok) {
        acted = true;
        break;
      }
    }
    if (!acted) {
      const snap2 = api.snapshot();
      for (let i = 0; i < snap2.epoch.columns.length; i++) {
        const m = evaluateColumn(snap2.epoch.columns[i], snap2.setting.projects);
        if (!m) continue;
        if (api.buildColumn(i).ok) {
          acted = true;
          break;
        }
      }
    }
    if (!acted) api.endTurn();
  }
  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const snap = api.snapshot();
  const outcome = snap.epoch.crisis.outcome;
  if (!outcome) throw new Error("Crisis did not resolve.");
  return { won: outcome.cleared, margin: outcome.totalValue - snap.setting.crisis.difficulty };
}

function simulate(settingId: string, influenceOverride: number | null, n: number) {
  const setting = getSetting(settingId);
  const original = setting.rules.influenceBaseline;
  if (influenceOverride !== null) setting.rules.influenceBaseline = influenceOverride;

  const results: { won: boolean; margin: number }[] = [];
  for (let i = 0; i < n; i++) {
    const api = new GameAPI(i + 1, { skipLoad: true, forceSettingId: settingId });
    results.push(runEpoch(api));
  }

  setting.rules.influenceBaseline = original; // restore

  const wins = results.filter((r) => r.won).length;
  const margins = results.map((r) => r.margin);
  const mean = margins.reduce((a, b) => a + b, 0) / margins.length;
  const sorted = [...margins].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return {
    winRate: ((wins / n) * 100).toFixed(1) + "%",
    wins,
    mean: mean.toFixed(1),
    median,
  };
}

// Header
console.log(`\nInfluence baseline comparison — ${runs} runs per variant\n`);

for (const settingId of SETTINGS_TO_TEST) {
  const setting = getSetting(settingId);
  const defaultBaseline = setting.rules.influenceBaseline;
  console.log(`=== ${setting.name} (default baseline: ${defaultBaseline}) ===`);
  console.log(
    "Variant".padEnd(20),
    "Win rate".padEnd(12),
    "Wins".padEnd(8),
    "Margin mean".padEnd(14),
    "Margin median",
  );
  console.log("-".repeat(70));

  for (const v of INFLUENCE_VARIANTS) {
    const baseline = v.baseline ?? defaultBaseline;
    const label = v.baseline === null ? `default (${defaultBaseline})` : v.label;
    const r = simulate(settingId, v.baseline, runs);
    console.log(
      label.padEnd(20),
      r.winRate.padEnd(12),
      String(r.wins).padEnd(8),
      r.mean.padEnd(14),
      String(r.median),
    );
  }
  console.log();
}
