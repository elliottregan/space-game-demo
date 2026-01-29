import { describe, expect, test } from "bun:test";
import { checkVictoryConditions } from "../../../src/core/tick/phases/victory";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("victory:checkConditions", () => {
  test("phase has correct id and dependencies", () => {
    expect(checkVictoryConditions.id).toBe("victory:checkConditions");
    expect(checkVictoryConditions.reads).toContain("technology");
    expect(checkVictoryConditions.reads).toContain("colony");
    expect(checkVictoryConditions.reads).toContain("resources");
    expect(checkVictoryConditions.writes).toContain("victory");
  });

  test("executes without error on fresh game state", () => {
    const state = new GameState();
    const ctx = createTickContext(
      state.currentSol,
      {
        resources: state.resources,
        buildings: state.buildings,
        colony: state.colony,
        workforce: state.workforce,
        technology: state.technology,
        operations: state.operations,
        npcInfluence: state.npcInfluence,
        events: state.events,
        victory: state.victory,
      },
      { autoAssignNewColonists: true },
    );
    const events = checkVictoryConditions.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });
});
