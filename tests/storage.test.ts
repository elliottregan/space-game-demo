import { describe, test, expect } from "bun:test";
import { createEmptyColumn, columnCards, placeLand } from "../src/core/engine/column.ts";
import { dispatch } from "../src/core/engine/dispatch.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Column, Epoch } from "../src/core/types.ts";

export function freshEpoch(columns: Column[] = [createEmptyColumn()]): Epoch {
  return {
    epochNumber: 1,
    settingId: "test",
    turn: 1,
    phase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: 10,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };
}

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("storage model", () => {
  test("empty column starts with empty storage", () => {
    expect(createEmptyColumn().storage).toEqual([]);
  });

  test("columnCards excludes storage — stored cards are inert", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    col.storage.push(land(8, "heritage"));
    const cards = columnCards(col);
    expect(cards.length).toBe(1);
    expect(cards[0].rank).toBe(7);
  });

  test("card-stored event places the card in the column's storage", () => {
    const ep = freshEpoch();
    const card = land(5, "transformation");
    dispatch(ep, { type: "card-stored", card, columnIndex: 0 });
    expect(ep.columns[0].storage).toEqual([card]);
    expect(ep.eventLog.at(-1)?.type).toBe("card-stored");
  });

  test("card-discarded with source 'storage' adds Dissent like any discard", () => {
    const ep = freshEpoch();
    const card = land(5, "transformation");
    dispatch(ep, { type: "card-discarded", card, source: "storage" });
    expect(ep.discard).toContain(card);
    expect(ep.draw[0]?.tags.includes("dissent")).toBe(true);
  });
});
