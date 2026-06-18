// Strategy explorer: run several named AI *policies*, each biased toward a
// different hand family, against each Setting. Reports not just win rate but
// "rounds to win" (the earliest turn cumulative project value clears the
// Crisis) and which poker patterns each strategy actually reaches.
//
// The point is to map the strategy space — which win conditions are possible,
// and how fast — rather than to play optimally. Each policy is an ordered list
// of tactics; every step it tries them in order and ends the turn if none act.
//
// Usage: bun run scripts/explore-strategies.ts [runs] [settingId|all] [policy|all]
//   runs      (default 200)
//   settingId (default "all") — homeworld | generation-ship | ruined-homeworld | all
//   policy    (default "all") — rush | tall | flush | monoculture | straight | all
//
// Env: STORAGE_CAP=N overrides every Setting's baseStorageCapacity for the run
//   (capacity sweep). e.g. STORAGE_CAP=3 bun run scripts/explore-strategies.ts 300 all straight
// Env: VALUES=pattern:n,pattern:n overrides per-pattern project values for the
//   run (value sweep). e.g. VALUES=straight:9,straight-flush:14,royal-flush:18

import { GameAPI } from "../src/facade/GameAPI.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import { canCommitHand } from "../src/core/engine/rowHands.ts";
import { isWildCard } from "../src/core/engine/countsAs.ts";
import { PATTERNS_IN_ORDER, unlockedIdeologyBreakdown } from "../src/core/data/projects.ts";
import type { Card, Column, Ideology, PatternKind } from "../src/core/types.ts";
import { pickPolicyKeepIds } from "./policyKeep.ts";

const RUNS = Number(process.argv[2] ?? 200);
const SETTING_ARG = String(process.argv[3] ?? "all");
const POLICY_ARG = String(process.argv[4] ?? "all");
const STORAGE_CAP = process.env.STORAGE_CAP ? Number(process.env.STORAGE_CAP) : null;
const VALUE_OVERRIDES: Record<string, number> = {};
if (process.env.VALUES) {
  for (const pair of process.env.VALUES.split(",")) {
    const [pat, v] = pair.split(":");
    VALUE_OVERRIDES[pat.trim()] = Number(v);
  }
}

const ALL_SETTINGS = ["homeworld", "generation-ship", "ruined-homeworld"];

// ---------------------------------------------------------------------------
// Small card helpers
// ---------------------------------------------------------------------------

const isDissent = (c: Card) => c.tags.includes("dissent");

function groupByRank(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of cards) {
    const b = m.get(c.rank) ?? [];
    b.push(c);
    m.set(c.rank, b);
  }
  return m;
}

/** Non-wild ideology shared by every card in the column, or null (empty/all-wild) / "mixed". */
function lockedIdeology(col: Column): string | null | "mixed" {
  const ids = new Set<string>();
  const all: Card[] = [...col.lands.cards, ...col.influence.cards];
  // Wilds (countsAs jokers) complete any color, so they never lock or mix the
  // column's ideology — skip them, mirroring the flush evaluator.
  for (const c of all) if (!isWildCard(c)) ids.add(c.ideology);
  if (ids.size === 0) return null;
  if (ids.size === 1) return [...ids][0];
  return "mixed";
}

function splitIds(chosen: Card[], storageIds: Set<string>) {
  const handIds: string[] = [];
  const storeIds: string[] = [];
  for (const c of chosen) (storageIds.has(c.id) ? storeIds : handIds).push(c.id);
  return { handIds, storeIds };
}

// --- Land-hand finders over a candidate set (hand + that column's storage) ---

function pickN(cand: Card[], n: number): Card[] | null {
  for (const [, bucket] of groupByRank(cand)) if (bucket.length >= n) return bucket.slice(0, n);
  return null;
}

function pickTwoPair(cand: Card[]): Card[] | null {
  const pairs = [...groupByRank(cand).values()].filter((b) => b.length >= 2);
  if (pairs.length < 2) return null;
  return [...pairs[0].slice(0, 2), ...pairs[1].slice(0, 2)];
}

