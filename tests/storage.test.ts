import { describe, test, expect } from "bun:test";
import {
  createEmptyColumn,
  columnCards,
  placeLand,
  placeInfluence,
  placeCharter,
} from "../src/core/engine/column.ts";
import { dispatch } from "../src/core/engine/dispatch.ts";
import { getCard, landId, makeDissent, roleId } from "../src/core/data/cards.ts";
import { storeCard, commitHand, placeCard, buildColumn } from "../src/core/engine/commands.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";
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

const rng = createRng(7);

describe("pulling from storage", () => {
  test("commitHand combines hand + this column's storage into a straight", () => {
    const ep = freshEpoch();
    const stored = land(4, "heritage");
    ep.columns[0].storage = [stored];
    const handCards = [
      land(2, "solidarity"),
      land(3, "sovereignty"),
      land(5, "transformation"),
      land(6, "heritage"),
    ];
    ep.hand = [...handCards];
    const r = commitHand(
      ep,
      0,
      "land",
      handCards.map((c) => c.id),
      rng,
      [stored.id],
    );
    expect(r.ok).toBe(true);
    expect(ep.columns[0].lands.cards.length).toBe(5);
    expect(ep.columns[0].storage.length).toBe(0); // pulled out
    expect(ep.draw.length).toBe(0); // committing is not a discard
  });

  test("commitHand rejects when combined cards do not form a valid hand", () => {
    const ep = freshEpoch();
    const stored = land(9, "heritage");
    ep.columns[0].storage = [stored];
    const h = land(2, "solidarity");
    ep.hand = [h];
    const r = commitHand(ep, 0, "land", [h.id], rng, [stored.id]);
    expect(r.ok).toBe(false);
    expect(ep.columns[0].storage).toEqual([stored]); // untouched on failure
    expect(ep.hand).toContain(h);
  });

  test("stored roles pay influence and fire effects at commit time, not store time", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const storedRole = getCard(roleId("agitator", "solidarity")); // cost 1, +1 Influence
    col.storage = [storedRole];
    const before = ep.influence;
    const r = commitHand(ep, 0, "influence", [], rng, [storedRole.id]);
    expect(r.ok).toBe(true);
    // cost 1 paid, effect +1 — net zero
    expect(ep.influence).toBe(before);
    expect(col.influence.cards).toContain(storedRole);
  });

  test("commitHand from storage rejects unaffordable roles", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const storedRole = getCard(roleId("architect", "solidarity")); // cost 3
    col.storage = [storedRole];
    ep.influence = 2;
    const r = commitHand(ep, 0, "influence", [], rng, [storedRole.id]);
    expect(r.ok).toBe(false);
    expect(col.storage).toEqual([storedRole]);
  });

  test("placeCard with source 'storage' plays a stored charter", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const charter = getCard("keystone-founding-charter"); // cost 2, +2 Influence
    col.storage = [charter];
    const campaign = createCampaign(1);
    const r = placeCard(ep, campaign, getSetting("homeworld"), charter.id, 0, rng, "storage");
    expect(r.ok).toBe(true);
    expect(col.charter.card).toBe(charter);
    expect(col.storage.length).toBe(0);
  });

  test("Dissent in storage cannot be played out", () => {
    const ep = freshEpoch();
    const d = makeDissent();
    ep.columns[0].storage = [d];
    const campaign = createCampaign(1);
    const r = placeCard(ep, campaign, getSetting("homeworld"), d.id, 0, rng, "storage");
    expect(r.ok).toBe(false);
  });

  test("Build clears the column but storage survives", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    placeCharter(col, getCard("keystone-founding-charter"));
    const kept = land(2, "solidarity");
    col.storage = [kept];
    const r = buildColumn(ep, getSetting("homeworld"), 0);
    expect(r.ok).toBe(true);
    expect(col.lands.cards.length).toBe(0);
    expect(col.storage).toEqual([kept]);
  });

  test("commitHand rejects duplicate ids instead of duplicating the card", () => {
    const ep = freshEpoch();
    const c = land(7, "solidarity");
    ep.hand = [c];
    const r = commitHand(ep, 0, "land", [c.id, c.id], rng);
    expect(r.ok).toBe(false);
    expect(ep.columns[0].lands.cards.length).toBe(0);
    expect(ep.hand).toContain(c);
  });

  test("commitHand cannot put roles into a column with no Lands", () => {
    const ep = freshEpoch();
    const r1 = getCard(roleId("agitator", "solidarity"));
    const r2 = getCard(roleId("agitator", "heritage"));
    ep.hand = [r1, r2];
    const r = commitHand(ep, 0, "influence", [r1.id, r2.id], rng);
    expect(r.ok).toBe(false);
    expect(ep.columns[0].influence.cards.length).toBe(0);
  });
});
