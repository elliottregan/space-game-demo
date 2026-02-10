import { describe, expect, test } from "bun:test";
import { processRandomEvents } from "../../../src/core/tick/phases/events";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("events:processRandomEvents", () => {
  test("phase has correct id and dependencies", () => {
    expect(processRandomEvents.id).toBe("events:processRandomEvents");
    expect(processRandomEvents.name).toBe("Process Random Events");
    expect(processRandomEvents.reads).toContain("currentSol");
    expect(processRandomEvents.reads).toContain("events");
    expect(processRandomEvents.writes).toContain("events");
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
        lifeSupport: state.lifeSupport,
        earthCrisis: state.earthCrisis,
        grants: state.grants,
        grid: state.grid,
        scheduler: state.scheduler,
      },
      { autoAssignNewColonists: true },
    );
    const events = processRandomEvents.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });

  test("returns events array from events.tick", () => {
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
        lifeSupport: state.lifeSupport,
        earthCrisis: state.earthCrisis,
        grants: state.grants,
        grid: state.grid,
        scheduler: state.scheduler,
      },
      { autoAssignNewColonists: true },
    );
    // Events tick returns events based on random chance and timing
    const events = processRandomEvents.execute(ctx);
    expect(events).toBeInstanceOf(Array);
  });
});
