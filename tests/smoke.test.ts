import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";
import { ALL_CARDS } from "../src/core/data/cards.ts";

describe("GameAPI smoke", () => {
  test("fresh campaign starts with Homeworld", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const s = api.snapshot();
    expect(s.setting.id).toBe("homeworld");
    expect(s.epoch.epochNumber).toBe(1);
    expect(s.epoch.hand.length).toBe(s.setting.rules.handSize);
    expect(s.epoch.columns.length).toBe(s.setting.rules.columnCount);
    expect(
      s.epoch.columns.every(
        (col) =>
          col.lands.cards.length === 0 &&
          col.influence.cards.length === 0 &&
          col.charter.card === null,
      ),
    ).toBe(true);
  });

  test("end turn increments the turn counter while in play phase", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const t0 = api.snapshot().epoch.turn;
    api.endTurn();
    expect(api.snapshot().epoch.turn).toBe(t0 + 1);
  });

  test("Crisis fires when turn budget is exceeded", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    expect(api.snapshot().epoch.phase).toBe("crisis");
  });

  test("commits a pair of same-rank lands via GameAPI.commitHand", () => {
    const api = new GameAPI(42, { skipLoad: true });
    // Directly inject two rank-2 land cards into the hand for a deterministic pair.
    const rank2Lands = ALL_CARDS.filter((c) => c.kind === "land" && c.rank === 2);
    expect(rank2Lands.length).toBeGreaterThanOrEqual(2);
    const [land1, land2] = rank2Lands;
    // Replace hand with just these two cards.
    (api as unknown as { epoch: { hand: typeof rank2Lands } }).epoch.hand = [land1, land2];

    const result = api.commitHand(0, "land", [land1.id, land2.id]);
    expect(result.ok).toBe(true);
    expect(api.snapshot().epoch.columns[0].lands.cards.length).toBe(2);
  });
});
