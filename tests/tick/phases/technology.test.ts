import { describe, expect, test } from "bun:test";
import { processResearch } from "../../../src/core/tick/phases/technology";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("technology:processResearch", () => {
  test("phase has correct id and dependencies", () => {
    expect(processResearch.id).toBe("technology:processResearch");
    expect(processResearch.reads).toContain("technology");
    expect(processResearch.reads).toContain("resources");
    expect(processResearch.writes).toContain("technology");
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
        airQualityManager: state.airQuality,
        earthCrisis: state.earthCrisis,
        grid: state.grid,
        scheduler: state.scheduler,
      },
      { autoAssignNewColonists: true },
    );
    const events = processResearch.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });
});
