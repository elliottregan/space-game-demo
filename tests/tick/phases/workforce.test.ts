import { describe, test, expect } from "bun:test";
import { processWorkforceTick } from "../../../src/core/tick/phases/workforce";
import { createTickContext } from "../../../src/core/tick/TickContext";
import { GameState } from "../../../src/core/GameState";

describe("workforce:processWorkforceTick", () => {
  test("has correct phase metadata", () => {
    expect(processWorkforceTick.id).toBe("workforce:processWorkforceTick");
    expect(processWorkforceTick.name).toBe("Process Workforce Tick");
    expect(processWorkforceTick.reads).toContain("workforce");
    expect(processWorkforceTick.reads).toContain("colony");
    expect(processWorkforceTick.reads).toContain("buildings");
    expect(processWorkforceTick.reads).toContain("currentSol");
    expect(processWorkforceTick.writes).toContain("workforce");
    expect(processWorkforceTick.writes).toContain("colony");
    expect(processWorkforceTick.writes).toContain("events");
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
        colonistMorale: state.colonistMorale,
        technology: state.technology,
        operations: state.operations,
        events: state.events,
        victory: state.victory,
        ideology: state.ideology,
      },
      { autoAssignNewColonists: true },
    );
    const events = processWorkforceTick.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });

  test("returns events array from workforce.tick", () => {
    const state = new GameState();
    const ctx = createTickContext(
      state.currentSol,
      {
        resources: state.resources,
        buildings: state.buildings,
        colony: state.colony,
        workforce: state.workforce,
        colonistMorale: state.colonistMorale,
        technology: state.technology,
        operations: state.operations,
        events: state.events,
        victory: state.victory,
        ideology: state.ideology,
      },
      { autoAssignNewColonists: true },
    );
    const events = processWorkforceTick.execute(ctx);
    expect(events).toBeInstanceOf(Array);
  });
});
