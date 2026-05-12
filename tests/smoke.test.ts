import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";

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
          col.lands.cards.length === 0 && col.influence.card === null && col.charter.card === null,
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
});
