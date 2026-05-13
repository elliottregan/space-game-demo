import { describe, test, expect } from "bun:test";
import { dispatch } from "../src/core/engine/dispatch.ts";
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
  placeCharter,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import type { Column, Epoch, ProjectUnlock } from "../src/core/types.ts";
import { countDissentInDeck } from "../src/core/engine/effects.ts";
import { commitHand } from "../src/core/engine/commands.ts";
import { createRng } from "../src/core/engine/rng.ts";

function freshEpoch(columns: Column[] = []): Epoch {
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
    influence: 0,
    materials: 0,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };
}

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("dispatch", () => {
  test("card-discarded pushes to discard pile AND adds a quiet dissent to deck", () => {
    const ep = freshEpoch();
    const card = land(7, "solidarity");
    dispatch(ep, { type: "card-discarded", card, source: "hand" });
    expect(ep.discard).toContain(card);
    const top = ep.draw[0];
    expect(top?.tags.includes("dissent")).toBe(true);
    expect(top?.name).toBe("Quiet Dissent");
  });

  test("dissent-added places a dissent card on top of the deck", () => {
    const ep = freshEpoch();
    dispatch(ep, { type: "dissent-added", variant: "quiet" });
    expect(ep.draw[0]?.tags.includes("dissent")).toBe(true);
  });

  test("influence-recall discard adds one dissent (card-discarded source=influence-recall)", () => {
    const col = createEmptyColumn();
    const r = getCard(roleId("scholar", "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, r);
    const ep = freshEpoch([col]);
    dispatch(ep, { type: "card-discarded", card: r, source: "influence-recall" });
    expect(ep.discard).toContain(r);
    expect(ep.draw.length).toBe(1); // one dissent added
    expect(ep.draw[0]?.tags.includes("dissent")).toBe(true);
  });

  test("column-built cascades discards through the discard handler (one dissent per card) and clears the column", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    placeCharter(col, getCard("keystone-founding-charter"));
    const ep = freshEpoch([col]);
    const influence = col.influence.cards[0];
    const charter = col.charter.card;
    if (!influence || !charter) throw new Error("expected placed cards");
    const unlock: ProjectUnlock = {
      projectId: "p-pair",
      pattern: "pair",
      turn: ep.turn,
      cards: [...col.lands.cards, influence, charter],
    };
    dispatch(ep, { type: "column-built", columnIndex: 0, unlock });
    expect(ep.unlockedProjects).toContain(unlock);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.cards.length).toBe(0);
    expect(col.charter.card).toBeNull();
    // 4 cards discarded → 4 dissent added.
    expect(ep.draw.filter((c) => c.tags.includes("dissent")).length).toBe(4);
    expect(ep.discard.length).toBe(4);
  });

  test("event is appended to eventLog", () => {
    const ep = freshEpoch();
    dispatch(ep, { type: "dissent-added", variant: "quiet" });
    expect(ep.eventLog.length).toBe(1);
    expect(ep.eventLog[0].type).toBe("dissent-added");
  });
});

describe("cards-committed event", () => {
  test("appends cards to the land row in placement order", () => {
    const col = createEmptyColumn();
    const ep = freshEpoch([col]);
    const card0 = land(7, "solidarity");
    const card1 = land(7, "heritage");
    dispatch(ep, { type: "cards-committed", columnIndex: 0, row: "land", cards: [card0, card1] });
    expect(ep.columns[0].lands.cards[0]).toBe(card0);
    expect(ep.columns[0].lands.cards[1]).toBe(card1);
    expect(ep.columns[0].lands.cards.length).toBe(2);
  });

  test("appends to the influence row when row === 'influence'", () => {
    const col = createEmptyColumn();
    const ep = freshEpoch([col]);
    const role0 = getCard(roleId("scholar", "solidarity"));
    const role1 = getCard(roleId("engineer", "solidarity"));
    dispatch(ep, {
      type: "cards-committed",
      columnIndex: 0,
      row: "influence",
      cards: [role0, role1],
    });
    expect(ep.columns[0].influence.cards[0]).toBe(role0);
    expect(ep.columns[0].influence.cards[1]).toBe(role1);
    expect(ep.columns[0].influence.cards.length).toBe(2);
  });

  test("does NOT add Dissent", () => {
    const col = createEmptyColumn();
    const ep = freshEpoch([col]);
    const { dissent: before } = countDissentInDeck(ep);
    dispatch(ep, {
      type: "cards-committed",
      columnIndex: 0,
      row: "land",
      cards: [land(7, "solidarity"), land(7, "heritage")],
    });
    const { dissent: after } = countDissentInDeck(ep);
    expect(after).toBe(before);
  });

  test("ignores an unknown columnIndex (no crash, no row mutation)", () => {
    const col = createEmptyColumn();
    const ep = freshEpoch([col]);
    // Should not throw.
    dispatch(ep, {
      type: "cards-committed",
      columnIndex: 999,
      row: "land",
      cards: [land(7, "solidarity")],
    });
    // The existing column must be untouched.
    expect(ep.columns[0].lands.cards.length).toBe(0);
  });
});

