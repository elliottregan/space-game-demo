import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";
import { ColonistRole } from "../src/core/models/Colonist";

describe("Job Assignment", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("getColonistWorkplace", () => {
    it("returns undefined for unassigned colonist", () => {
      const colonist = gameState.colony.getColonists()[0];
      const workplace = gameState.workforce.getColonistWorkplace(
        colonist.id,
        gameState.buildings
      );
      expect(workplace).toBeUndefined();
    });

    it("returns building id when colonist is assigned", () => {
      // Build a basic farm (has workerSlots)
      const farm = gameState.buildings.startBuilding(
        "basic_farm",
        gameState.resources,
        gameState.technology
      );
      expect(farm).not.toBeNull();

      // Complete construction
      for (let i = 0; i < 15; i++) {
        gameState.buildings.tick(gameState.resources);
      }

      const colonist = gameState.colony.getColonists()[0];
      gameState.buildings.assignWorker(farm!.id, colonist.id);

      const workplace = gameState.workforce.getColonistWorkplace(
        colonist.id,
        gameState.buildings
      );
      expect(workplace).toBe(farm!.id);
    });
  });
});
