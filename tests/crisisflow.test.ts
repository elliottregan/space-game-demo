import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";

describe("Crisis flow", () => {
  test("Epoch reaches Crisis when turn budget is exceeded", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    let safety = 0;
    while (api.snapshot().epoch.phase === "play" && safety < limit + 5) {
      api.endTurn();
      safety++;
    }
    expect(api.snapshot().epoch.phase).toBe("crisis");
  });

  test("resolveCrisis records a CrisisOutcome", () => {
    const api = new GameAPI(42, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome!;
    expect(typeof out.totalValue).toBe("number");
    expect(typeof out.cleared).toBe("boolean");
  });

  test("with zero unlocks, Crisis fails", () => {
    const api = new GameAPI(7, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome!;
    expect(out.cleared).toBe(false);
    expect(out.totalValue).toBe(0);
  });
});
