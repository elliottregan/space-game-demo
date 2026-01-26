import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Distributed Oxygen System", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe("BuildingDefinition.oxygenContribution", () => {
    it("should have oxygenContribution defined on habitat", () => {
      const habitat = gameState.buildings.getDefinition("habitat");
      expect(habitat?.oxygenContribution).toBe(2);
    });

    it("should have oxygenContribution defined on research_lab", () => {
      const lab = gameState.buildings.getDefinition("research_lab");
      expect(lab?.oxygenContribution).toBe(-1);
    });

    it("should have oxygenContribution as 0 on solar_panel", () => {
      const solar = gameState.buildings.getDefinition("solar_panel");
      expect(solar?.oxygenContribution).toBe(0);
    });

    it("should NOT have oxygen_generator building", () => {
      const oxygenGen = gameState.buildings.getDefinition("oxygen_generator");
      expect(oxygenGen).toBeUndefined();
    });
  });
});