describe("commitHand command", () => {
  const rng = createRng(42);

  function epochWithHand(cards: ReturnType<typeof getCard>[], influence = 10): Epoch {
    const ep = freshEpoch([createEmptyColumn()]);
    ep.hand = cards.map((c) => ({ ...c, id: c.id + "-" + Math.random().toString(36).slice(2) }));
    // keep stable references — re-use the card objects directly
    ep.hand = [...cards];
    ep.influence = influence;
    return ep;
  }

  test("success — commit two same-rank lands; both appear in col.lands.cards in order", () => {
    const card0 = getCard(landId(7, "solidarity"));
    const card1 = getCard(landId(7, "heritage"));
    const ep = epochWithHand([card0, card1]);
    const result = commitHand(ep, 0, "land", [card0.id, card1.id], rng);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value[0]).toBe(card0);
    expect(result.value[1]).toBe(card1);
    expect(ep.columns[0].lands.cards[0]).toBe(card0);
    expect(ep.columns[0].lands.cards[1]).toBe(card1);
    expect(ep.hand).not.toContain(card0);
    expect(ep.hand).not.toContain(card1);
  });

  test("hand-membership rejection — card not in hand returns ok: false", () => {
    const card0 = getCard(landId(7, "solidarity"));
    const ep = epochWithHand([]);
    const result = commitHand(ep, 0, "land", [card0.id], rng);
    expect(result.ok).toBe(false);
  });

  test("wrong-kind rejection — roles to land row returns ok: false", () => {
    const role = getCard(roleId("scholar", "solidarity"));
    const ep = epochWithHand([role]);
    const result = commitHand(ep, 0, "land", [role.id], rng);
    expect(result.ok).toBe(false);
  });

  test("wrong-kind rejection — lands to influence row returns ok: false", () => {
    const card = getCard(landId(7, "solidarity"));
    const ep = epochWithHand([card]);
    const result = commitHand(ep, 0, "influence", [card.id], rng);
    expect(result.ok).toBe(false);
  });

  test("invalid hand rejection — two different-rank cards returns ok: false", () => {
    const card0 = getCard(landId(7, "solidarity"));
    const card1 = getCard(landId(8, "solidarity"));
    const ep = epochWithHand([card0, card1]);
    const result = commitHand(ep, 0, "land", [card0.id, card1.id], rng);
    expect(result.ok).toBe(false);
  });

  test("influence cost deducted — committing two agitators deducts summed cost", () => {
    // agitator has influenceCost: 1
    const role0 = getCard(roleId("agitator", "solidarity"));
    const role1 = getCard(roleId("agitator", "heritage"));
    const ep = epochWithHand([role0, role1], 10);
    const before = ep.influence;
    // agitator solidarity effect: gainInfluence(1) costs 1; net per card = 0 influence change
    // agitator heritage effect: gainInfluence(1) + backlash, costs 1
    const result = commitHand(ep, 0, "influence", [role0.id, role1.id], rng);
    expect(result.ok).toBe(true);
    // cost = 1 + 1 = 2, effects give +1 +1 = 2, net = before - 2 + 2
    const totalCost = role0.influenceCost + role1.influenceCost;
    const totalGain = 1 + 1; // both agitators gain 1 influence immediately
    expect(ep.influence).toBe(before - totalCost + totalGain);
  });

  test("insufficient influence — returns ok: false; epoch state untouched", () => {
    const role0 = getCard(roleId("scholar", "solidarity")); // cost 2
    const role1 = getCard(roleId("scholar", "heritage")); // cost 2
    const ep = epochWithHand([role0, role1], 3); // total cost = 4, have 3
    const influenceBefore = ep.influence;
    const result = commitHand(ep, 0, "influence", [role0.id, role1.id], rng);
    expect(result.ok).toBe(false);
    expect(ep.influence).toBe(influenceBefore);
    expect(ep.columns[0].influence.cards.length).toBe(0);
    expect(ep.hand).toContain(role0);
    expect(ep.hand).toContain(role1);
  });

  test("per-card effects fire — agitator solidarity pair gives +2 influence (both effects)", () => {
    const role0 = getCard(roleId("agitator", "solidarity")); // cost 1, effect: +1 inf
    const role1 = getCard(roleId("agitator", "transformation")); // cost 1, effect: +1 inf
    const ep = epochWithHand([role0, role1], 10);
    const before = ep.influence;
    const result = commitHand(ep, 0, "influence", [role0.id, role1.id], rng);
    expect(result.ok).toBe(true);
    // 2 deducted, 2 gained from effects — net zero
    expect(ep.influence).toBe(before);
  });

  test("phase guard — commit during crisis phase returns ok: false", () => {
    const card0 = getCard(landId(7, "solidarity"));
    const card1 = getCard(landId(7, "heritage"));
    const ep = epochWithHand([card0, card1]);
    ep.phase = "crisis";
    const result = commitHand(ep, 0, "land", [card0.id, card1.id], rng);
    expect(result.ok).toBe(false);
  });

  test("status guard — commit when epoch ended returns ok: false", () => {
    const card0 = getCard(landId(7, "solidarity"));
    const card1 = getCard(landId(7, "heritage"));
    const ep = epochWithHand([card0, card1]);
    ep.status = { kind: "won", outcome: { totalValue: 0, cleared: true, contributingUnlocks: [] } };
    const result = commitHand(ep, 0, "land", [card0.id, card1.id], rng);
    expect(result.ok).toBe(false);
  });

  test("empty cardIds returns ok: false", () => {
    const ep = epochWithHand([]);
    const result = commitHand(ep, 0, "land", [], rng);
    expect(result.ok).toBe(false);
  });

  test("invalid column index returns ok: false", () => {
    const card0 = getCard(landId(7, "solidarity"));
    const ep = epochWithHand([card0]);
    const result = commitHand(ep, 99, "land", [card0.id], rng);
    expect(result.ok).toBe(false);
  });
});
