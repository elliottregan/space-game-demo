import { describe, expect, test } from "bun:test";
import { processNPCInfluence } from "../../../src/core/tick/phases/politics";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("politics:processNPCInfluence", () => {
  test("phase has correct id and dependencies", () => {
    expect(processNPCInfluence.id).toBe("politics:processNPCInfluence");
    expect(processNPCInfluence.name).toBe("Process NPC Influence");
    expect(processNPCInfluence.reads).toContain("npcInfluence");
    expect(processNPCInfluence.reads).toContain("currentSol");
    expect(processNPCInfluence.writes).toContain("npcInfluence");
    expect(processNPCInfluence.writes).toContain("events");
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
    const events = processNPCInfluence.execute(ctx);
    expect(Array.isArray(events)).toBe(true);
  });

  test("returns events array from npcInfluence.tick", () => {
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
    // NPC influence tick returns events based on political state
    const events = processNPCInfluence.execute(ctx);
    expect(events).toBeInstanceOf(Array);
  });
});
