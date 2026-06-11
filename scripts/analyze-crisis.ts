// Greedy heuristic: per Setting, run N Epochs and report Crisis stats.
//
// Usage: bun run scripts/analyze-crisis.ts [runs] [settingId] [seedOffset]
//   runs (default 50) — number of simulated Epochs.
//   settingId (default "homeworld") — "homeworld" | "generation-ship" | "ruined-homeworld".
//   seedOffset (default 0) — added to each iteration's seed (for re-runs).

import { GameAPI } from "../src/facade/GameAPI.ts";
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import { canCommitHand } from "../src/core/engine/rowHands.ts";
import { PATTERNS_IN_ORDER } from "../src/core/data/projects.ts";
import type { PatternKind } from "../src/core/types.ts";
import type { Card, Column } from "../src/core/types.ts";

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

// ---------------------------------------------------------------------------
// Hand-candidate finders for multi-card commits
// ---------------------------------------------------------------------------

/** Return distinct ranks in the card array (as sorted array). */
function distinctRanks(cards: Card[]): number[] {
  return [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
}

/** Check whether a set of ranks forms a complete straight (5 consecutive). */
function isStraightRanks(ranks: number[]): boolean {
  if (ranks.length !== 5) return false;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/**
 * Given candidates (hand + storage for the column), find the cards that form
 * the best multi-card land hand (2+ cards) for placing onto an EMPTY land row.
 *
 * Priority (highest value first): straight > full-house > four-of-a-kind >
 * three-of-a-kind > two-pair > pair.
 *
 * Returns null if no valid 2+ card set is found.
 */
function findBestLandCommit(
  col: Column,
  candidates: Card[],
): { cards: Card[]; hand: string[]; storage: string[] } | null {
  const landCandidates = candidates.filter((c) => c.kind === "land");
  if (landCandidates.length < 2) return null;

  // Require empty land row for multi-card commit (simplest correct policy)
  if (col.lands.cards.length > 0) return null;

  const byRank = new Map<number, Card[]>();
  for (const c of landCandidates) {
    const bucket = byRank.get(c.rank) ?? [];
    bucket.push(c);
    byRank.set(c.rank, bucket);
  }

  const storageIds = new Set(col.storage.map((c) => c.id));

  function split(cards: Card[]): { hand: string[]; storage: string[] } {
    const hand: string[] = [];
    const storage: string[] = [];
    for (const c of cards) {
      if (storageIds.has(c.id)) storage.push(c.id);
      else hand.push(c.id);
    }
    return { hand, storage };
  }

  // ---- Try straight (5 distinct sequential ranks) ----
  const allRanks = distinctRanks(landCandidates);
  // Slide a 5-rank window over available ranks
  for (let start = 0; start + 4 < allRanks.length; start++) {
    const window = allRanks.slice(start, start + 5);
    if (isStraightRanks(window)) {
      // Pick one card per rank
      const chosen: Card[] = [];
      for (const r of window) {
        const bucket = byRank.get(r)!;
        chosen.push(bucket[0]);
      }
      const { hand, storage } = split(chosen);
      if (canCommitHand(col, "land", chosen)) {
        return { cards: chosen, hand, storage };
      }
    }
  }

  // ---- Try full-house (3+2 of two ranks) ----
  const ranksWithEnough3 = [...byRank.entries()].filter(([, cards]) => cards.length >= 3);
  const ranksWithEnough2 = [...byRank.entries()].filter(([, cards]) => cards.length >= 2);
  for (const [r3, bucket3] of ranksWithEnough3) {
    for (const [r2, bucket2] of ranksWithEnough2) {
      if (r3 === r2) continue;
      const chosen = [...bucket3.slice(0, 3), ...bucket2.slice(0, 2)];
      if (canCommitHand(col, "land", chosen)) {
        const { hand, storage } = split(chosen);
        return { cards: chosen, hand, storage };
      }
    }
  }

  // ---- Try four-of-a-kind ----
  for (const [, bucket] of byRank.entries()) {
    if (bucket.length >= 4) {
      const chosen = bucket.slice(0, 4);
      if (canCommitHand(col, "land", chosen)) {
        const { hand, storage } = split(chosen);
        return { cards: chosen, hand, storage };
      }
    }
  }

  // ---- Try three-of-a-kind ----
  for (const [, bucket] of byRank.entries()) {
    if (bucket.length >= 3) {
      const chosen = bucket.slice(0, 3);
      if (canCommitHand(col, "land", chosen)) {
        const { hand, storage } = split(chosen);
        return { cards: chosen, hand, storage };
      }
    }
  }

  // ---- Try two-pair ----
  const pairBuckets = [...byRank.entries()].filter(([, cards]) => cards.length >= 2);
  if (pairBuckets.length >= 2) {
    const chosen = [...pairBuckets[0][1].slice(0, 2), ...pairBuckets[1][1].slice(0, 2)];
    if (canCommitHand(col, "land", chosen)) {
      const { hand, storage } = split(chosen);
      return { cards: chosen, hand, storage };
    }
  }

  // ---- Try pair ----
  for (const [, bucket] of byRank.entries()) {
    if (bucket.length >= 2) {
      const chosen = bucket.slice(0, 2);
      if (canCommitHand(col, "land", chosen)) {
        const { hand, storage } = split(chosen);
        return { cards: chosen, hand, storage };
      }
    }
  }

  return null;
}

/**
 * Find the best multi-card role commit for the influence row of a column.
 * Requires the column to have at least one land. Only attempts pairs (2 same
 * role-type) — roles are same-kind-only, so straight doesn't apply unless it's
 * a royal-flush path. Keeps it simple: just same-role pairs.
 */
function findBestRoleCommit(
  col: Column,
  candidates: Card[],
  availableInfluence: number,
): { cards: Card[]; hand: string[]; storage: string[] } | null {
  if (col.lands.cards.length === 0) return null;
  const roleCandidates = candidates.filter((c) => c.kind === "role" && !c.tags.includes("dissent"));
  if (roleCandidates.length < 2) return null;

  // Only attempt onto empty influence row for multi-card commits
  if (col.influence.cards.length > 0) return null;

  const storageIds = new Set(col.storage.map((c) => c.id));

  function split(cards: Card[]): { hand: string[]; storage: string[] } {
    const hand: string[] = [];
    const storage: string[] = [];
    for (const c of cards) {
      if (storageIds.has(c.id)) storage.push(c.id);
      else hand.push(c.id);
    }
    return { hand, storage };
  }

  // Group by role type (same rank = same role type for roles)
  const byRank = new Map<number, Card[]>();
  for (const c of roleCandidates) {
    const bucket = byRank.get(c.rank) ?? [];
    bucket.push(c);
    byRank.set(c.rank, bucket);
  }

  // Try straight (5 distinct sequential role ranks: 10-14 = royal flush path)
  const allRanks = distinctRanks(roleCandidates);
  for (let start = 0; start + 4 < allRanks.length; start++) {
    const window = allRanks.slice(start, start + 5);
    if (isStraightRanks(window)) {
      const chosen: Card[] = [];
      for (const r of window) {
        const bucket = byRank.get(r)!;
        chosen.push(bucket[0]);
      }
      const totalCost = chosen.reduce((s, c) => s + c.influenceCost, 0);
      if (totalCost <= availableInfluence && canCommitHand(col, "influence", chosen)) {
        const { hand, storage } = split(chosen);
        return { cards: chosen, hand, storage };
      }
    }
  }

  // Try pair
  for (const [, bucket] of byRank.entries()) {
    if (bucket.length >= 2) {
      const chosen = bucket.slice(0, 2);
      const totalCost = chosen.reduce((s, c) => s + c.influenceCost, 0);
      if (totalCost <= availableInfluence && canCommitHand(col, "influence", chosen)) {
        const { hand, storage } = split(chosen);
        return { cards: chosen, hand, storage };
      }
    }
  }

  return null;
}

/**
 * Should we store this land card toward a straight?
 * Returns true if this card's rank, combined with at least 2 other distinct
 * ranks available (hand lands + this column's storage lands), falls within any
 * 5-rank window — meaning a straight is plausible from this column.
 */
function worthStoringForStraight(card: Card, handLands: Card[], colStorageLands: Card[]): boolean {
  const allRanks = [
    ...new Set([card.rank, ...handLands.map((c) => c.rank), ...colStorageLands.map((c) => c.rank)]),
  ];
  if (allRanks.length < 3) return false;
  const sorted = allRanks.sort((a, b) => a - b);
  // Check if any 5-rank window contains at least 3 of our distinct ranks
  for (let lo = sorted[0]; lo <= sorted[sorted.length - 1] - 4; lo++) {
    const hi = lo + 4;
    const inWindow = sorted.filter((r) => r >= lo && r <= hi);
    if (inWindow.length >= 3) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main epoch runner
// ---------------------------------------------------------------------------

function runEpoch(api: GameAPI): RunResult {
  const firstByPattern: Partial<Record<PatternKind, number>> = {};
  const unlocksByPattern = Object.fromEntries(PATTERNS_IN_ORDER.map((p) => [p, 0])) as Record<
    PatternKind,
    number
  >;
  let steps = 0;
  const MAX_STEPS = 1000;

  while (api.snapshot().epoch.phase === "play" && steps < MAX_STEPS) {
    steps++;
    const snap = api.snapshot();
    let acted = false;

    // -----------------------------------------------------------------------
    // Step 1: Build any buildable column (prefer highest-value match).
    // -----------------------------------------------------------------------
    {
      let bestValue = -Infinity;
      let bestCol = -1;
      let bestKind: PatternKind | null = null;
      for (let i = 0; i < snap.epoch.columns.length; i++) {
        const m = evaluateColumn(snap.epoch.columns[i], snap.setting.projects);
        if (!m) continue;
        const proj = snap.setting.projects.find((p) => p.id === m.projectId);
        const val = proj?.value ?? 0;
        if (val > bestValue) {
          bestValue = val;
          bestCol = i;
          bestKind = m.kind;
        }
      }
      if (bestCol >= 0 && bestKind !== null) {
        const r = api.buildColumn(bestCol);
        if (r.ok) {
          unlocksByPattern[bestKind] += 1;
          if (firstByPattern[bestKind] === undefined) {
            firstByPattern[bestKind] = api.snapshot().epoch.turn;
          }
          acted = true;
        }
      }
    }

    if (acted) continue;

    // -----------------------------------------------------------------------
    // Step 2: Multi-card commit — find best land or role hand across columns.
    // -----------------------------------------------------------------------
    {
      // Gather all hand lands + roles (non-dissent) for candidate scanning.
      const snap2 = api.snapshot();
      const handCards = snap2.epoch.hand.filter((c) => !c.tags.includes("dissent"));

      // Try each column for a land commit first (prefer land over role).
      let committed = false;
      for (let colIdx = 0; colIdx < snap2.epoch.columns.length; colIdx++) {
        const col = snap2.epoch.columns[colIdx];
        const storageCards = col.storage.filter((c) => !c.tags.includes("dissent"));
        const candidates: Card[] = [...handCards, ...storageCards];

        const landCommit = findBestLandCommit(col, candidates);
        if (landCommit && landCommit.hand.length + landCommit.storage.length >= 2) {
          const r = api.commitHand(colIdx, "land", landCommit.hand, landCommit.storage);
          if (r.ok) {
            committed = true;
            acted = true;
            break;
          }
        }
      }

      if (!committed) {
        // Try role commits if no land commit succeeded.
        for (let colIdx = 0; colIdx < snap2.epoch.columns.length; colIdx++) {
          const col = snap2.epoch.columns[colIdx];
          const storageCards = col.storage.filter((c) => !c.tags.includes("dissent"));
          const candidates: Card[] = [...handCards, ...storageCards];

          const roleCommit = findBestRoleCommit(col, candidates, snap2.epoch.influence);
          if (roleCommit && roleCommit.hand.length + roleCommit.storage.length >= 2) {
            const r = api.commitHand(colIdx, "influence", roleCommit.hand, roleCommit.storage);
            if (r.ok) {
              acted = true;
              break;
            }
          }
        }
      }
    }

    if (acted) continue;

    // -----------------------------------------------------------------------
    // Step 3: Single-card placement — first hand card with a valid column.
    // -----------------------------------------------------------------------
    {
      const snap3 = api.snapshot();
      for (const card of snap3.epoch.hand) {
        const cols = api.validColumns(card.id);
        if (cols.length === 0) continue;
        const r = api.placeCard(card.id, cols[0]);
        if (r.ok) {
          acted = true;
          break;
        }
      }
    }

    if (acted) continue;

    // -----------------------------------------------------------------------
    // Step 4: Store one land card toward a straight.
    // -----------------------------------------------------------------------
    {
      const snap4 = api.snapshot();
      const handLands = snap4.epoch.hand.filter(
        (c) => c.kind === "land" && !c.tags.includes("dissent"),
      );
      const storageCapacity = snap4.setting.rules.storageCapacity;

      outer: for (const card of handLands) {
        // Only store if this card can't be placed anywhere useful
        const cols = api.validColumns(card.id);
        if (cols.length > 0) continue; // can be placed normally; skip storing

        // Check if this card would extend a potential straight in any column
        for (let colIdx = 0; colIdx < snap4.epoch.columns.length; colIdx++) {
          const col = snap4.epoch.columns[colIdx];
          // Column must have at least 1 land (storage prerequisite) and free capacity
          if (col.lands.cards.length === 0) continue;
          if (col.storage.length >= storageCapacity) continue;

          const colStorageLands = col.storage.filter((c) => c.kind === "land");
          if (worthStoringForStraight(card, handLands, colStorageLands)) {
            const r = api.storeCard(card.id, colIdx);
            if (r.ok) {
              acted = true;
              break outer;
            }
          }
        }
      }
    }

    if (acted) continue;

    // -----------------------------------------------------------------------
    // Step 5: Nothing succeeded — end the turn.
    // -----------------------------------------------------------------------
    api.endTurn();
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

  const avgUnlocks: Record<string, number | null> = {};
  const avgFirst: Record<string, number | null> = {};
  for (const p of PATTERNS_IN_ORDER) {
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
