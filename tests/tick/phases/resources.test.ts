import { describe, expect, test } from "bun:test";
import {
  applyResourceFlows,
  checkResourceDepletion,
} from "../../../src/core/tick/phases/resources";
import { GameState } from "../../../src/core/GameState";
import { createTickContext } from "../../../src/core/tick/TickContext";

describe("resources phases", () => {
  describe("resources:applyFlows", () => {
    test("phase has correct id and dependencies", () => {
      expect(applyResourceFlows.id).toBe("resources:applyFlows");
      expect(applyResourceFlows.reads).toContain("resources");
      expect(applyResourceFlows.writes).toContain("resources");
    });

    test("applies production and consumption", () => {
      const state = new GameState();
      // Add additional production and consumption on top of existing
      state.resources.addProduction({ food: 10 });
      state.resources.addConsumption({ food: 5 });

      const initialFood = state.resources.getResources().food;
      const netFlow = state.resources.getNetFlow();
      const expectedFoodChange = netFlow.food || 0;

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
          districts: state.districts,
          scheduler: state.scheduler,
        },
        { autoAssignNewColonists: true },
      );

      applyResourceFlows.execute(ctx);
      expect(state.resources.getResources().food).toBe(initialFood + expectedFoodChange);
    });
  });

  describe("resources:checkDepletion", () => {
    test("phase has correct id and dependencies", () => {
      expect(checkResourceDepletion.id).toBe("resources:checkDepletion");
      expect(checkResourceDepletion.reads).toContain("resources");
      expect(checkResourceDepletion.writes).toContain("events");
    });
  });
});
