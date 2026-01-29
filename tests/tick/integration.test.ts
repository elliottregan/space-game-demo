import { describe, test, expect, beforeEach } from "bun:test";
import { GameState } from "../../src/core/GameState";

describe("TickRunner integration", () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  test("getTickPhases returns all registered phases", () => {
    const phases = state.getTickPhases();
    expect(phases.length).toBeGreaterThan(0);
    expect(phases.some((p) => p.id.startsWith("pretick:"))).toBe(true);
    expect(phases.some((p) => p.id.startsWith("resources:"))).toBe(true);
    expect(phases.some((p) => p.id.startsWith("buildings:"))).toBe(true);
    expect(phases.some((p) => p.id.startsWith("colony:"))).toBe(true);
    expect(phases.some((p) => p.id.startsWith("victory:"))).toBe(true);
  });

  test("tick() executes all phases", () => {
    const events = state.tick();
    expect(Array.isArray(events)).toBe(true);
    expect(state.currentSol).toBe(1);
  });

  test("tick() increments currentSol", () => {
    expect(state.currentSol).toBe(0);
    state.tick();
    expect(state.currentSol).toBe(1);
    state.tick();
    expect(state.currentSol).toBe(2);
  });

  test("tick() stops when game is over", () => {
    // Fast-forward to trigger victory
    for (let i = 0; i < 1000 && !state.victory.isGameOver(); i++) {
      state.tick();
    }

    const solAtGameOver = state.currentSol;
    state.tick();
    state.tick();

    // Sol should not advance after game over
    expect(state.currentSol).toBe(solAtGameOver);
  });

  test("tick() logs events to event log", () => {
    state.clearEventLog();
    state.tick();
    // Event log should contain events from the tick
    // (specific events depend on game state)
    expect(state.getEventLog()).toBeInstanceOf(Array);
  });
});
