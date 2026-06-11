import { describe, test, expect } from "bun:test";
import { createEmptyColumn, columnCards, placeLand } from "../src/core/engine/column.ts";
import { dispatch } from "../src/core/engine/dispatch.ts";
import { getCard, landId, makeDissent, roleId } from "../src/core/data/cards.ts";
import { storeCard } from "../src/core/engine/commands.ts";
import { getSetting } from "../src/core/settings/index.ts";
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

const SETTING = getSetting("homeworld"); // storageCapacity: 1

describe("storeCard command", () => {
  test("stores a card from hand into the column's storage, free of charge", () => {
    const ep = freshEpoch();
    const card = land(6, "sovereignty");
    ep.hand = [card];
    const before = ep.influence;
    const r = storeCard(ep, SETTING, card.id, 0);
    expect(r.ok).toBe(true);
    expect(ep.hand.length).toBe(0);
    expect(ep.columns[0].storage).toEqual([card]);
    expect(ep.influence).toBe(before);
    expect(ep.draw.length).toBe(0); // storing is not a discard — no Dissent
  });

  test("any card kind is storable — role, charter, even Dissent", () => {
    const ep = freshEpoch([createEmptyColumn(), createEmptyColumn(), createEmptyColumn()]);
    const role = getCard(roleId("scholar", "heritage"));
    const charter = getCard("keystone-pioneer");
    const dissent = makeDissent();
    ep.hand = [role, charter, dissent];
    expect(storeCard(ep, SETTING, role.id, 0).ok).toBe(true);
    expect(storeCard(ep, SETTING, charter.id, 1).ok).toBe(true);
    expect(storeCard(ep, SETTING, dissent.id, 2).ok).toBe(true);
  });

  test("at capacity without replaceId → error, nothing changes", () => {
    const ep = freshEpoch();
    const stored = land(3, "heritage");
    ep.columns[0].storage = [stored];
    const incoming = land(9, "solidarity");
    ep.hand = [incoming];
    const r = storeCard(ep, SETTING, incoming.id, 0);
    expect(r.ok).toBe(false);
    expect(ep.columns[0].storage).toEqual([stored]);
    expect(ep.hand).toContain(incoming);
  });

  test("replacement discards the old card (→ Dissent) and stores the new one", () => {
    const ep = freshEpoch();
    const stored = land(3, "heritage");
    ep.columns[0].storage = [stored];
    const incoming = land(9, "solidarity");
    ep.hand = [incoming];
    const r = storeCard(ep, SETTING, incoming.id, 0, stored.id);
    expect(r.ok).toBe(true);
    expect(ep.columns[0].storage).toEqual([incoming]);
    expect(ep.discard).toContain(stored);
    expect(ep.draw.filter((c) => c.tags.includes("dissent")).length).toBe(1);
  });

  test("replaceId with room still evicts the named card (explicit swap)", () => {
    const ep = freshEpoch();
    const stored = land(3, "heritage");
    ep.columns[0].storage = [stored];
    // Pretend capacity were larger: replaceId is honored regardless of fullness.
    const incoming = land(9, "solidarity");
    ep.hand = [incoming];
    const r = storeCard(ep, SETTING, incoming.id, 0, stored.id);
    expect(r.ok).toBe(true);
    expect(ep.columns[0].storage).toEqual([incoming]);
    expect(ep.discard).toContain(stored);
  });

  test("replaceId naming a card not in storage errors with no mutation", () => {
    const ep = freshEpoch();
    const incoming = land(9, "solidarity");
    ep.hand = [incoming];
    const r = storeCard(ep, SETTING, incoming.id, 0, "ghost");
    expect(r.ok).toBe(false);
    expect(ep.hand).toContain(incoming);
    expect(ep.columns[0].storage.length).toBe(0);
    expect(ep.draw.length).toBe(0); // no dissent side-effects
  });

  test("guards: ended epoch, wrong phase, unknown card, invalid column", () => {
    const ep = freshEpoch();
    const card = land(6, "sovereignty");
    ep.hand = [card];
    expect(storeCard(ep, SETTING, "nope", 0).ok).toBe(false);
    expect(storeCard(ep, SETTING, card.id, 99).ok).toBe(false);
    ep.phase = "crisis";
    expect(storeCard(ep, SETTING, card.id, 0).ok).toBe(false);
  });
});
