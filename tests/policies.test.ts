import { describe, test, expect } from "bun:test";

import { ALL_POLICIES, POLICY_DECKS, POLICY_BY_ID } from "../src/core/data/policies.ts";

describe("ALL_POLICIES", () => {
  test("has exactly 8 distinct cards", () => {
    expect(ALL_POLICIES).toHaveLength(8);
  });

  test("all ids are unique", () => {
    const ids = ALL_POLICIES.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(8);
  });

  test("every card has a non-empty base modifier", () => {
    for (const card of ALL_POLICIES) {
      const keys = Object.keys(card.base);
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  test("every card has a name and flavor", () => {
    for (const card of ALL_POLICIES) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.flavor.length).toBeGreaterThan(0);
    }
  });

  test("all four ideologies are represented", () => {
    const ideologies = new Set(ALL_POLICIES.map((c) => c.ideology));
    expect(ideologies.has("solidarity")).toBe(true);
    expect(ideologies.has("sovereignty")).toBe(true);
    expect(ideologies.has("transformation")).toBe(true);
    expect(ideologies.has("heritage")).toBe(true);
  });
});

describe("POLICY_BY_ID", () => {
  test("mobilize has base.handSize === 1", () => {
    expect(POLICY_BY_ID["mobilize"].base.handSize).toBe(1);
    expect(POLICY_BY_ID["mobilize"].scale).toBeUndefined();
  });

  test("solidarity-forever has base.handSize === 1 and scale with per=4 and solidarity", () => {
    const card = POLICY_BY_ID["solidarity-forever"];
    expect(card.base.handSize).toBe(1);
    const { scale } = card;
    expect(scale).toBeDefined();
    expect(scale?.ideology).toBe("solidarity");
    expect(scale?.per).toBe(4);
    expect(scale?.mod.handSize).toBe(1);
  });

  test("mandate has base.influence === 1 and no scale", () => {
    expect(POLICY_BY_ID["mandate"].base.influence).toBe(1);
    expect(POLICY_BY_ID["mandate"].scale).toBeUndefined();
  });

  test("conscription has base.influence === 2 and base.dissentAdd === 1", () => {
    const card = POLICY_BY_ID["conscription"];
    expect(card.base.influence).toBe(2);
    expect(card.base.dissentAdd).toBe(1);
    expect(card.scale).toBeUndefined();
  });

  test("stockpile has base.storage === 1 and no scale", () => {
    expect(POLICY_BY_ID["stockpile"].base.storage).toBe(1);
    expect(POLICY_BY_ID["stockpile"].scale).toBeUndefined();
  });

  test("deep-reserves has base.storage === 1 and scale with per=2 and transformation", () => {
    const card = POLICY_BY_ID["deep-reserves"];
    expect(card.base.storage).toBe(1);
    const { scale } = card;
    expect(scale).toBeDefined();
    expect(scale?.ideology).toBe("transformation");
    expect(scale?.per).toBe(2);
    expect(scale?.mod.storage).toBe(1);
  });

  test("continuity has base.dissentPurge === 1 and no scale", () => {
    expect(POLICY_BY_ID["continuity"].base.dissentPurge).toBe(1);
    expect(POLICY_BY_ID["continuity"].scale).toBeUndefined();
  });

  test("archive has base.endTurnKeep === 1 and no scale", () => {
    expect(POLICY_BY_ID["archive"].base.endTurnKeep).toBe(1);
    expect(POLICY_BY_ID["archive"].scale).toBeUndefined();
  });
});

describe("POLICY_DECKS", () => {
  test("each ideology deck has exactly 8 cards", () => {
    for (const ideology of ["solidarity", "sovereignty", "transformation", "heritage"] as const) {
      expect(POLICY_DECKS[ideology]).toHaveLength(8);
    }
  });

  test("solidarity deck has 4 copies of mobilize and 4 of solidarity-forever", () => {
    const deck = POLICY_DECKS["solidarity"];
    const mobilizeCount = deck.filter((c) => c.id === "mobilize").length;
    const foreverCount = deck.filter((c) => c.id === "solidarity-forever").length;
    expect(mobilizeCount).toBe(4);
    expect(foreverCount).toBe(4);
  });

  test("sovereignty deck has 4 copies of mandate and 4 of conscription", () => {
    const deck = POLICY_DECKS["sovereignty"];
    const mandateCount = deck.filter((c) => c.id === "mandate").length;
    const conscriptionCount = deck.filter((c) => c.id === "conscription").length;
    expect(mandateCount).toBe(4);
    expect(conscriptionCount).toBe(4);
  });

  test("transformation deck has 4 copies of stockpile and 4 of deep-reserves", () => {
    const deck = POLICY_DECKS["transformation"];
    const stockpileCount = deck.filter((c) => c.id === "stockpile").length;
    const deepReservesCount = deck.filter((c) => c.id === "deep-reserves").length;
    expect(stockpileCount).toBe(4);
    expect(deepReservesCount).toBe(4);
  });

  test("heritage deck has 4 copies of continuity and 4 of archive", () => {
    const deck = POLICY_DECKS["heritage"];
    const continuityCount = deck.filter((c) => c.id === "continuity").length;
    const archiveCount = deck.filter((c) => c.id === "archive").length;
    expect(continuityCount).toBe(4);
    expect(archiveCount).toBe(4);
  });

  test("all cards in each deck belong to the correct ideology", () => {
    for (const ideology of ["solidarity", "sovereignty", "transformation", "heritage"] as const) {
      for (const card of POLICY_DECKS[ideology]) {
        expect(card.ideology).toBe(ideology);
      }
    }
  });
});
