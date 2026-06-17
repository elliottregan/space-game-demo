import { describe, test, expect } from "bun:test";
import { GameAPI } from "../src/facade/GameAPI.ts";
import { resolveCrisis } from "../src/core/engine/turn.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Epoch, ProjectUnlock } from "../src/core/types.ts";

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
    const out = api.snapshot().epoch.crisis.outcome;
    if (!out) throw new Error("expected crisis outcome");
    expect(typeof out.totalValue).toBe("number");
    expect(typeof out.cleared).toBe("boolean");
  });

  test("with zero unlocks, Crisis fails", () => {
    const api = new GameAPI(7, { skipLoad: true });
    const limit = api.snapshot().setting.rules.maxTurns;
    for (let i = 0; i < limit + 1; i++) api.endTurn();
    api.resolveCrisis();
    const out = api.snapshot().epoch.crisis.outcome;
    if (!out) throw new Error("expected crisis outcome");
    expect(out.cleared).toBe(false);
    expect(out.totalValue).toBe(0);
  });
});

function epochWithUnlocks(unlocks: ProjectUnlock[]): Epoch {
  return {
    epochNumber: 1,
    settingId: "homeworld",
    turn: 13,
    phase: "crisis",
    hand: [],
    draw: [],
    discard: [],
    columns: [],
    unlockedProjects: unlocks,
    eventLog: [],
    influence: 0,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };
}

const pairUnlock = (turn: number): ProjectUnlock => ({
  projectId: "homeworld-commons", // pattern "pair", base value 2
  pattern: "pair",
  turn,
  cards: [getCard(landId(7, "solidarity"))],
});

describe("Crisis leveling", () => {
  test("three pair-builds contribute 2+1+1 = 4, not 6", () => {
    const setting = getSetting("homeworld");
    const ep = epochWithUnlocks([pairUnlock(2), pairUnlock(4), pairUnlock(6)]);
    const out = resolveCrisis(ep, setting);
    expect(out.totalValue).toBe(4);
    expect(out.contributions.map((c) => c.value)).toEqual([2, 1, 1]);
    expect(out.contributions.map((c) => c.level)).toEqual([1, 2, 3]);
    expect(out.contributingUnlocks.length).toBe(3); // unchanged shape preserved
  });
});
