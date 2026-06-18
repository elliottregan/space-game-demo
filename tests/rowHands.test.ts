import { describe, it, expect } from "bun:test";
import { identifyRowHand, validateRowHand, canCommitHand } from "../src/core/engine/rowHands.ts";
import { ALL_CARDS, type Card } from "../src/core/data/cards.ts";
import { createEmptyColumn, placeLand } from "../src/core/engine/column.ts";
import { fullJoker } from "./fixtures.ts";

const landsPool = (): Card[] => ALL_CARDS.filter((x) => x.kind === "land");

describe("identifyRowHand", () => {
  it("empty stack returns null", () => {
    expect(identifyRowHand([])).toBeNull();
  });

  it("one card is high-card", () => {
    const c = landsPool()[0];
    expect(identifyRowHand([c])).toBe("high-card");
  });

  it("two same-rank cards is pair", () => {
    expect(identifyRowHand(pairOfRank(landsPool()))).toBe("pair");
  });

  it("three same-rank cards is three-of-a-kind", () => {
    expect(identifyRowHand(nOfRank(landsPool(), 3))).toBe("three-of-a-kind");
  });

  it("four same-rank cards is four-of-a-kind", () => {
    expect(identifyRowHand(nOfRank(landsPool(), 4))).toBe("four-of-a-kind");
  });

  it("five consecutive ranks is straight", () => {
    expect(identifyRowHand(consecutiveLands(landsPool(), 5))).toBe("straight");
  });

  it("two ranks each appearing twice is two-pair", () => {
    const first = pairOfRank(landsPool());
    const firstRank = first[0].rank;
    const second = pairOfRank(landsPool(), { excludeRank: firstRank });
    expect(identifyRowHand([...first, ...second])).toBe("two-pair");
  });

  it("3+2 is full-house", () => {
    const three = nOfRank(landsPool(), 3);
    const pair = pairOfRank(landsPool(), { excludeRank: three[0].rank });
    expect(identifyRowHand([...three, ...pair])).toBe("full-house");
  });

  it("two different-rank cards returns null", () => {
    const lands = landsPool();
    const a = lands.find((c) => c.rank === 4)!;
    const b = lands.find((c) => c.rank === 5)!;
    expect(identifyRowHand([a, b])).toBeNull();
  });

  it("five same-rank cards returns null (not a poker hand)", () => {
    // Synthetic case using ALL_CARDS — if no rank has 5 duplicates in the
    // pool, this test trivially passes via the throw. Use a fabricated array.
    const a = landsPool()[0];
    const five = [a, a, a, a, a];
    expect(identifyRowHand(five)).toBeNull();
  });
});

describe("identifyRowHand — wilds (counts-as) complete shapes", () => {
  const lands = landsPool();
  const landOf = (rank: number): Card => {
    const c = lands.find((x) => x.rank === rank);
    if (!c) throw new Error(`no land of rank ${rank}`);
    return c;
  };

  it("a lone wild is high-card", () => {
    expect(identifyRowHand([fullJoker()])).toBe("high-card");
  });

  it("a single wild onto [5,5] makes three-of-a-kind", () => {
    expect(identifyRowHand([landOf(5), landOf(5), fullJoker()])).toBe("three-of-a-kind");
  });

  it("[3,4,6,7] + wild fills the gap to a straight", () => {
    const hand = [landOf(3), landOf(4), landOf(6), landOf(7), fullJoker()];
    expect(identifyRowHand(hand)).toBe("straight");
  });

  it("[3,3,5,6] + wild cannot straight (duplicate fixed rank) — falls back to trips", () => {
    // counts: rank 3 ×2; a wild joins the 3s → three-of-a-kind, never a straight.
    const hand = [landOf(3), landOf(3), landOf(5), landOf(6), fullJoker()];
    expect(identifyRowHand(hand)).toBe("three-of-a-kind");
  });

  it("[5,5,5] + 2 wilds is full-house (g0=3, g1=0 ⇒ 0+2=2 ≤ 2)", () => {
    const hand = [landOf(5), landOf(5), landOf(5), fullJoker(), fullJoker()];
    expect(identifyRowHand(hand)).toBe("full-house");
  });

  it("[5,5] + 3 wilds is full-house (g0=2, g1=0 ⇒ 1+2=3 ≤ 3)", () => {
    const hand = [landOf(5), landOf(5), fullJoker(), fullJoker(), fullJoker()];
    expect(identifyRowHand(hand)).toBe("full-house");
  });

  it("[5,5,9,9] + wild is full-house (g0=2, g1=2 ⇒ wild completes the trips)", () => {
    const hand = [landOf(5), landOf(5), landOf(9), landOf(9), fullJoker()];
    expect(identifyRowHand(hand)).toBe("full-house");
  });

  it("all-wild w=5 is full-house (g0=g1=0 ⇒ 3+2=5 ≤ 5)", () => {
    const hand = [fullJoker(), fullJoker(), fullJoker(), fullJoker(), fullJoker()];
    expect(identifyRowHand(hand)).toBe("full-house");
  });

  it("wild + two distinct fixed ranks (n=3) is null (no pair/trips reachable)", () => {
    // g0=1, w=1 ⇒ maxSame=2 < 3 for trips; n=3 has no two-pair/pair classification → null.
    const hand = [landOf(4), landOf(6), fullJoker()];
    expect(identifyRowHand(hand)).toBeNull();
  });

  it("a joker cannot form a straight using rank 15 (charter rank excluded from RANKS)", () => {
    // [11,12,13,14] are role-band ranks; a wild could only complete with rank 10 or 15.
    // 15 is not in RANKS, so the only straight is [10,11,12,13,14] via the wild as 10.
    // Build it on the role pool to prove the wild fills 10, never 15.
    const roles = ALL_CARDS.filter((x) => x.kind === "role");
    const roleOf = (rank: number): Card => {
      const c = roles.find((x) => x.rank === rank);
      if (!c) throw new Error(`no role of rank ${rank}`);
      return c;
    };
    const hand = [roleOf(11), roleOf(12), roleOf(13), roleOf(14), fullJoker()];
    // window [10..14] (wild=10) succeeds; [11..15] is impossible (15 ∉ RANKS).
    expect(identifyRowHand(hand)).toBe("straight");
  });
});

