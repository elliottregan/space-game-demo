import { describe, test, expect } from "bun:test";
import {
  createEmptyColumn,
  canPlaceLand,
  canPlaceInfluence,
  canPlaceCharter,
  placeLand,
  placeInfluence,
  placeCharter,
  clearColumn,
  columnCards,
  columnLandRank,
  MAX_LAND_DEPTH,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";

const land = (
  rank: number,
  ideology: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(landId(rank, ideology));
const role = (
  r: "agitator" | "scholar" | "preacher" | "engineer" | "architect",
  i: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(roleId(r, i));
const charter = () => getCard("keystone-founding-charter");

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

  test("land row caps at MAX_LAND_DEPTH", () => {
    const col = createEmptyColumn();
    for (let i = 0; i < MAX_LAND_DEPTH; i++) placeLand(col, land(7, "solidarity"));
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

  test("charter row rejected without influence", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceCharter(col, charter())).toBe(false);
  });

  test("charter row accepted once influence filled", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    expect(canPlaceCharter(col, charter())).toBe(true);
  });

  test("clearColumn empties all rows", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter());
    clearColumn(col);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.card).toBeNull();
    expect(col.charter.card).toBeNull();
  });

  test("columnCards returns all cards in lands+influence+charter order", () => {
    const col = createEmptyColumn();
    const l1 = land(7, "solidarity");
    const l2 = land(7, "heritage");
    const r = role("scholar", "solidarity");
    const ch = charter();
    placeLand(col, l1);
    placeLand(col, l2);
    placeInfluence(col, r);
    placeCharter(col, ch);
    expect(columnCards(col)).toEqual([l1, l2, r, ch]);
  });

  test("columnLandRank returns the rank of the first land, or null if empty", () => {
    const col = createEmptyColumn();
    expect(columnLandRank(col)).toBeNull();
    placeLand(col, land(7, "solidarity"));
    expect(columnLandRank(col)).toBe(7);
  });
});
