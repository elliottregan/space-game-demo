// End-to-end smoke tests for the new mechanics.

import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";

describe("GameAPI smoke", () => {
  test("fresh campaign starts with Homeworld and a large deck", () => {
    const api = new GameAPI(42);
    const s = api.snapshot();
    expect(s.setting.id).toBe("homeworld");
    expect(s.epoch.epochNumber).toBe(1);
    expect(s.epoch.hand.length).toBe(7);
    expect(s.epoch.tableau.length).toBe(s.setting.rules.tableauSlots);
    expect(s.epoch.tableau.every((slot) => slot.lands.length === 0 && slot.topper === null)).toBe(
      true,
    );
    // All 57 cards: 20 Roles + 32 Lands + 2 base keystones + 3 project keystones.
    // 7 in hand, so 50 left in draw.
    expect(s.epoch.draw.length + s.epoch.hand.length).toBe(57);
  });

  test("end turn does not crash and increments the turn counter", () => {
    const api = new GameAPI(42);
    const t0 = api.snapshot().epoch.turn;
    api.endTurn();
    expect(api.snapshot().epoch.turn).toBe(t0 + 1);
  });

  test("eventually loses to turn limit if no action taken", () => {
    const api = new GameAPI(42);
    let iter = 0;
    while (api.snapshot().epoch.status.kind === "in-progress" && iter < 40) {
      api.endTurn();
      iter++;
    }
    expect(api.snapshot().epoch.status.kind).not.toBe("in-progress");
  });
});
