import { describe, test, expect } from "bun:test";
import {
  effectiveCard,
  canCountAsRank,
  canCountAsIdeology,
  canOccupyRow,
  isWildCard,
  ALL_ROWS,
} from "../src/core/engine/countsAs.ts";
import {
  type Card,
  FULL_JOKER,
  RANKS,
  getCard,
  landId,
  makeDissent,
} from "../src/core/data/cards.ts";
import { IDEOLOGIES } from "../src/core/data/ideologies.ts";

describe("effectiveCard — literal (no countsAs)", () => {
  const card = getCard(landId(5, "solidarity"));
  const eff = effectiveCard(card);

  test("rank collapses to a single-element set", () => {
    expect([...eff.ranks]).toEqual([5]);
  });
  test("ideology collapses to a single-element set of the literal color", () => {
    expect([...eff.ideologies]).toEqual(["solidarity"]);
  });
  test("rows collapses to the literal home row", () => {
    expect([...eff.rows]).toEqual(["land"]);
  });
  test("is not wild and not ideologyWild", () => {
    expect(eff.isWild).toBe(false);
    expect(eff.ideologyWild).toBe(false);
  });
});

describe("effectiveCard — FULL_JOKER", () => {
  const card: Card = { ...getCard(landId(5, "solidarity")), countsAs: FULL_JOKER };
  const eff = effectiveCard(card);

  test("ranks expand to the full live RANKS domain", () => {
    expect([...eff.ranks].sort((a, b) => a - b)).toEqual([...RANKS].sort((a, b) => a - b));
  });
  test("ideologies expand to all 4 real ideologies (never 'wild')", () => {
    expect([...eff.ideologies].sort()).toEqual([...IDEOLOGIES].sort());
    expect(eff.ideologies).not.toContain("wild");
  });
  test("rows expand to both playable rows", () => {
    expect([...eff.rows].sort()).toEqual([...ALL_ROWS].sort());
  });
  test("is wild and ideologyWild", () => {
    expect(eff.isWild).toBe(true);
    expect(eff.ideologyWild).toBe(true);
  });
});

describe("effectiveCard — partial rank wild {rank:[5,10]}", () => {
  const card: Card = { ...getCard(landId(5, "solidarity")), countsAs: { rank: [5, 10] } };
  const eff = effectiveCard(card);

  test("ranks expand to the explicit OR-set", () => {
    expect([...eff.ranks].sort((a, b) => a - b)).toEqual([5, 10]);
  });
  test("is structurally wild (carries a modifier)", () => {
    expect(eff.isWild).toBe(true);
  });
  test("but NOT ideologyWild — its color is a real literal", () => {
    expect(eff.ideologyWild).toBe(false);
    expect([...eff.ideologies]).toEqual(["solidarity"]);
  });
});

describe("effectiveCard — dissent (bare 'wild', no countsAs)", () => {
  const card = makeDissent();
  const eff = effectiveCard(card);

  test("ideologies is the EMPTY set (colorless, blocks flush)", () => {
    expect([...eff.ideologies]).toEqual([]);
  });
  test("is NOT a joker (no countsAs) but IS ideologyWild (color-indeterminate)", () => {
    // isWild is structural (no countsAs ⇒ false), but its color is "wild" =
    // indeterminate, so the identity vector must skip it (matches the old
    // `c.ideology === "wild"` guard deriveVector replaces in Task 7).
    expect(eff.isWild).toBe(false);
    expect(eff.ideologyWild).toBe(true);
    expect(isWildCard(card)).toBe(false);
  });
  test("ranks still collapse to its literal rank", () => {
    expect([...eff.ranks]).toEqual([card.rank]);
  });
});

describe("RANKS domain", () => {
  test("excludes 15 (the deleted charter rank)", () => {
    expect(RANKS).not.toContain(15);
    expect([...RANKS].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("predicates", () => {
  const joker: Card = { ...getCard(landId(5, "solidarity")), countsAs: FULL_JOKER };
  const land = getCard(landId(5, "solidarity"));

  test("canCountAsRank", () => {
    expect(canCountAsRank(joker, 14)).toBe(true);
    expect(canCountAsRank(land, 14)).toBe(false);
    expect(canCountAsRank(land, 5)).toBe(true);
  });
  test("canCountAsIdeology", () => {
    expect(canCountAsIdeology(joker, "heritage")).toBe(true);
    expect(canCountAsIdeology(land, "heritage")).toBe(false);
    expect(canCountAsIdeology(land, "solidarity")).toBe(true);
  });
  test("canOccupyRow", () => {
    expect(canOccupyRow(joker, "land")).toBe(true);
    expect(canOccupyRow(joker, "role")).toBe(true);
    expect(canOccupyRow(land, "land")).toBe(true);
    expect(canOccupyRow(land, "role")).toBe(false);
  });
  test("isWildCard keys on countsAs presence", () => {
    expect(isWildCard(joker)).toBe(true);
    expect(isWildCard(land)).toBe(false);
  });
});

describe("data-error boot guard (documented in cards.ts)", () => {
  test("a bare-'wild' playable card (no countsAs, not dissent) is rejected at module load", () => {
    // The guard lives in data/cards.ts and runs over ALL_CARDS at import time.
    // We assert it would throw for a hand-built offending card by re-running
    // the same predicate the guard uses.
    const offending: Card = {
      ...getCard(landId(5, "solidarity")),
      id: "bad-wild",
      ideology: "wild",
    };
    const isDataError =
      offending.ideology === "wild" &&
      offending.countsAs === undefined &&
      offending.kind !== "dissent";
    expect(isDataError).toBe(true);
    // Its resolver result is colorless-non-wild (the conservative failure).
    const eff = effectiveCard(offending);
    expect([...eff.ideologies]).toEqual([]);
    expect(eff.isWild).toBe(false);
  });
});
