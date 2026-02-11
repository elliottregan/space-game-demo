import { describe, test, expect } from "bun:test";
import {
  processOperations,
  processDepositExtraction,
} from "../../../src/core/tick/phases/operations";
import { createTickContext } from "../../../src/core/tick/TickContext";
import { GameState } from "../../../src/core/GameState";

describe("operations phases", () => {
  function createTestContext() {
    const state = new GameState();
    return createTickContext(
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
        districtGrants: state.districtGrants,
        districts: state.districts,
        scheduler: state.scheduler,
      },
      { autoAssignNewColonists: true },
    );
  }

  describe("processOperations", () => {
    test("has correct phase metadata", () => {
      expect(processOperations.id).toBe("operations:processOperations");
      expect(processOperations.name).toBe("Process Operations");
      expect(processOperations.reads).toContain("operations");
      expect(processOperations.reads).toContain("currentSol");
      expect(processOperations.reads).toContain("resources");
      expect(processOperations.reads).toContain("colony");
      expect(processOperations.writes).toContain("operations");
      expect(processOperations.writes).toContain("events");
    });

    test("executes without error", () => {
      const ctx = createTestContext();
      const events = processOperations.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    test("returns events array from operations.tick", () => {
      const ctx = createTestContext();
      const events = processOperations.execute(ctx);
      expect(events).toBeInstanceOf(Array);
    });
  });

  describe("processDepositExtraction", () => {
    test("has correct phase metadata", () => {
      expect(processDepositExtraction.id).toBe("operations:processDepositExtraction");
      expect(processDepositExtraction.name).toBe("Process Deposit Extraction");
      expect(processDepositExtraction.reads).toContain("buildings");
      expect(processDepositExtraction.reads).toContain("operations");
      expect(processDepositExtraction.writes).toContain("buildings");
      expect(processDepositExtraction.writes).toContain("operations");
      expect(processDepositExtraction.writes).toContain("resources");
      expect(processDepositExtraction.writes).toContain("events");
    });

    test("executes without error on empty buildings", () => {
      const ctx = createTestContext();
      const events = processDepositExtraction.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    test("returns empty events array when no mining buildings exist", () => {
      const ctx = createTestContext();
      const events = processDepositExtraction.execute(ctx);
      expect(events).toEqual([]);
    });
  });
});