describe("canCommitHand — row eligibility via canOccupyRow", () => {
  it("a full joker is committable into the influence row", () => {
    const col = createEmptyColumn();
    placeLand(col, landsPool()[0]); // unlock the influence row
    expect(canCommitHand(col, "influence", [fullJoker()])).toBe(true);
  });

  it("a plain land is rejected from the influence row", () => {
    const col = createEmptyColumn();
    placeLand(col, landsPool()[0]);
    const land = landsPool()[1];
    expect(canCommitHand(col, "influence", [land])).toBe(false);
  });
});

describe("validateRowHand", () => {
  it("returns true for an identified hand", () => {
    expect(validateRowHand(pairOfRank(landsPool()))).toBe(true);
  });

  it("returns false for a non-hand state", () => {
    const lands = landsPool();
    const a = lands.find((c) => c.rank === 4)!;
    const b = lands.find((c) => c.rank === 5)!;
    expect(validateRowHand([a, b])).toBe(false);
  });

  it("returns false for an empty stack", () => {
    expect(validateRowHand([])).toBe(false);
  });
});

describe("canCommitHand", () => {
  it("growing from pair to three by adding a same-rank card is valid", () => {
    const col = createEmptyColumn();
    const three = nOfRank(landsPool(), 3);
    placeLand(col, three[0]);
    placeLand(col, three[1]);
    expect(canCommitHand(col, "land", [three[2]])).toBe(true);
  });

  it("committing 4 lands of two ranks (2+2) to an empty row is two-pair, valid", () => {
    const col = createEmptyColumn();
    const a = pairOfRank(landsPool());
    const b = pairOfRank(landsPool(), { excludeRank: a[0].rank });
    expect(canCommitHand(col, "land", [...a, ...b])).toBe(true);
  });

  it("committing two different-rank cards to an empty row is rejected (not a hand)", () => {
    const col = createEmptyColumn();
    const lands = landsPool();
    const a = lands.find((c) => c.rank === 4)!;
    const b = lands.find((c) => c.rank === 5)!;
    expect(canCommitHand(col, "land", [a, b])).toBe(false);
  });

  it("rejects cards of the wrong kind for the row", () => {
    const col = createEmptyColumn();
    const role = ALL_CARDS.find((x) => x.kind === "role")!;
    expect(canCommitHand(col, "land", [role])).toBe(false);
  });
});

// --- helpers ---

function pairOfRank(pool: Card[], opts: { excludeRank?: number | null } = {}): Card[] {
  for (const r of [2, 3, 4, 5, 6, 7, 8, 9]) {
    if (opts.excludeRank === r) continue;
    const sameRank = pool.filter((c) => c.rank === r);
    if (sameRank.length >= 2) return sameRank.slice(0, 2);
  }
  throw new Error("no pair available in pool");
}

function nOfRank(pool: Card[], n: number): Card[] {
  for (const r of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const same = pool.filter((c) => c.rank === r);
    if (same.length >= n) return same.slice(0, n);
  }
  throw new Error(`no ${n}-of-a-kind available`);
}

function consecutiveLands(pool: Card[], n: number): Card[] {
  for (let start = 2; start + n - 1 <= 9; start++) {
    const cards: Card[] = [];
    let ok = true;
    for (let i = 0; i < n; i++) {
      const c = pool.find((x) => x.rank === start + i);
      if (!c) {
        ok = false;
        break;
      }
      cards.push(c);
    }
    if (ok) return cards;
  }
  throw new Error("no straight available");
}
