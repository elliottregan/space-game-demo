import { describe, it, expect } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Earth Crisis Victory Blocking", () => {
  it("should mark game as defeat when Earth collapses", () => {
    const game = new GameState();

    // Fast forward until Earth collapses
    for (let i = 0; i < 1000; i++) {
      game.tick();
      if (game.earthCrisis.isPointOfNoReturn()) break;
    }

    expect(game.earthCrisis.isPointOfNoReturn()).toBe(true);
    expect(game.victory.getState().status).toBe("defeat");
  });

  it("should allow game to continue playing after Earth collapse", () => {
    const game = new GameState();

    // Fast forward until Earth collapses
    for (let i = 0; i < 1000; i++) {
      game.tick();
      if (game.earthCrisis.isPointOfNoReturn()) break;
    }

    // Game should continue ticking without errors
    const additionalTicks = 10;
    for (let i = 0; i < additionalTicks; i++) {
      game.tick();
    }

    // Population should still exist (game continues)
    expect(game.colony.getPopulation()).toBeGreaterThan(0);
  });
});
