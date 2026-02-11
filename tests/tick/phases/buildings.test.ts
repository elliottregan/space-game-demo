import { describe, test, expect } from "bun:test";
import {
  processBuildingsTick,
  processConstruction,
  processRepairs,
  processRecycling,
} from "../../../src/core/tick/phases/buildings";
import { createTickContext } from "../../../src/core/tick/TickContext";
import { GameState } from "../../../src/core/GameState";

describe("buildings phases", () => {
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
        grants: state.grants,
        districts: state.districts,
        scheduler: state.scheduler,
      },
      { autoAssignNewColonists: true },
    );
  }

  describe("processBuildingsTick", () => {
    test("has correct phase metadata", () => {
      expect(processBuildingsTick.id).toBe("buildings:processBuildingsTick");
      expect(processBuildingsTick.name).toBe("Process Buildings Tick");
      expect(processBuildingsTick.reads).toContain("buildings");
      expect(processBuildingsTick.reads).toContain("resources");
      expect(processBuildingsTick.reads).toContain("currentSol");
      expect(processBuildingsTick.writes).toContain("buildings");
      expect(processBuildingsTick.writes).toContain("resources");
      expect(processBuildingsTick.writes).toContain("events");
    });

    test("executes without error", () => {
      const ctx = createTestContext();
      const events = processBuildingsTick.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("processConstruction (stub)", () => {
    test("has correct phase metadata", () => {
      expect(processConstruction.id).toBe("buildings:processConstruction");
      expect(processConstruction.name).toBe("Process Construction");
    });

    test("returns empty events array (stub)", () => {
      const ctx = createTestContext();
      const events = processConstruction.execute(ctx);
      expect(events).toEqual([]);
    });
  });

  describe("processRepairs (stub)", () => {
    test("has correct phase metadata", () => {
      expect(processRepairs.id).toBe("buildings:processRepairs");
      expect(processRepairs.name).toBe("Process Repairs");
    });

    test("returns empty events array (stub)", () => {
      const ctx = createTestContext();
      const events = processRepairs.execute(ctx);
      expect(events).toEqual([]);
    });
  });

  describe("processRecycling (stub)", () => {
    test("has correct phase metadata", () => {
      expect(processRecycling.id).toBe("buildings:processRecycling");
      expect(processRecycling.name).toBe("Process Recycling");
    });

    test("returns empty events array (stub)", () => {
      const ctx = createTestContext();
      const events = processRecycling.execute(ctx);
      expect(events).toEqual([]);
    });
  });
});
