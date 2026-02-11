import { describe, test, expect } from "bun:test";
import {
  calculateSocialCohesion,
  processColonyTick,
  autoAssignWorkers,
  assignToDistrict,
} from "../../../src/core/tick/phases/colony";
import { createTickContext } from "../../../src/core/tick/TickContext";
import { GameState } from "../../../src/core/GameState";

describe("colony phases", () => {
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

  describe("calculateSocialCohesion", () => {
    test("has correct phase metadata", () => {
      expect(calculateSocialCohesion.id).toBe("colony:calculateSocialCohesion");
      expect(calculateSocialCohesion.name).toBe("Calculate Social Cohesion");
      expect(calculateSocialCohesion.reads).toContain("colony");
      expect(calculateSocialCohesion.reads).toContain("workforce");
      expect(calculateSocialCohesion.writes).toContain("derived.socialCohesion");
    });

    test("populates derived.socialCohesion", () => {
      const ctx = createTestContext();
      expect(ctx.derived.socialCohesion).toBeNull();
      calculateSocialCohesion.execute(ctx);
      expect(ctx.derived.socialCohesion).not.toBeNull();
      expect(ctx.derived.socialCohesion).toHaveProperty("averageClusteringCoefficient");
      expect(ctx.derived.socialCohesion).toHaveProperty("isolatedColonists");
    });

    test("returns empty events array", () => {
      const ctx = createTestContext();
      const events = calculateSocialCohesion.execute(ctx);
      expect(events).toEqual([]);
    });
  });

  describe("processColonyTick", () => {
    test("has correct phase metadata", () => {
      expect(processColonyTick.id).toBe("colony:processColonyTick");
      expect(processColonyTick.name).toBe("Process Colony Tick");
      expect(processColonyTick.reads).toContain("colony");
      expect(processColonyTick.reads).toContain("resources");
      expect(processColonyTick.reads).toContain("buildings");
      expect(processColonyTick.reads).toContain("derived.socialCohesion");
      expect(processColonyTick.writes).toContain("colony");
      expect(processColonyTick.writes).toContain("resources");
      expect(processColonyTick.writes).toContain("events");
    });

    test("executes without error when derived values populated", () => {
      const ctx = createTestContext();
      // Setup derived values that processColonyTick expects
      calculateSocialCohesion.execute(ctx);
      const events = processColonyTick.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    test("executes with default values when derived values are null", () => {
      const ctx = createTestContext();
      // Don't populate derived values - should use defaults
      const events = processColonyTick.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("autoAssignWorkers", () => {
    test("has correct phase metadata", () => {
      expect(autoAssignWorkers.id).toBe("colony:autoAssignWorkers");
      expect(autoAssignWorkers.name).toBe("Auto-Assign Workers");
      expect(autoAssignWorkers.reads).toContain("colony");
      expect(autoAssignWorkers.reads).toContain("buildings");
      expect(autoAssignWorkers.reads).toContain("settings.autoAssignNewColonists");
      expect(autoAssignWorkers.writes).toContain("buildings");
      expect(autoAssignWorkers.writes).toContain("events");
    });

    test("returns empty events array when auto-assign disabled", () => {
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
          districtGrants: state.districtGrants,
          districts: state.districts,
          scheduler: state.scheduler,
        },
        { autoAssignNewColonists: false },
      );
      const events = autoAssignWorkers.execute(ctx);
      expect(events).toEqual([]);
    });

    test("executes when auto-assign enabled", () => {
      const ctx = createTestContext();
      const events = autoAssignWorkers.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("assignToDistrict", () => {
    test("has correct phase metadata", () => {
      expect(assignToDistrict.id).toBe("colony:assignToDistrict");
      expect(assignToDistrict.name).toBe("Assign to District");
      expect(assignToDistrict.reads).toContain("colony");
      expect(assignToDistrict.reads).toContain("districts");
      expect(assignToDistrict.writes).toContain("districts");
    });

    test("executes without error", () => {
      const ctx = createTestContext();
      const events = assignToDistrict.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    test("returns empty events array", () => {
      const ctx = createTestContext();
      const events = assignToDistrict.execute(ctx);
      expect(events).toEqual([]);
    });
  });
});