function pickFullHouse(cand: Card[]): Card[] | null {
  const by = groupByRank(cand);
  const trips = [...by.entries()].find(([, b]) => b.length >= 3);
  if (!trips) return null;
  const pair = [...by.entries()].find(([r, b]) => r !== trips[0] && b.length >= 2);
  if (!pair) return null;
  return [...trips[1].slice(0, 3), ...pair[1].slice(0, 2)];
}

/**
 * Cards from `cand` that would COMPLETE a 5-rank land straight, given the
 * column's existing land cards. Returns only the cards to add (may be empty
 * window-fillers); null if no straight window fits.
 */
function pickStraightCompletion(col: Column, cand: Card[]): Card[] | null {
  const existing = col.lands.cards;
  const exRanks = [...new Set(existing.map((c) => c.rank))];
  if (exRanks.length !== existing.length) return null; // a pair already → no straight
  const candByRank = groupByRank(cand);
  for (let lo = 2; lo <= 10; lo++) {
    const window = [lo, lo + 1, lo + 2, lo + 3, lo + 4];
    if (!exRanks.every((r) => window.includes(r))) continue;
    const missing = window.filter((r) => !exRanks.includes(r));
    if (missing.length === 0) continue; // already a straight
    if (missing.every((r) => candByRank.has(r))) {
      return missing.map((r) => candByRank.get(r)![0]);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tactics — each takes the api, attempts one action, returns whether it acted.
// ---------------------------------------------------------------------------

function columnMatch(api: GameAPI, col: Column): { kind: PatternKind; value: number } | null {
  const projects = api.snapshot().setting.projects;
  const m = evaluateColumn(col, projects);
  if (!m) return null;
  const proj = projects.find((p) => p.id === m.projectId);
  return { kind: m.kind as PatternKind, value: proj?.value ?? 0 };
}

/** Promote the present non-wild color with the most cards (count-scaled policy
 *  fuel; wilds are swing voters). undefined for an all-wild column (core → null).
 *  Required: buildColumn rejects a ≥2-color column with no promote arg. */
function promoteFor(col: Column): Ideology | undefined {
  const tally = new Map<Ideology, number>();
  for (const c of [...col.lands.cards, ...col.influence.cards]) {
    if (isWildCard(c) || c.ideology === "wild") continue;
    tally.set(c.ideology, (tally.get(c.ideology) ?? 0) + 1);
  }
  let best: Ideology | undefined;
  let bestN = 0;
  for (const [ideo, n] of tally) {
    if (n > bestN) {
      bestN = n;
      best = ideo;
    }
  }
  return best;
}

/** Build the highest-value buildable column whose value ≥ minValue. */
function buildBest(minValue: number) {
  return (api: GameAPI): boolean => {
    const snap = api.snapshot();
    let best = -1;
    let bestVal = minValue - 1;
    for (let i = 0; i < snap.epoch.columns.length; i++) {
      const m = columnMatch(api, snap.epoch.columns[i]);
      if (m && m.value > bestVal && m.value >= minValue) {
        bestVal = m.value;
        best = i;
      }
    }
    if (best < 0) return false;
    return api.buildColumn(best, promoteFor(snap.epoch.columns[best])).ok;
  };
}

/** Build anything once we're within `within` turns of the cap (salvage points). */
function buildLate(within: number) {
  return (api: GameAPI): boolean => {
    const snap = api.snapshot();
    if (snap.epoch.turn < snap.setting.rules.maxTurns - within + 1) return false;
    return buildBest(0)(api);
  };
}

/** Multi-card land commit, trying the given patterns in order. */
function commitLand(patterns: PatternKind[], minCount = 2) {
  return (api: GameAPI): boolean => {
    const snap = api.snapshot();
    const handLands = snap.epoch.hand.filter((c) => c.kind === "land" && !isDissent(c));
    for (let i = 0; i < snap.epoch.columns.length; i++) {
      const col = snap.epoch.columns[i];
      const storeLands = col.storage.filter((c) => c.kind === "land" && !isDissent(c));
      const cand = [...handLands, ...storeLands];
      const storageIds = new Set(col.storage.map((c) => c.id));
      for (const pat of patterns) {
        let chosen: Card[] | null = null;
        if (pat === "straight") chosen = pickStraightCompletion(col, cand);
        else if (pat === "four-of-a-kind") chosen = pickN(cand, 4);
        else if (pat === "three-of-a-kind") chosen = pickN(cand, 3);
        else if (pat === "pair") chosen = pickN(cand, 2);
        else if (pat === "two-pair") chosen = pickTwoPair(cand);
        else if (pat === "full-house") chosen = pickFullHouse(cand);
        if (!chosen || chosen.length === 0) continue;
        if (!canCommitHand(col, "land", chosen)) continue;
        const { handIds, storeIds } = splitIds(chosen, storageIds);
        if (handIds.length + storeIds.length < minCount) continue;
        if (api.commitHand(i, "land", handIds, storeIds).ok) return true;
      }
    }
    return false;
  };
}

/** Commit a same-rank role pair onto an empty influence row (two-pair / full-house support). */
function commitRolePair(api: GameAPI): boolean {
  const snap = api.snapshot();
  const handRoles = snap.epoch.hand.filter((c) => c.kind === "role" && !isDissent(c));
  for (let i = 0; i < snap.epoch.columns.length; i++) {
    const col = snap.epoch.columns[i];
    if (col.lands.cards.length === 0 || col.influence.cards.length > 0) continue;
    const storeRoles = col.storage.filter((c) => c.kind === "role" && !isDissent(c));
    const cand = [...handRoles, ...storeRoles];
    const storageIds = new Set(col.storage.map((c) => c.id));
    const pair = pickN(cand, 2);
    if (!pair || !canCommitHand(col, "influence", pair)) continue;
    const { handIds, storeIds } = splitIds(pair, storageIds);
    if (handIds.length + storeIds.length < 2) continue;
    if (api.commitHand(i, "influence", handIds, storeIds).ok) return true;
  }
  return false;
}

/** Place a hand land onto a column whose land row is a same-rank stack of that rank. */
function growStack(api: GameAPI): boolean {
  const snap = api.snapshot();
  for (const card of snap.epoch.hand) {
    if (card.kind !== "land" || isDissent(card)) continue;
    for (const ci of api.validColumns(card.id)) {
      const lr = snap.epoch.columns[ci].lands.cards;
      if (lr.length > 0 && lr.every((c) => c.rank === card.rank)) {
        if (api.placeCard(card.id, ci).ok) return true;
      }
    }
  }
  return false;
}

/** Seed an empty land row with a rank we hold ≥2 of in hand (start a stackable column). */
function seedStack(api: GameAPI): boolean {
  const snap = api.snapshot();
  const handLands = snap.epoch.hand.filter((c) => c.kind === "land" && !isDissent(c));
  const counts = groupByRank(handLands);
  for (const card of handLands) {
    if ((counts.get(card.rank)?.length ?? 0) < 2) continue;
    for (const ci of api.validColumns(card.id)) {
      if (snap.epoch.columns[ci].lands.cards.length === 0) {
        if (api.placeCard(card.id, ci).ok) return true;
      }
    }
  }
  return false;
}

/** Place the first placeable card of a kind (land/role) into a valid column. */
function placeKind(kind: Card["kind"]) {
  return (api: GameAPI): boolean => {
    const snap = api.snapshot();
    for (const card of snap.epoch.hand) {
      if (card.kind !== kind || isDissent(card)) continue;
      const cols = api.validColumns(card.id);
      if (cols.length > 0 && api.placeCard(card.id, cols[0]).ok) return true;
    }
    return false;
  };
}

/** Place any placeable hand card anywhere (greedy filler). */
function placeAny(api: GameAPI): boolean {
  const snap = api.snapshot();
  for (const card of snap.epoch.hand) {
    if (isDissent(card)) continue;
    const cols = api.validColumns(card.id);
    if (cols.length > 0 && api.placeCard(card.id, cols[0]).ok) return true;
  }
  return false;
}

/** Place a card only where it preserves a single-ideology column (extend first, then seed). */
function placeFlush(api: GameAPI): boolean {
  const snap = api.snapshot();
  for (const phase of ["extend", "seed"] as const) {
    for (const card of snap.epoch.hand) {
      if (isDissent(card)) continue;
      for (const ci of api.validColumns(card.id)) {
        const lock = lockedIdeology(snap.epoch.columns[ci]);
        if (lock === "mixed") continue;
        const fits = isWildCard(card) || lock === card.ideology;
        if (phase === "extend" ? fits : lock === null) {
          if (api.placeCard(card.id, ci).ok) return true;
        }
      }
    }
  }
  return false;
}

/**
 * The single ideology this run is committing to. Tableau cards dominate (they
 * persist), so once a column or two is placed the target locks; only the very
 * first placement is decided by the hand. Ties break by name for determinism.
 */
function globalTarget(api: GameAPI): string | null {
  const snap = api.snapshot();
  const tally = (cards: Card[]) => {
    const m = new Map<string, number>();
    for (const c of cards) if (!isWildCard(c)) m.set(c.ideology, (m.get(c.ideology) ?? 0) + 1);
    return m;
  };
  const tableau: Card[] = [];
  for (const col of snap.epoch.columns) {
    tableau.push(...col.lands.cards, ...col.influence.cards);
  }
  let m = tally(tableau);
  if (m.size === 0) m = tally(snap.epoch.hand.filter((c) => !isDissent(c)));
  if (m.size === 0) return null;
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/** Play ONLY the run's committed ideology (+ wilds), into empty or matching columns. */
function placeMonoculture(api: GameAPI): boolean {
  const target = globalTarget(api);
  if (!target) return false;
  const snap = api.snapshot();
  for (const card of snap.epoch.hand) {
    if (isDissent(card)) continue;
    if (card.ideology !== target && !isWildCard(card)) continue; // off-suit → recycle
    for (const ci of api.validColumns(card.id)) {
      const lock = lockedIdeology(snap.epoch.columns[ci]);
      if (lock === null || lock === target) {
        if (api.placeCard(card.id, ci).ok) return true;
      }
    }
  }
  return false;
}

/** Store a hand land that keeps a column's land+storage ranks inside one 5-window. */
function storeTowardStraight(api: GameAPI): boolean {
  const snap = api.snapshot();
  const cap = snap.effective.storageCapacity;
  const handLands = snap.epoch.hand.filter((c) => c.kind === "land" && !isDissent(c));
  for (let i = 0; i < snap.epoch.columns.length; i++) {
    const col = snap.epoch.columns[i];
    if (col.lands.cards.length === 0 || col.storage.length >= cap) continue;
    const ranks = [
      ...col.lands.cards.map((c) => c.rank),
      ...col.storage.filter((c) => c.kind === "land").map((c) => c.rank),
    ];
    if (new Set(ranks).size !== ranks.length) continue; // a pair already → straight dead
    for (const card of handLands) {
      if (ranks.includes(card.rank)) continue;
      const set = [...ranks, card.rank];
      if (Math.max(...set) - Math.min(...set) <= 4) {
        if (api.storeCard(card.id, i).ok) return true;
      }
    }
  }
  return false;
}

/** Begin a straight: if no column has lands yet, place the hand land with the most sequential reach. */
function seedStraight(api: GameAPI): boolean {
  const snap = api.snapshot();
  if (snap.epoch.columns.some((c) => c.lands.cards.length > 0)) return false;
  const handLands = snap.epoch.hand.filter((c) => c.kind === "land" && !isDissent(c));
  if (handLands.length === 0) return false;
  const ranks = handLands.map((c) => c.rank);
  const reach = (r: number) => new Set(ranks.filter((x) => Math.abs(x - r) <= 4)).size;
  const best = [...handLands].sort((a, b) => reach(b.rank) - reach(a.rank))[0];
  const cols = api.validColumns(best.id);
  return cols.length > 0 && api.placeCard(best.id, cols[0]).ok;
}

// ---------------------------------------------------------------------------
// Policies — ordered tactic lists. Differentiation comes from what runs FIRST.
// ---------------------------------------------------------------------------

export type Tactic = (api: GameAPI) => boolean;
export const POLICIES: Record<string, Tactic[]> = {
  // Build the best thing available, right now. The "pairs dominate" baseline.
  rush: [
    buildBest(0),
    commitLand(["four-of-a-kind", "full-house", "straight", "three-of-a-kind", "two-pair", "pair"]),
    commitRolePair,
    placeAny,
  ],
  // Grow same-rank stacks before building → trips / quads / full-house.
  tall: [
    commitLand(["four-of-a-kind", "full-house", "three-of-a-kind"]),
    growStack,
    seedStack,
    commitRolePair,
    placeKind("role"),
    buildBest(4), // only trips+ on purpose
    buildLate(2), // salvage near the cap
  ],
  // Keep every column one ideology → flush family. Recycle the hand otherwise.
  // Columns may each pick a DIFFERENT suit → a mosaic, not a monoculture.
  flush: [buildBest(0), placeFlush, buildLate(2)],
  // Commit to ONE ideology for the whole society; play only that suit + wilds.
  // Tests what forcing a true monoculture costs in win rate / speed.
  monoculture: [buildBest(0), placeMonoculture, buildLate(2)],
  // Reserve a column, stage sequential lands, commit a straight. Recycle otherwise.
  straight: [
    commitLand(["straight"], 1),
    buildBest(5),
    placeKind("role"),
    storeTowardStraight,
    seedStraight,
    buildLate(2),
  ],
};

// ---------------------------------------------------------------------------
// Run one epoch under a policy.
// ---------------------------------------------------------------------------

interface RunStat {
  won: boolean;
  earliestWinTurn: number | null; // first turn cumulative value ≥ difficulty
  totalValue: number;
  unlocks: number;
  topPattern: PatternKind | null; // highest pattern built this run
  byPattern: Record<PatternKind, number>;
  distinctIdeologies: number; // # suits present across built projects
  topIdeologyShare: number; // share held by the single largest suit (0 if nothing built)
}

function runEpoch(api: GameAPI, tactics: Tactic[]): RunStat {
  const byPattern = Object.fromEntries(PATTERNS_IN_ORDER.map((p) => [p, 0])) as Record<
    PatternKind,
    number
  >;
  const difficulty = api.snapshot().setting.crisis.difficulty;
  let cumValue = 0;
  let earliestWinTurn: number | null = null;
  let steps = 0;

  while (api.snapshot().epoch.phase === "play" && steps < 2000) {
    steps++;
    // Resolve the policy phase before acting; board verbs are core-gated until then.
    if (api.snapshot().epoch.turnPhase === "policy") {
      const ps = api.snapshot().epoch.policy;
      api.enactPolicies(pickPolicyKeepIds(ps.candidates, ps.tableau));
      continue;
    }
    // Detect a build by watching the unlock count, then credit its value.
    const before = api.snapshot().epoch.unlockedProjects.length;
    let acted = false;
    for (const t of tactics) {
      if (t(api)) {
        acted = true;
        break;
      }
    }
    if (!acted) {
      api.endTurn();
      continue;
    }
    const snap = api.snapshot();
    if (snap.epoch.unlockedProjects.length > before) {
      const last = snap.epoch.unlockedProjects[snap.epoch.unlockedProjects.length - 1];
      byPattern[last.pattern]++;
      const proj = snap.setting.projects.find((p) => p.id === last.projectId);
      cumValue += proj?.value ?? 0;
      if (earliestWinTurn === null && cumValue >= difficulty) earliestWinTurn = snap.epoch.turn;
    }
  }

  if (api.snapshot().epoch.phase === "crisis") api.resolveCrisis();
  const snap = api.snapshot();
  const outcome = snap.epoch.crisis.outcome!;
  let topPattern: PatternKind | null = null;
  for (const p of PATTERNS_IN_ORDER) if (byPattern[p] > 0) topPattern = p;
  const ideoCounts = Object.values(unlockedIdeologyBreakdown(snap.epoch.unlockedProjects)).filter(
    (v) => v > 0,
  );
  const ideoTotal = ideoCounts.reduce((a, b) => a + b, 0);
  return {
    won: outcome.cleared,
    earliestWinTurn,
    totalValue: outcome.totalValue,
    unlocks: Object.values(byPattern).reduce((a, b) => a + b, 0),
    topPattern,
    byPattern,
    distinctIdeologies: ideoCounts.length,
    topIdeologyShare: ideoTotal ? Math.max(...ideoCounts) / ideoTotal : 0,
  };
}

// ---------------------------------------------------------------------------
// Aggregate + report.
// ---------------------------------------------------------------------------

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function report(settingId: string, policy: string) {
  // getSetting returns the shared registry object, so this override is picked
  // up by the store command (which reads effectiveRules().storageCapacity live,
  // seeded from this base).
  if (STORAGE_CAP !== null) getSetting(settingId).rules.baseStorageCapacity = STORAGE_CAP;
  for (const [pat, v] of Object.entries(VALUE_OVERRIDES)) {
    const proj = getSetting(settingId).projects.find((p) => p.pattern === pat);
    if (proj) proj.value = v;
  }
  const stats: RunStat[] = [];
  for (let i = 0; i < RUNS; i++) {
    const api = new GameAPI(i + 1, { skipLoad: true, forceSettingId: settingId });
    stats.push(runEpoch(api, POLICIES[policy]));
  }
  const wins = stats.filter((s) => s.won);
  const winTurns = wins.map((s) => s.earliestWinTurn).filter((t): t is number => t !== null);
  const topCounts: Record<string, number> = {};
  for (const s of stats)
    if (s.topPattern) topCounts[s.topPattern] = (topCounts[s.topPattern] ?? 0) + 1;
  const patternAvg: Record<string, number | null> = {};
  for (const p of PATTERNS_IN_ORDER) {
    const v = r1(mean(stats.map((s) => s.byPattern[p])));
    if (v) patternAvg[p] = v; // omit zeros for readability
  }
  return {
    setting: settingId,
    policy,
    winRate: Math.round((wins.length / RUNS) * 1000) / 1000,
    winTurnMedian: median(winTurns),
    winTurnMin: winTurns.length ? Math.min(...winTurns) : null,
    avgTotalValue: r1(mean(stats.map((s) => s.totalValue))),
    avgUnlocks: r1(mean(stats.map((s) => s.unlocks))),
    avgDistinctIdeologies: r1(mean(stats.map((s) => s.distinctIdeologies))),
    avgTopIdeologyShare: r1(mean(stats.map((s) => s.topIdeologyShare * 100))),
    monocultureRuns: stats.filter((s) => s.topIdeologyShare >= 0.8).length,
    topPatternReached: topCounts,
    avgUnlocksByPattern: patternAvg,
  };
}

if (import.meta.main) {
  const settings = SETTING_ARG === "all" ? ALL_SETTINGS : [SETTING_ARG];
  const policies = POLICY_ARG === "all" ? Object.keys(POLICIES) : [POLICY_ARG];

  const rows: ReturnType<typeof report>[] = [];
  for (const s of settings) for (const p of policies) rows.push(report(s, p));

  // Detail blocks
  for (const row of rows) console.log(JSON.stringify(row, null, 2));

  // Summary matrix: win rate (median win-turn) per policy × setting.
  console.log("\n=== win rate (median rounds-to-win) — rows: policy, cols: setting ===");
  const header = ["policy".padEnd(9), ...settings.map((s) => s.padEnd(20))].join(" | ");
  console.log(header);
  for (const p of policies) {
    const cells = settings.map((s) => {
      const row = rows.find((r) => r.setting === s && r.policy === p)!;
      const wt = row.winTurnMedian === null ? "—" : `@${row.winTurnMedian}`;
      return `${(row.winRate * 100).toFixed(0)}% ${wt}`.padEnd(20);
    });
    console.log([p.padEnd(9), ...cells].join(" | "));
  }

  // Ideology matrix: top-suit share % (distinct suits) per policy × setting.
  console.log("\n=== top-suit share % (avg distinct suits) — rows: policy, cols: setting ===");
  console.log(header);
  for (const p of policies) {
    const cells = settings.map((s) => {
      const row = rows.find((r) => r.setting === s && r.policy === p)!;
      return `${row.avgTopIdeologyShare}% (${row.avgDistinctIdeologies})`.padEnd(20);
    });
    console.log([p.padEnd(9), ...cells].join(" | "));
  }
}
