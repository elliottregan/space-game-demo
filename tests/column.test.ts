import { describe, test, expect } from "bun:test";
import {
  createEmptyColumn,
  canPlaceLand,
  canPlaceInfluence,
  placeLand,
  placeInfluence,
  clearColumn,
  columnCards,
  isBuildable,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import { fullJoker } from "./fixtures.ts";

const land = (
  rank: number,
  ideology: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(landId(rank, ideology));
const role = (
  r: "agitator" | "scholar" | "preacher" | "engineer" | "architect",
  i: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(roleId(r, i));

describe("column placement", () => {
  test("empty column accepts any land", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(true);
  });

  test("non-empty column rejects mismatched-rank land", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceLand(col, land(5, "heritage"))).toBe(false);
    expect(canPlaceLand(col, land(7, "heritage"))).toBe(true);
  });

  test("land row rejects a fifth same-rank land (no valid hand beyond four-of-a-kind)", () => {
    const col = createEmptyColumn();
    for (let i = 0; i < 4; i++) placeLand(col, land(7, "solidarity"));
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(false);
  });

  test("influence row rejected when no lands placed", () => {
    const col = createEmptyColumn();
    expect(canPlaceInfluence(col, role("scholar", "solidarity"))).toBe(false);
  });

  test("influence row accepts a role once any land is placed", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, role("scholar", "solidarity"))).toBe(true);
  });

  test("influence row rejects when already filled", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    expect(canPlaceInfluence(col, role("engineer", "solidarity"))).toBe(false);
  });

  test("clearColumn empties all rows", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    clearColumn(col);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.cards.length).toBe(0);
  });

  test("columnCards returns all cards in lands+influence order", () => {
    const col = createEmptyColumn();
    const l1 = land(7, "solidarity");
    const l2 = land(7, "heritage");
    const r = role("scholar", "solidarity");
    placeLand(col, l1);
    placeLand(col, l2);
    placeInfluence(col, r);
    expect(columnCards(col)).toEqual([l1, l2, r]);
  });
});

test("clearColumn wipes rows but leaves storage untouched", () => {
  const col = createEmptyColumn();
  placeLand(col, land(7, "solidarity"));
  col.storage.push(land(8, "heritage"));
  clearColumn(col);
  expect(col.lands.cards.length).toBe(0);
  expect(col.storage.length).toBe(1);
});

describe("single-card placement routing through validateRowHand", () => {
  test("first role on empty influence row is valid (high-card)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, role("scholar", "solidarity"))).toBe(true);
  });

  test("adding same-role-type to single role grows pair (valid)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    // Another scholar role (same rank 11)
    expect(canPlaceInfluence(col, role("scholar", "heritage"))).toBe(true);
  });

  test("adding different-role-type to single role is rejected (would be 2 different ranks)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    // Engineer has rank 13, scholar has rank 11 → not a valid hand
    expect(canPlaceInfluence(col, role("engineer", "solidarity"))).toBe(false);
  });

  test("first land on empty column is valid (high-card)", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(true);
  });

  test("adding same-rank land to single land grows pair (valid)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceLand(col, land(7, "heritage"))).toBe(true);
  });

  test("adding different-rank land to single land is rejected (would be 2 different ranks)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceLand(col, land(5, "solidarity"))).toBe(false);
  });

  test("influence placement still requires at least one land in the column", () => {
    const col = createEmptyColumn();
    expect(canPlaceInfluence(col, role("scholar", "solidarity"))).toBe(false);
  });
});

describe("two-row buildability + joker placement", () => {
  test("a column is buildable with >=1 land + >=1 influence (no charter)", () => {
    const col = createEmptyColumn();
    expect(isBuildable(col)).toBe(false);
    placeLand(col, land(7, "solidarity"));
    expect(isBuildable(col)).toBe(false);
    placeInfluence(col, role("scholar", "solidarity"));
    expect(isBuildable(col)).toBe(true);
  });

  test("a full joker places into the land row (canOccupyRow, not card.kind)", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, fullJoker())).toBe(true);
  });

  test("a full joker places into the influence row once a land is below", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, fullJoker())).toBe(true);
  });

  test("a plain land is still rejected from the influence row", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, land(5, "solidarity"))).toBe(false);
  });

  test("single-card wild allowed onto a same-rank stack [5,5] (grows to trips)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    expect(canPlaceLand(col, fullJoker())).toBe(true);
  });

  test("single-card wild allowed onto an empty land row", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, fullJoker())).toBe(true);
  });

  test("single-card NON-wild 7 rejected onto a mixed [5,5,wild] row (would make two-pair via single placement)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    placeLand(col, fullJoker()); // row is now [5,5,wild] -> trips, a same-rank stack
    // A single non-wild 7 would make [5,5,wild,7] = two-pair, which single
    // placement must never reach (commitHand only). The same-rank-growth gate
    // rejects it.
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(false);
  });
});
